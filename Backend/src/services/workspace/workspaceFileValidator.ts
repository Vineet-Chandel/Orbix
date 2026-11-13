import crypto from "crypto";

export type AssetCategory = "image" | "video" | "document" | "pdf";

export interface FileValidationResult {
    isValid: boolean;
    category?: AssetCategory | undefined;
    normalizedExtension?: string | undefined;
    normalizedMimeType?: string | undefined;
    resourceType?: ("image" | "video" | "raw") | undefined;
    error?: string | undefined;
}

export const ALLOWED_EXTENSIONS_MAP: Record<string, { category: AssetCategory; mimeTypes: string[]; resourceType: "image" | "video" | "raw" }> = {
    // Images
    png: { category: "image", mimeTypes: ["image/png"], resourceType: "image" },
    jpg: { category: "image", mimeTypes: ["image/jpeg", "image/pjpeg"], resourceType: "image" },
    jpeg: { category: "image", mimeTypes: ["image/jpeg", "image/pjpeg"], resourceType: "image" },
    webp: { category: "image", mimeTypes: ["image/webp"], resourceType: "image" },
    gif: { category: "image", mimeTypes: ["image/gif"], resourceType: "image" },

    // Videos
    mp4: { category: "video", mimeTypes: ["video/mp4"], resourceType: "video" },
    mov: { category: "video", mimeTypes: ["video/quicktime"], resourceType: "video" },
    webm: { category: "video", mimeTypes: ["video/webm"], resourceType: "video" },

    // PDFs
    pdf: { category: "pdf", mimeTypes: ["application/pdf"], resourceType: "image" }, // Using "image" allows Cloudinary page-1 thumbnail generation

    // Documents
    doc: { category: "document", mimeTypes: ["application/msword"], resourceType: "raw" },
    docx: { category: "document", mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], resourceType: "raw" },
    xls: { category: "document", mimeTypes: ["application/vnd.ms-excel"], resourceType: "raw" },
    xlsx: { category: "document", mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], resourceType: "raw" },
    ppt: { category: "document", mimeTypes: ["application/vnd.ms-powerpoint"], resourceType: "raw" },
    pptx: { category: "document", mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], resourceType: "raw" },
    txt: { category: "document", mimeTypes: ["text/plain"], resourceType: "raw" },
    csv: { category: "document", mimeTypes: ["text/csv", "application/csv", "text/plain"], resourceType: "raw" },
    zip: { category: "document", mimeTypes: ["application/zip", "application/x-zip-compressed"], resourceType: "raw" },
};

export const BLOCKED_EXTENSIONS = new Set([
    "svg", "svgz", "html", "htm", "xhtml", "xml", "js", "mjs", "cjs", "ts",
    "jsx", "tsx", "php", "py", "sh", "bash", "exe", "bat", "cmd", "ps1",
    "vbs", "scr", "msi", "jar", "apk", "app", "dll", "so", "dylib"
]);

export const BLOCKED_MIME_TYPES = new Set([
    "image/svg+xml",
    "text/html",
    "application/xhtml+xml",
    "text/javascript",
    "application/javascript",
    "application/x-sh",
    "application/x-msdownload",
    "application/x-executable",
    "application/x-sharedlib"
]);

export const CATEGORY_SIZE_LIMITS: Record<AssetCategory, number> = {
    image: 10 * 1024 * 1024,      // 10 MB
    video: 100 * 1024 * 1024,    // 100 MB
    pdf: 25 * 1024 * 1024,       // 25 MB
    document: 25 * 1024 * 1024   // 25 MB
};

export const DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

/**
 * Validates filename, extension, mimeType, and size without inspecting binary content.
 */
export function validateFileMetadata(
    filename: string,
    mimeType: string,
    sizeBytes: number
): FileValidationResult {
    if (!filename || typeof filename !== "string") {
        return { isValid: false, error: "Filename is required" };
    }

    // Check directory traversal or null byte injection
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || filename.includes("\0")) {
        return { isValid: false, error: "Invalid characters in filename" };
    }

    const parts = filename.trim().split(".");
    if (parts.length < 2) {
        return { isValid: false, error: "File must have a valid extension" };
    }

    const ext = parts.pop()!.toLowerCase();
    const cleanMime = mimeType?.trim().toLowerCase() || "";

    // Reject blocked extensions explicitly (e.g. SVG / HTML XSS vectors)
    if (BLOCKED_EXTENSIONS.has(ext)) {
        return { isValid: false, error: `Files of type .${ext} are strictly prohibited for security reasons` };
    }

    if (BLOCKED_MIME_TYPES.has(cleanMime)) {
        return { isValid: false, error: `MIME type ${cleanMime} is strictly prohibited for security reasons` };
    }

    const allowedConfig = ALLOWED_EXTENSIONS_MAP[ext];
    if (!allowedConfig) {
        return { isValid: false, error: `Unsupported file extension .${ext}` };
    }

    // Validate size limit
    const maxLimit = CATEGORY_SIZE_LIMITS[allowedConfig.category];
    if (sizeBytes <= 0) {
        return { isValid: false, error: "File cannot be empty" };
    }
    if (sizeBytes > maxLimit) {
        const mb = Math.round(maxLimit / (1024 * 1024));
        return { isValid: false, error: `File exceeds maximum allowed size of ${mb}MB for ${allowedConfig.category} assets` };
    }

    return {
        isValid: true,
        category: allowedConfig.category,
        normalizedExtension: ext,
        normalizedMimeType: cleanMime || allowedConfig.mimeTypes[0],
        resourceType: allowedConfig.resourceType,
    };
}

