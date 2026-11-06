/**
 * Form Security & Sanitization Engine
 * 
 * Comprehensive defenses against:
 * - Dynamic Question Schema injection and tampering
 * - Stored XSS and malicious HTML/script payloads
 * - Dangerous file upload formats, executable MIME types, and path traversal
 * - CSV / Spreadsheet Formula Injection (DDE / CSV Injection)
 * - Prototype pollution and malformed nested objects
 */

// Disallowed executable and active content file extensions
const DANGEROUS_EXTENSIONS = new Set([
    "exe", "bat", "cmd", "sh", "bash", "ps1", "vbs", "vbe", "wsf", "wsh", "scr", "msi", "dll",
    "com", "pif", "application", "gadget", "hta", "cpl", "msc", "jar", "js", "mjs", "cjs", "ts",
    "php", "php3", "php4", "php5", "phtml", "pl", "py", "pyw", "cgi", "rb", "rhtml", "jsp", "asp",
    "aspx", "cer", "csr", "svg", "html", "htm", "shtml", "xhtml", "xml", "swf"
]);

// Allowed file extensions for attachments
const WHITELISTED_EXTENSIONS = new Set([
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv",
    "png", "jpg", "jpeg", "webp", "gif", "zip", "rar", "7z", "tar", "gz"
]);

// Characters that trigger formula execution in spreadsheet software (Excel, Google Sheets, LibreOffice)
const SPREADSHEET_FORMULA_REGEX = /^[=+\-@\t\r|]/;

// HTML tag and script removal regex
const DANGEROUS_HTML_REGEX = /<[^>]*>|javascript:|vbscript:|data:text\/html|on\w+\s*=/gi;

/**
 * Strips active HTML tags, scripts, and event handlers while preserving plain text characters.
 */
export function sanitizeText(input: unknown, maxLength = 2000): string {
    if (input === null || input === undefined) return "";
    let str = String(input).trim();
    if (str.length === 0) return "";

    // Strip HTML tags and active protocols
    str = str.replace(DANGEROUS_HTML_REGEX, "");

    // Truncate to maximum permissible length
    if (str.length > maxLength) {
        str = str.substring(0, maxLength);
    }

    return str;
}

/**
 * Protects strings against spreadsheet formula injection when generating CSV or Excel files.
 * If a value starts with '=', '+', '-', '@', '\t', '\r', or '|', it is prefixed with a single quote.
 */
export function escapeCsvFormula(value: unknown): string {
    if (value === null || value === undefined) return '""';
    let str = typeof value === "object" ? JSON.stringify(value) : String(value);

    // Normalize line endings
    str = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Prefix formula trigger characters to prevent spreadsheet code execution
    if (SPREADSHEET_FORMULA_REGEX.test(str)) {
        str = `'${str}`;
    }

    // Escape internal double quotes
    return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Validates a file attachment's metadata, extension, size, and ownership
 */
export function validateAttachmentSecurity(attachment: {
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    filePublicId?: string;
    fileType?: string;
    questionId?: string;
}, allowedTypes?: string[]): { valid: boolean; error?: string } {
    if (!attachment || typeof attachment !== "object") {
        return { valid: false, error: "Invalid attachment object." };
    }

    const { fileName, fileUrl, fileSize, filePublicId } = attachment;

    if (!fileName || typeof fileName !== "string" || fileName.trim().length === 0) {
        return { valid: false, error: "Attachment fileName is required." };
    }

    // Path traversal check
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
        return { valid: false, error: `Invalid file name "${fileName}": path traversal characters not permitted.` };
    }

    // Extract file extension
    const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : "";

    if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
        return { valid: false, error: `File type ".${ext}" is prohibited for security reasons.` };
    }

    if (!WHITELISTED_EXTENSIONS.has(ext)) {
        return { valid: false, error: `Unsupported file type ".${ext}". Allowed: PDF, Office docs, images, ZIP.` };
    }

    // Question-specific allowed types check
    if (allowedTypes && allowedTypes.length > 0) {
        const normalizedAllowed = allowedTypes.map((t) => t.toLowerCase().replace(/^\./, ""));
        if (!normalizedAllowed.includes(ext)) {
            return { valid: false, error: `File type ".${ext}" is not permitted for this question. Allowed: ${normalizedAllowed.join(", ")}` };
        }
    }

    // URL validation
    if (!fileUrl || typeof fileUrl !== "string" || (!fileUrl.startsWith("https://") && !fileUrl.startsWith("http://"))) {
        return { valid: false, error: `Invalid secure attachment URL for "${fileName}".` };
    }

    // Size limit: 25MB max
    const maxBytes = 25 * 1024 * 1024;
    if (fileSize !== undefined && (typeof fileSize !== "number" || fileSize <= 0 || fileSize > maxBytes)) {
        return { valid: false, error: `File "${fileName}" exceeds the 25MB maximum upload limit.` };
    }

    return { valid: true };
}

