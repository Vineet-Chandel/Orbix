import os from "os";
import path from "path";
import fs from "fs";
import { createWorker, type Worker } from "tesseract.js";

const OCR_CACHE_PATH = process.env.TESSERACT_CACHE_PATH || path.join(os.tmpdir(), "orbix-tesseract-cache");

try {
    if (!fs.existsSync(OCR_CACHE_PATH)) {
        fs.mkdirSync(OCR_CACHE_PATH, { recursive: true });
    }
} catch {
    // Non-fatal if directory already initialized
}

export interface OcrExtractedData {
    studentName: string | null;
    collegeName: string | null;
    enrollmentNumber: string | null;
    courseName: string | null;
    academicYear: string | null;
    institutionEmail: string | null;
    phoneNumber: string | null;
}

export interface OcrAnalysisResult {
    success: boolean;
    confidence: number;
    extractedFields: OcrExtractedData;
    rawTextPreview?: string;
    fieldConfidence: Record<keyof OcrExtractedData, number>;
    error?: string;
    warning?: string;
}

export class CollegeOcrService {
    private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static readonly MIN_FILE_SIZE = 100; // 100 bytes minimum
    private static readonly TIMEOUT_MS = 30000; // 30s timeout

    /**
     * Validates image format via magic bytes
     */
    public static validateImageBuffer(buffer: Buffer): { isValid: boolean; format?: "jpg" | "png" | "webp"; error?: string } {
        if (!buffer || buffer.length < this.MIN_FILE_SIZE) {
            return { isValid: false, error: "Uploaded file is empty or corrupted." };
        }

        if (buffer.length > this.MAX_FILE_SIZE) {
            return { isValid: false, error: "File exceeds 10MB size limit. Please upload a compressed JPG, PNG, or WebP image." };
        }

        // JPEG: FF D8 FF
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return { isValid: true, format: "jpg" };
        }

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47 &&
            buffer[4] === 0x0d &&
            buffer[5] === 0x0a &&
            buffer[6] === 0x1a &&
            buffer[7] === 0x0a
        ) {
            return { isValid: true, format: "png" };
        }

        // WebP: RIFF .... WEBP
        if (
            buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46 &&
            buffer[8] === 0x57 &&
            buffer[9] === 0x45 &&
            buffer[10] === 0x42 &&
            buffer[11] === 0x50
        ) {
            return { isValid: true, format: "webp" };
        }

        return {
            isValid: false,
            error: "Unsupported file type. Please upload an authentic JPG, JPEG, PNG, or WebP student document.",
        };
    }

    /**
     * Runs OCR extraction on the provided image buffer.
     * Isolated from business logic and guaranteed to return a structured fallback on failure.
     */
    public static async processDocumentImage(
        buffer: Buffer,
        expectedCollegeName?: string | null
    ): Promise<OcrAnalysisResult> {
        const validation = this.validateImageBuffer(buffer);
        if (!validation.isValid) {
            return {
                success: false,
                confidence: 0,
                extractedFields: this.createEmptyFields(),
                fieldConfidence: this.createEmptyFieldConfidence(),
                error: validation.error || "Invalid document format",
            };
        }

        let worker: Worker | null = null;
        try {
            // Initialize Tesseract worker with secure writable cache & silent logging
            worker = await createWorker("eng", 1, {
                cachePath: OCR_CACHE_PATH,
                logger: () => {}, // suppress raw stdout logging of PII
            });

            // Set timeout promise
            const ocrPromise = worker.recognize(buffer);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("OCR processing timed out")), this.TIMEOUT_MS)
            );

            const { data } = await Promise.race([ocrPromise, timeoutPromise]);
            const text = data.text || "";
            const meanConfidence = Math.min(100, Math.max(0, Math.round(data.confidence || 0)));

            if (!text.trim() || text.trim().length < 10) {
                return {
                    success: false,
                    confidence: 0,
                    extractedFields: this.createEmptyFields(),
                    fieldConfidence: this.createEmptyFieldConfidence(),
                    rawTextPreview: "",
                    error: "Could not detect clear text on this document. You may manually fill in your enrollment details for founder review.",
                };
            }

            // Parse structured collegiate fields
            const { fields, fieldConfidence } = this.parseExtractedFields(text, expectedCollegeName);

            // Calculate overall composite confidence
            const identifiedFieldCount = Object.values(fields).filter(Boolean).length;
            const compositeConfidence = Math.round(
                meanConfidence * 0.4 + (identifiedFieldCount / 7) * 100 * 0.6
            );

            return {
                success: true,
                confidence: compositeConfidence,
                extractedFields: fields,
                fieldConfidence,
                rawTextPreview: text.slice(0, 300), // First 300 chars for preview
            };
        } catch (err: any) {
            return {
                success: false,
                confidence: 0,
                extractedFields: this.createEmptyFields(),
                fieldConfidence: this.createEmptyFieldConfidence(),
                error: `OCR processing encountered an issue: ${err.message || "Unreadable image"}. Manual review is available.`,
            };
        } finally {
            if (worker) {
                try {
                    await worker.terminate();
                } catch {
                    // Ignore worker terminate errors
                }
            }
        }
    }

    /**
     * Parses raw OCR text into structured collegiate fields.
     */
    private static parseExtractedFields(
        rawText: string,
        expectedCollegeName?: string | null
    ): { fields: OcrExtractedData; fieldConfidence: Record<keyof OcrExtractedData, number> } {
        const lines = rawText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        const fields: OcrExtractedData = this.createEmptyFields();
        const conf: Record<keyof OcrExtractedData, number> = this.createEmptyFieldConfidence();

        // 1. Enrollment / Registration / Roll Number
        const rollPatterns = [
            /(?:roll\s*(?:no|num|number)?|enrollment\s*(?:no|num|number)?|enrolment\s*(?:no)?|reg\s*(?:no|num|number|id)?|registration\s*(?:no|number)?|id\s*(?:no|card\s*no)?|student\s*id|prn|urn|usn|uid|scholar\s*no)[:.\s-]*([A-Z0-9/-]{4,25})/i,
            /\b([0-9]{2}[A-Z]{2,4}[0-9]{4,8})\b/i, // common Indian college roll format e.g. 21BCSE0145
            /\b([A-Z]{2,4}[0-9]{6,12})\b/i,        // e.g. CS202100452
            /\b([0-9]{9,14})\b/,                   // large numeric enrollment numbers e.g. 2100520100045
        ];

        for (const line of lines) {
            for (const pat of rollPatterns) {
                const match = line.match(pat);
                if (match && match[1]) {
                    const cleaned = match[1].replace(/[^A-Za-z0-9/-]/g, "").trim();
                    if (cleaned.length >= 4 && cleaned.length <= 25) {
                        fields.enrollmentNumber = cleaned;
                        conf.enrollmentNumber = 85;
                        break;
                    }
                }
            }
            if (fields.enrollmentNumber) break;
        }

        // 2. Student Name
        const nameKeywords = [
            /(?:student\s*name|candidate\s*name|name\s*of\s*student|name)[:.\s-]+([A-Z][a-zA-Z\s.]{2,40})/i,
            /(?:s\/o|d\/o|w\/o)[:.\s-]+([A-Z][a-zA-Z\s.]{2,40})/i,
        ];

        for (const line of lines) {
            for (const pat of nameKeywords) {
                const match = line.match(pat);
                if (match && match[1]) {
                    const candidate = match[1].trim();
                    if (this.isValidNameCandidate(candidate)) {
                        fields.studentName = candidate;
                        conf.studentName = 80;
                        break;
                    }
                }
            }
            if (fields.studentName) break;
        }

        // If no explicit "Name:" prefix found, search for clean title-case candidate in first 5 lines
        if (!fields.studentName) {
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const l = lines[i];
                if (l &&
                    /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(l) &&
                    this.isValidNameCandidate(l)
                ) {
                    fields.studentName = l;
                    conf.studentName = 60;
                    break;
                }
            }
        }

        // 3. College / University Name
        const collegeKeywords = [
            "institute",
            "college",
            "university",
            "vidyapeeth",
            "campus",
            "school of",
            "academy",
            "technology",
            "engineering",
        ];

        for (const line of lines) {
            const lower = line.toLowerCase();
            if (collegeKeywords.some((kw) => lower.includes(kw))) {
                if (line.length > 5 && line.length < 150) {
                    fields.collegeName = line.replace(/^(?:college|institute|university)[:\s-]*/i, "").trim();
                    conf.collegeName = 75;
                    break;
                }
            }
        }

        // If expectedCollegeName was supplied and matches anywhere in text, boost confidence
        if (expectedCollegeName && rawText.toLowerCase().includes(expectedCollegeName.toLowerCase().slice(0, 15))) {
            fields.collegeName = fields.collegeName || expectedCollegeName;
            conf.collegeName = 95;
        }

        // 4. Course / Department / Branch
        const courseRegex = /\b(b\.?\s*tech|b\.?\s*e\.?|bca|mca|m\.?\s*tech|b\.?\s*sc|m\.?\s*sc|b\.?\s*com|bba|mba|ph\.?\s*d|diploma|computer\s*science|cse|information\s*technology|it|mechanical|electrical|electronics|civil|ai\s*&?\s*ml|data\s*science)\b/i;
        for (const line of lines) {
            const match = line.match(courseRegex);
            if (match) {
                fields.courseName = line.replace(/^(?:course|branch|dept|department|degree)[:\s-]*/i, "").trim().slice(0, 100) || null;
                conf.courseName = 75;
                break;
            }
        }

        // 5. Academic Year / Validity
        const yearRegex = /\b(20[2-3][0-9]\s*[-–/to]+\s*20[2-3][0-9]|20[2-3][0-9]\s*[-–/]\s*[0-9]{2}|valid\s*(?:upto|up\s*to|until|thru)?[:.\s]*20[2-3][0-9]|batch[:.\s]*20[2-3][0-9]|semester\s*[1-8]|year\s*[1-4])\b/i;
        for (const line of lines) {
            const match = line.match(yearRegex);
            if (match) {
                fields.academicYear = match[0].trim();
                conf.academicYear = 80;
                break;
            }
        }

        // 6. Institutional Email
        const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:edu|ac\.in|edu\.in|[a-zA-Z]{2,}))\b/i;
        const emailMatch = rawText.match(emailRegex);
        if (emailMatch && emailMatch[1]) {
            fields.institutionEmail = emailMatch[1].toLowerCase().trim();
            conf.institutionEmail = 85;
        }

        // 7. Phone Number (Indian 10-digit mobile pattern)
        const phoneRegex = /(?:(?:\+|0{0,2})91[\s-]?)?([6789]\d{9})\b/;
        const phoneMatch = rawText.match(phoneRegex);
        if (phoneMatch && phoneMatch[1]) {
            fields.phoneNumber = phoneMatch[1] || null;
            conf.phoneNumber = 70;
        }

        return { fields, fieldConfidence: conf };
    }

    private static isValidNameCandidate(str: string): boolean {
        if (!str || str.length < 3 || str.length > 50) return false;
        const lower = str.toLowerCase();
        const blacklist = [
            "college",
            "institute",
            "university",
            "student",
            "card",
            "identity",
            "principal",
            "signature",
            "valid",
            "upto",
            "date of birth",
            "blood",
            "group",
            "library",
            "campus",
            "department",
            "session",
            "academic",
            "government",
            "engineering",
        ];
        return !blacklist.some((b) => lower.includes(b));
    }

    private static createEmptyFields(): OcrExtractedData {
        return {
            studentName: null,
            collegeName: null,
            enrollmentNumber: null,
            courseName: null,
            academicYear: null,
            institutionEmail: null,
            phoneNumber: null,
        };
    }

    private static createEmptyFieldConfidence(): Record<keyof OcrExtractedData, number> {
        return {
            studentName: 0,
            collegeName: 0,
            enrollmentNumber: 0,
            courseName: 0,
            academicYear: 0,
            institutionEmail: 0,
            phoneNumber: 0,
        };
    }
}