/**
 * Inspects binary magic numbers and protects against disguised SVG/HTML XSS payloads.
 */
export function validateBufferMagicBytes(
    buffer: Buffer,
    declaredFilename: string,
    declaredMime: string
): FileValidationResult {
    const metaValidation = validateFileMetadata(declaredFilename, declaredMime, buffer.length);
    if (!metaValidation.isValid) {
        return metaValidation;
    }

    const ext = metaValidation.normalizedExtension!;

    // Scan text representation of buffer for XSS / HTML payloads
    const sampleSize = Math.min(buffer.length, 4096);
    const headText = buffer.toString("utf8", 0, sampleSize).toLowerCase();

    // Stored XSS defense: SVG and HTML inspection
    const maliciousPatterns = [
        "<svg",
        "<!doctype html",
        "<html",
        "<script",
        "onload=",
        "onerror=",
        "javascript:",
        "xmlns=\"http://www.w3.org/2000/svg\"",
        "xmlns='http://www.w3.org/2000/svg'"
    ];

    for (const pattern of maliciousPatterns) {
        if (headText.includes(pattern)) {
            return {
                isValid: false,
                error: "File contains potentially malicious HTML/SVG markup and cannot be uploaded"
            };
        }
    }

    // Binary magic bytes inspection
    if (ext === "png") {
        // PNG magic: 89 50 4E 47 0D 0A 1A 0A
        if (
            buffer.length < 8 ||
            buffer[0] !== 0x89 ||
            buffer[1] !== 0x50 ||
            buffer[2] !== 0x4e ||
            buffer[3] !== 0x47 ||
            buffer[4] !== 0x0d ||
            buffer[5] !== 0x0a ||
            buffer[6] !== 0x1a ||
            buffer[7] !== 0x0a
        ) {
            return { isValid: false, error: "File corrupted or invalid PNG signature" };
        }
    } else if (ext === "jpg" || ext === "jpeg") {
        // JPEG magic: FF D8 FF
        if (
            buffer.length < 3 ||
            buffer[0] !== 0xff ||
            buffer[1] !== 0xd8 ||
            buffer[2] !== 0xff
        ) {
            return { isValid: false, error: "File corrupted or invalid JPEG signature" };
        }
    } else if (ext === "gif") {
        // GIF magic: "GIF87a" or "GIF89a"
        const gifHeader = buffer.toString("ascii", 0, 4);
        if (gifHeader !== "GIF8") {
            return { isValid: false, error: "File corrupted or invalid GIF signature" };
        }
    } else if (ext === "webp") {
        // WEBP magic: "RIFF" at 0..3 and "WEBP" at 8..11
        if (buffer.length < 12) {
            return { isValid: false, error: "File too small to be valid WEBP" };
        }
        const riff = buffer.toString("ascii", 0, 4);
        const webp = buffer.toString("ascii", 8, 12);
        if (riff !== "RIFF" || webp !== "WEBP") {
            return { isValid: false, error: "File corrupted or invalid WEBP signature" };
        }
    } else if (ext === "pdf") {
        // PDF magic: %PDF-
        if (buffer.length < 5) {
            return { isValid: false, error: "File too small to be valid PDF" };
        }
        const pdfHeader = buffer.toString("ascii", 0, 5);
        if (!pdfHeader.startsWith("%PDF")) {
            return { isValid: false, error: "File corrupted or invalid PDF signature" };
        }
    } else if (ext === "mp4" || ext === "mov") {
        // MP4 / MOV magic: ftyp at bytes 4..7 or moov
        if (buffer.length < 8) {
            return { isValid: false, error: "File too small to be valid MP4/MOV" };
        }
        const boxType = buffer.toString("ascii", 4, 8);
        const validBoxes = ["ftyp", "moov", "wide", "mdat", "free"];
        if (!validBoxes.includes(boxType)) {
            return { isValid: false, error: "Invalid video container signature" };
        }
    } else if (ext === "webm") {
        // WebM EBML header: 1A 45 DF A3
        if (
            buffer.length < 4 ||
            buffer[0] !== 0x1a ||
            buffer[1] !== 0x45 ||
            buffer[2] !== 0xdf ||
            buffer[3] !== 0xa3
        ) {
            return { isValid: false, error: "Invalid WebM EBML signature" };
        }
    } else if (ext === "zip" || ext === "docx" || ext === "xlsx" || ext === "pptx") {
        // ZIP format (PK\x03\x04 or PK\x05\x06)
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
            return { isValid: false, error: `Invalid ${ext.toUpperCase()} archive signature` };
        }
    } else if (ext === "doc" || ext === "xls" || ext === "ppt") {
        // OLE2 Compound Document header: D0 CF 11 E0 A1 B1 1A E1
        if (
            buffer.length >= 8 &&
            (buffer[0] !== 0xd0 || buffer[1] !== 0xcf || buffer[2] !== 0x11 || buffer[3] !== 0xe0)
        ) {
            return { isValid: false, error: `Invalid ${ext.toUpperCase()} document signature` };
        }
    }

    return metaValidation;
}

/**
 * Calculates SHA-256 hex checksum
 */
export function computeSha256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}