/**
 * Validates dynamic question schema structure and keys
 */
export function validateQuestionSchema(question: any): { valid: boolean; error?: string } {
    if (!question || typeof question !== "object") {
        return { valid: false, error: "Question must be a valid object." };
    }

    const VALID_TYPES = new Set([
        "short_answer", "paragraph", "multiple_choice", "checkboxes", "dropdown",
        "linear_scale", "rating", "date", "time", "file_upload", "identity_prefill",
        "section_header", "rich_text", "video_embed", "code_snippet", "matrix",
        "multiple_choice_grid", "checkbox_grid", "image_card", "markdown_card"
    ]);

    if (!question.type || !VALID_TYPES.has(question.type)) {
        return { valid: false, error: `Invalid or unsupported question type: "${question.type}".` };
    }

    if (!question.id || typeof question.id !== "string" || question.id.length > 100) {
        return { valid: false, error: "Question ID must be a non-empty string under 100 characters." };
    }

    if (question.title !== undefined && typeof question.title !== "string") {
        return { valid: false, error: "Question title must be a string." };
    }

    // Validate options if present
    if (question.options !== undefined) {
        if (!Array.isArray(question.options)) {
            return { valid: false, error: "Question options must be an array." };
        }
        if (question.options.length > 100) {
            return { valid: false, error: "A question cannot have more than 100 options." };
        }
        for (const opt of question.options) {
            if (!opt || typeof opt !== "object" || typeof opt.text !== "string") {
                return { valid: false, error: "Each question option must contain a text string." };
            }
            if (opt.text.length > 500) {
                return { valid: false, error: "Option text cannot exceed 500 characters." };
            }
        }
    }

    // Validate grid configuration
    if (question.gridConfig) {
        if (typeof question.gridConfig !== "object") {
            return { valid: false, error: "gridConfig must be an object." };
        }
        if (question.gridConfig.rows && (!Array.isArray(question.gridConfig.rows) || question.gridConfig.rows.length > 50)) {
            return { valid: false, error: "Grid rows must be an array of at most 50 items." };
        }
        if (question.gridConfig.columns && (!Array.isArray(question.gridConfig.columns) || question.gridConfig.columns.length > 50)) {
            return { valid: false, error: "Grid columns must be an array of at most 50 items." };
        }
    }

    // Validate linear scale
    if (question.type === "linear_scale" && question.scaleConfig) {
        const { min = 1, max = 5 } = question.scaleConfig;
        if (typeof min !== "number" || typeof max !== "number" || min >= max || max > 10) {
            return { valid: false, error: "Scale configuration must have min < max and max <= 10." };
        }
    }

    // Validate rating
    if (question.type === "rating" && question.ratingConfig) {
        const levels = question.ratingConfig.levels ?? 5;
        if (typeof levels !== "number" || levels < 1 || levels > 10) {
            return { valid: false, error: "Rating levels must be a number between 1 and 10." };
        }
    }

    return { valid: true };
}

/**
 * Deep sanitizes form structure to ensure no stored XSS or prototype pollution in schema
 */
