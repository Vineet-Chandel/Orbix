import { createRequire } from "module";
import mammoth from "mammoth";
import type { ParsingQualityReport, ResumeContent } from "./resumeTypes.js";

const require = createRequire(import.meta.url || (process.cwd() + "/package.json"));
const { PDFParse } = require("pdf-parse");

export interface DocumentParseResult {
    rawText: string;
    normalizedText: string;
    pageCount: number;
    filesizeBytes: number;
    filename: string;
    detectedSections: string[];
    parsingQuality: ParsingQualityReport;
    parsedDraft?: ResumeContent;
}

/**
 * Normalizes document text:
 * - Unifies line breaks (\r\n -> \n)
 * - Removes non-printable control characters
 * - Fixes hyphenated line-wraps (e.g. "archi-\ntecture" -> "architecture")
 * - Cleans excessive whitespace while preserving paragraph/bullet structure
 */
export function normalizeDocumentText(text: string): string {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        // Fix words split across line breaks with a hyphen
        .replace(/([a-zA-Z]{3,})-\n([a-zA-Z]{3,})/g, "$1$2")
        // Remove null bytes and non-printable control characters (preserving \n and \t)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
        // Collapse multiple spaces/tabs into a single space
        .replace(/[ \t]{2,}/g, " ")
        // Limit repeated blank lines to max 2
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Assesses raw parsing quality to ensure the resume is genuinely machine-readable
 * rather than an unparseable scan or corrupted document.
 */
export function evaluateParsingQuality(
    rawText: string,
    pageCount: number,
    detectedSections: string[]
): ParsingQualityReport {
    const trimmed = rawText.trim();
    const characterCount = trimmed.length;
    const words = trimmed.match(/[\w+#'.-]+/g) || [];
    const wordCount = words.length;

    const warnings: string[] = [];
    let isScanned = false;
    let hasSelectableText = true;

    // Checks for empty or scanned files
    if (wordCount < 40) {
        isScanned = true;
        hasSelectableText = false;
        warnings.push("Document appears to be a scanned image or contains very low selectable text (< 40 words).");
    } else if (pageCount > 1 && wordCount / pageCount < 30) {
        warnings.push(`Low text density per page (${Math.round(wordCount / pageCount)} words/page across ${pageCount} pages).`);
    }

    if (detectedSections.length < 2) {
        warnings.push("Fewer than 2 standard resume sections detected (e.g., Experience, Education, Skills).");
    }

    // Quality score calculation (0 - 100)
    let qualityScore = 100;
    if (isScanned) qualityScore = 15;
    else {
        if (wordCount < 100) qualityScore -= 30;
        else if (wordCount < 200) qualityScore -= 15;
        if (detectedSections.length < 3) qualityScore -= 15;
        if (warnings.length > 1) qualityScore -= 10;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
        pageCount,
        wordCount,
        characterCount,
        detectedSections,
        hasSelectableText,
        isScanned,
        qualityScore,
        parsingWarnings: warnings,
    };
}

/**
 * Stage A: Ingests, validates, parses, and normalizes PDF and DOCX resume documents.
 */
export async function parseUploadedDocument(
    fileBuffer: Buffer,
    filename: string,
    mimetype: string
): Promise<DocumentParseResult> {
    const isPdf = filename.toLowerCase().endsWith(".pdf") || mimetype.includes("pdf");
    const isDocx = filename.toLowerCase().endsWith(".docx") || mimetype.includes("wordprocessingml");
    const isTxt = filename.toLowerCase().endsWith(".txt") || mimetype.includes("text/plain");

    if (!isPdf && !isDocx && !isTxt) {
        throw new Error("Unsupported document format. Please upload a valid PDF (.pdf), Word document (.docx), or text document (.txt).");
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error(`File size ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB exceeds the maximum 5 MB ATS limit.`);
    }

    let extractedText = "";
    let pageCount = 1;

    if (isTxt) {
        extractedText = fileBuffer.toString("utf-8");
        pageCount = 1;
    } else if (isPdf) {
        // Validate PDF magic bytes: '%PDF-'
        if (fileBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
            throw new Error("Invalid or corrupted PDF file. File header signature did not match %PDF- specification.");
        }
        try {
            const parser = new PDFParse({ data: fileBuffer });
            const data = await parser.getText();
            extractedText = data.text || "";
            pageCount = data.total || 1;
        } catch (pdfErr: any) {
            throw new Error(`PDF parsing failed: ${pdfErr?.message || "Corrupted stream or protected PDF"}`);
        }
    } else {
        // Validate DOCX / ZIP magic bytes: 'PK' (0x50 0x4B)
        if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4b) {
            throw new Error("Invalid or corrupted DOCX document. File header did not match PK zip specification.");
        }
        try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value || "";
        } catch (docxErr: any) {
            throw new Error(`DOCX parsing failed: ${docxErr?.message || "Corrupted Word document"}`);
        }
    }

    const normalizedText = normalizeDocumentText(extractedText);

    if (!normalizedText || normalizedText.length < 25) {
        throw new Error("Could not extract readable text from document. Ensure the file contains selectable text rather than scanned images or password protection.");
    }

    // Identify standard resume sections with robust regex boundaries
    const lines = normalizedText.split("\n").map((l) => l.trim()).filter(Boolean);
    const detectedSections: string[] = [];

    const sectionRegexes = [
        { name: "Summary", regex: /^(professional\s+summary|summary|profile|about\s+me|objective)\b/i },
        { name: "Education", regex: /^(education|academic\s+background|academics|qualifications)\b/i },
        { name: "Skills", regex: /^(technical\s+skills|skills|technologies|technical\s+competencies|competencies|tech\s+stack)\b/i },
        { name: "Projects", regex: /^(projects|technical\s+projects|personal\s+projects|academic\s+projects|featured\s+projects)\b/i },
        { name: "Experience", regex: /^(work\s+experience|professional\s+experience|experience|employment\s+history|internships)\b/i },
        { name: "Certifications", regex: /^(certifications|certificates|licenses|honors|awards|achievements)\b/i },
    ];

    for (const line of lines) {
        for (const rule of sectionRegexes) {
            if (rule.regex.test(line) && !detectedSections.includes(rule.name)) {
                detectedSections.push(rule.name);
            }
        }
    }

    const parsingQuality = evaluateParsingQuality(normalizedText, pageCount, detectedSections);

    return {
        rawText: extractedText,
        normalizedText,
        pageCount,
        filesizeBytes: fileBuffer.length,
        filename,
        detectedSections,
        parsingQuality,
    };
}
