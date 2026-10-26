import { createRequire } from "module";
import mammoth from "mammoth";
import type { ResumeContent } from "./resumeTypes.js";

const require = createRequire(import.meta.url || (process.cwd() + "/package.json"));
const { PDFParse } = require("pdf-parse");

export interface DocumentParseResult {
    rawText: string;
    pageCount: number;
    filesizeBytes: number;
    filename: string;
    detectedSections: string[];
    parsedDraft: ResumeContent;
}

export async function parseUploadedDocument(
    fileBuffer: Buffer,
    filename: string,
    mimetype: string
): Promise<DocumentParseResult> {
    const isPdf = filename.toLowerCase().endsWith(".pdf") || mimetype.includes("pdf");
    const isDocx = filename.toLowerCase().endsWith(".docx") || mimetype.includes("wordprocessingml");

    if (!isPdf && !isDocx) {
        throw new Error("Unsupported document format. Only valid PDF and DOCX files are supported.");
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error(`File size ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB exceeds the 5 MB strict ATS limit.`);
    }

    let rawText = "";
    let pageCount = 1;

    if (isPdf) {
        // Validate PDF magic bytes: '%PDF-'
        if (fileBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
            throw new Error("Invalid or corrupted PDF file.");
        }
        const parser = new PDFParse({ data: fileBuffer });
        const data = await parser.getText();
        rawText = data.text || "";
        pageCount = data.total || 1;
    } else {
        // Validate ZIP / DOCX magic bytes: 'PK' (0x50 0x4B)
        if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4b) {
            throw new Error("Invalid or corrupted DOCX document.");
        }
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        rawText = result.value || "";
    }

    if (!rawText || rawText.trim().length < 20) {
        throw new Error("Could not extract readable text from document. Ensure the file contains selectable text rather than scanned images.");
    }

    // Heuristics to detect sections & contact details
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const detectedSections: string[] = [];

    const sectionRegexes = [
        { name: "Summary", regex: /^(professional\s+summary|summary|profile|about\s+me)\b/i },
        { name: "Education", regex: /^(education|academic\s+background|qualifications)\b/i },
        { name: "Skills", regex: /^(technical\s+skills|skills|technologies|competencies)\b/i },
        { name: "Projects", regex: /^(projects|software\s+(engineering\s+)?projects|personal\s+projects|academic\s+projects)\b/i },
        { name: "Experience", regex: /^(work\s+experience|experience|employment\s+history|internships)\b/i },
        { name: "Certifications", regex: /^(certifications|certificates|honors|awards|achievements)\b/i },
    ];

    for (const line of lines) {
        for (const rule of sectionRegexes) {
            if (rule.regex.test(line) && !detectedSections.includes(rule.name)) {
                detectedSections.push(rule.name);
            }
        }
    }

    // Extract email
    const emailMatch = rawText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : "";

    // Extract phone
    const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    const phone = phoneMatch ? phoneMatch[1] : "";

    // Extract GitHub & LinkedIn
    const githubMatch = rawText.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
    const linkedinMatch = rawText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);

    // Initial Name heuristic: First non-empty line
    const fullName = lines[0] && lines[0].length < 40 && !lines[0].includes("@") ? lines[0] : "Candidate";

    // Initial Draft Construction
    const parsedDraft: ResumeContent = {
        contact: {
            fullName,
            headline: "Software Engineer",
            email: email || "",
            phone: phone || "",
            githubUrl: githubMatch ? `https://github.com/${githubMatch[1]}` : "",
            linkedinUrl: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : "",
            includeEmail: true,
            includePhone: Boolean(phone),
            includeLocation: true,
        },
        summary: rawText.slice(0, 300).trim(),
        education: [],
        skills: [{ category: "Imported Skills", items: ["JavaScript", "Python", "React", "Node.js", "SQL"] }],
        projects: [],
        experience: [],
        codingProfiles: [],
        certifications: [],
        sectionOrder: ["contact", "summary", "education", "skills", "projects", "experience", "codingProfiles", "certifications"],
        visibleSections: {
            contact: true,
            summary: true,
            education: detectedSections.includes("Education"),
            skills: detectedSections.includes("Skills"),
            projects: detectedSections.includes("Projects"),
            experience: detectedSections.includes("Experience"),
            codingProfiles: true,
            certifications: detectedSections.includes("Certifications"),
        },
    };

    return {
        rawText,
        pageCount,
        filesizeBytes: fileBuffer.length,
        filename,
        detectedSections,
        parsedDraft,
    };
}