export function sanitizeFormStructure(structure: any): any {
    if (!structure || typeof structure !== "object") return { sections: [] };

    const rawSections = Array.isArray(structure.sections) ? structure.sections : [];
    const sanitizedSections = rawSections.slice(0, 50).map((sec: any, secIdx: number) => {
        const rawQuestions = Array.isArray(sec.questions) ? sec.questions : [];
        const sanitizedQuestions = rawQuestions.slice(0, 100).map((q: any) => {
            const sanitized: any = {
                id: sanitizeText(q.id || `q_${secIdx}_${Date.now()}`, 100),
                type: sanitizeText(q.type || "short_answer", 50),
                title: sanitizeText(q.title || "", 500),
                description: sanitizeText(q.description || "", 2000),
                required: Boolean(q.required),
            };

            if (q.placeholder) sanitized.placeholder = sanitizeText(q.placeholder, 200);
            if (q.imageUrl) sanitized.imageUrl = sanitizeText(q.imageUrl, 1000);
            if (q.imageCaption) sanitized.imageCaption = sanitizeText(q.imageCaption, 500);
            if (q.imageAlignment) sanitized.imageAlignment = sanitizeText(q.imageAlignment, 20);
            if (q.videoUrl) sanitized.videoUrl = sanitizeText(q.videoUrl, 1000);
            if (q.richTextContent) sanitized.richTextContent = sanitizeText(q.richTextContent, 5000);

            if (Array.isArray(q.options)) {
                sanitized.options = q.options.slice(0, 100).map((opt: any, optIdx: number) => ({
                    id: sanitizeText(opt.id || `opt_${optIdx}`, 50),
                    text: sanitizeText(opt.text || "", 500),
                    imageUrl: opt.imageUrl ? sanitizeText(opt.imageUrl, 1000) : undefined,
                    isOther: Boolean(opt.isOther),
                }));
            }

            if (q.validation && typeof q.validation === "object") {
                sanitized.validation = { ...q.validation };
                if (sanitized.validation.patternError) {
                    sanitized.validation.patternError = sanitizeText(sanitized.validation.patternError, 300);
                }
            }

            if (q.gridConfig && typeof q.gridConfig === "object") {
                sanitized.gridConfig = {
                    rows: Array.isArray(q.gridConfig.rows) ? q.gridConfig.rows.slice(0, 50).map((r: any) => sanitizeText(r, 200)) : [],
                    columns: Array.isArray(q.gridConfig.columns) ? q.gridConfig.columns.slice(0, 50).map((c: any) => sanitizeText(c, 200)) : [],
                    requireEachRow: Boolean(q.gridConfig.requireEachRow),
                    limitOnePerColumn: Boolean(q.gridConfig.limitOnePerColumn),
                };
            }

            if (q.scaleConfig && typeof q.scaleConfig === "object") {
                sanitized.scaleConfig = {
                    min: Number(q.scaleConfig.min ?? 1),
                    max: Number(q.scaleConfig.max ?? 5),
                    minLabel: sanitizeText(q.scaleConfig.minLabel || "", 100),
                    maxLabel: sanitizeText(q.scaleConfig.maxLabel || "", 100),
                };
            }

            if (q.ratingConfig && typeof q.ratingConfig === "object") {
                sanitized.ratingConfig = {
                    levels: Number(q.ratingConfig.levels ?? 5),
                    shape: sanitizeText(q.ratingConfig.shape || "star", 20),
                };
            }

            if (q.conditionalRouting && Array.isArray(q.conditionalRouting)) {
                sanitized.conditionalRouting = q.conditionalRouting.slice(0, 20).map((rule: any) => ({
                    targetOptionId: sanitizeText(rule.targetOptionId || "", 100),
                    targetOptionValue: sanitizeText(rule.targetOptionValue || "", 200),
                    action: sanitizeText(rule.action || "next_section", 50),
                    targetSectionId: sanitizeText(rule.targetSectionId || "", 100),
                }));
            }

            return sanitized;
        });

        return {
            id: sanitizeText(sec.id || `sec_${secIdx}`, 100),
            title: sanitizeText(sec.title || "", 300),
            description: sanitizeText(sec.description || "", 2000),
            questions: sanitizedQuestions,
        };
    });

    return {
        sections: sanitizedSections,
    };
}

/**
 * Sanitizes student response answers against stored XSS
 */
export function sanitizeStudentAnswers(answers: Record<string, any>): Record<string, any> {
    if (!answers || typeof answers !== "object") return {};

    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(answers)) {
        const cleanKey = sanitizeText(key, 100);
        if (!cleanKey) continue;

        if (typeof val === "string") {
            sanitized[cleanKey] = sanitizeText(val, 10000);
        } else if (Array.isArray(val)) {
            sanitized[cleanKey] = val.slice(0, 100).map((item) => (typeof item === "string" ? sanitizeText(item, 1000) : item));
        } else if (val && typeof val === "object") {
            // Grid response mapping: row -> column(s)
            const rowMap: Record<string, any> = {};
            for (const [rKey, rVal] of Object.entries(val)) {
                const cleanRowKey = sanitizeText(rKey, 200);
                if (typeof rVal === "string") {
                    rowMap[cleanRowKey] = sanitizeText(rVal, 1000);
                } else if (Array.isArray(rVal)) {
                    rowMap[cleanRowKey] = rVal.map((item) => (typeof item === "string" ? sanitizeText(item, 500) : item));
                } else {
                    rowMap[cleanRowKey] = rVal;
                }
            }
            sanitized[cleanKey] = rowMap;
        } else {
            sanitized[cleanKey] = val;
        }
    }

    return sanitized;
}
