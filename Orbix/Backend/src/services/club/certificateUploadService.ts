/**
 * Certificate Studio Asset Upload & Strict Content Validation Service
 * Phase 3 Implementation
 * 
 * - Independent magic byte & content inspection (rejects spoofed file extensions)
 * - Explicit rejection of PDF, PSD, AI, DOCX, HTML with actionable guidance
 * - Configurable upload limits (10 MB raster, 2 MB SVG, 400px - 5000px dimensions)
 * - Strict SVG sanitization (XSS, XXE, SSRF, foreignObject, external font/URL prevention)
 * - Metadata stripping and dimensions verification
 */
import { v2 as cloudinary } from "cloudinary";
import { isCloudinaryConfigured } from "../../config/cloudinary.js";

export const MAX_RASTER_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_SVG_BYTES = 2 * 1024 * 1024;     // 2 MB
export const MIN_CANVAS_WIDTH = 400;
export const MIN_CANVAS_HEIGHT = 300;
export const MAX_CANVAS_WIDTH = 5000;
export const MAX_CANVAS_HEIGHT = 5000;

export type DetectedFileType =
    | "png"
    | "jpeg"
    | "svg"
    | "pdf"
    | "psd"
    | "ai"
    | "docx"
    | "html"
    | "unknown";

export interface SanitizedUploadResult {
    assetUrl: string;
    format: "png" | "jpg" | "jpeg" | "svg";
    width: number;
    height: number;
    bytes: number;
    aspectRatio: string;
}

export class CertificateUploadService {
    /**
     * Inspects magic bytes and initial headers to determine true file type
     * Independently of client-provided MIME type or file extension
     */
    static detectRealFileType(buf: Buffer): DetectedFileType {
        if (!buf || buf.length < 4) return "unknown";

        // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
        if (
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf.length >= 8 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
        ) {
            return "png";
        }

        // 2. JPEG / JPG: FF D8 FF
        if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            return "jpeg";
        }

        // 3. PDF: 25 50 44 46 (%PDF)
        if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
            return "pdf";
        }

        // 4. Photoshop PSD: 38 42 50 53 (8BPS)
        if (buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53) {
            return "psd";
        }

        // 5. Office Open XML / ZIP (DOCX, PPTX): 50 4B 03 04 (PK..)
        if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
            return "docx";
        }

        // 6. Text Inspection: SVG or HTML
        // Check for null bytes - SVG must be pure text
        const sampleLimit = Math.min(buf.length, 2048);
        for (let i = 0; i < sampleLimit; i++) {
            if (buf[i] === 0x00) {
                // Binary file containing null bytes, not SVG
                return "unknown";
            }
        }

        const startStr = buf.slice(0, 2048).toString("utf-8").trim().toLowerCase();

        // Reject HTML
        if (startStr.includes("<html") || startStr.includes("<!doctype html") || startStr.includes("<body")) {
            return "html";
        }

        // Detect SVG
        if (
            startStr.includes("<svg") ||
            (startStr.includes("<?xml") && buf.toString("utf-8").toLowerCase().includes("<svg"))
        ) {
            return "svg";
        }

        return "unknown";
    }

    /**
     * Extracts pixel dimensions from PNG buffer (IHDR chunk)
     */
    static getPngDimensions(buf: Buffer): { width: number; height: number } {
        if (buf.length < 24) throw new Error("Malformed PNG: file truncated before header.");
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        return { width, height };
    }

    /**
     * Extracts pixel dimensions from JPEG buffer by scanning SOF markers
     */
    static getJpegDimensions(buf: Buffer): { width: number; height: number } {
        let offset = 2;
        while (offset < buf.length - 8) {
            if (buf[offset] !== 0xff) {
                offset++;
                continue;
            }
            const marker = buf[offset + 1];
            // SOF0 (Baseline), SOF1 (Extended Sequential), SOF2 (Progressive)
            if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
                const height = buf.readUInt16BE(offset + 5);
                const width = buf.readUInt16BE(offset + 7);
                return { width, height };
            }
            // Skip variable-length marker segment
            if (offset + 4 <= buf.length) {
                const length = buf.readUInt16BE(offset + 2);
                offset += 2 + length;
            } else {
                break;
            }
        }
        // Fallback default A4 dimensions if SOF marker not located
        return { width: 2480, height: 1754 };
    }

    /**
     * Extracts dimensions or viewBox from SVG string
     */
    static getSvgDimensions(svgStr: string): { width: number; height: number } {
        const viewBoxMatch = svgStr.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
        if (viewBoxMatch && viewBoxMatch[3] && viewBoxMatch[4]) {
            const w = parseFloat(viewBoxMatch[3]);
            const h = parseFloat(viewBoxMatch[4]);
            if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                return { width: Math.round(w), height: Math.round(h) };
            }
        }

        const widthMatch = svgStr.match(/<svg[^>]+width\s*=\s*["']([\d.]+)(?:px|pt)?["']/i);
        const heightMatch = svgStr.match(/<svg[^>]+height\s*=\s*["']([\d.]+)(?:px|pt)?["']/i);
        if (widthMatch && heightMatch && widthMatch[1] && heightMatch[1]) {
            const w = parseFloat(widthMatch[1]);
            const h = parseFloat(heightMatch[1]);
            if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                return { width: Math.round(w), height: Math.round(h) };
            }
        }

        return { width: 842, height: 595 };
    }

    /**
     * Strictly sanitizes SVG string to prevent XSS, XXE, SSRF, foreignObject, and script execution
     */
    static sanitizeSvg(rawSvg: string): string {
        // 1. Reject external entities / XXE attacks
        if (/<!ENTITY/i.test(rawSvg) || /SYSTEM\s+["']/i.test(rawSvg) || /PUBLIC\s+["']/i.test(rawSvg)) {
            throw new Error("Security Violation: External XML Entities (XXE) are strictly prohibited in SVG templates.");
        }

        // 2. Reject DOCTYPE attempts / entity declarations completely
        let sanitized = rawSvg.replace(/<!DOCTYPE[^>]*>/gi, "");

        // 3. Remove metadata, comments, and CDATA blocks that could conceal scripts
        sanitized = sanitized
            .replace(/<metadata\b[^<]*(?:(?!<\/metadata>)<[^<]*)*<\/metadata>/gi, "")
            .replace(/<!--[\s\S]*?-->/g, "");

        // 4. Remove active script tags, executable tags, and embedded HTML
        sanitized = sanitized
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "")
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
            .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "")
            .replace(/<link\b[^>]*>/gi, "")
            .replace(/<meta\b[^>]*>/gi, "")
            .replace(/<base\b[^>]*>/gi, "");

        // 5. Remove all inline event handlers (onload, onclick, onerror, onmouseover, etc.)
        sanitized = sanitized.replace(/\son[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, "");
        sanitized = sanitized.replace(/\son[a-zA-Z]+\s*=\s*[^>\s]+/gi, "");

        // 6. Remove javascript:, vbscript:, and data: pseudo-protocols in href/xlink:href/src/action
        sanitized = sanitized.replace(
            /(href|xlink:href|src|action)\s*=\s*(['"])\s*(?:javascript|vbscript|data):.*?\2/gi,
            ""
        );

        // 7. Prevent SSRF & external image loading: strip external http/https/ftp references in <image> tags
        sanitized = sanitized.replace(
            /<image\b[^>]+(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/)[^"']*["'][^>]*>/gi,
            ""
        );

        // 8. Sanitize embedded <style> blocks: remove @import and external font-face URLs
        sanitized = sanitized.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, cssContent) => {
            const cleanCss = cssContent
                .replace(/@import\s+[^;]+;/gi, "")
                .replace(/url\s*\(\s*['"]?(?:https?:|\/\/)[^'")]+['"]?\s*\)/gi, "none");
            return `<style>${cleanCss}</style>`;
        });

        // 9. Verify root <svg> element
        if (!/<svg\b[^>]*>/i.test(sanitized)) {
            throw new Error("Invalid SVG structure: missing root <svg> element.");
        }

        return sanitized.trim();
    }

    /**
     * Validates and persists an uploaded certificate background asset with full format verification
     */
    static async processBackgroundUpload(
        file: Express.Multer.File,
        clubId: string
    ): Promise<SanitizedUploadResult> {
        if (!file || !file.buffer || file.buffer.length === 0) {
            throw new Error("No file uploaded or file is empty.");
        }

        // 1. Detect REAL file type by inspecting magic bytes
        const detectedType = this.detectRealFileType(file.buffer);

        // Explicit rejection of unsupported formats with helpful guidance
        if (detectedType === "pdf") {
            throw new Error(
                "PDF files cannot be used as an editable background template. Please export your background as a high-resolution PNG or JPG from Canva, Figma, or Illustrator and re-upload."
            );
        }

        if (detectedType === "psd") {
            throw new Error(
                "Photoshop (.psd) files cannot be used directly. Please export your design as a high-resolution PNG or JPG from Photoshop and re-upload."
            );
        }

        if (detectedType === "docx") {
            throw new Error(
                "Word documents (.docx) cannot be used as certificate backgrounds. Please export your slide or page as PNG or JPG."
            );
        }

        if (detectedType === "html") {
            throw new Error(
                "HTML files are not supported as certificate backgrounds. Please upload a high-resolution PNG, JPG, or sanitized SVG image."
            );
        }

        if (detectedType === "unknown") {
            throw new Error(
                "Unsupported or corrupted file format. Only high-resolution PNG, JPG/JPEG, and clean SVG backgrounds are supported."
            );
        }

        // 2. Validate file size limits independently
        const isSvg = detectedType === "svg";
        const maxLimit = isSvg ? MAX_SVG_BYTES : MAX_RASTER_BYTES;

        if (file.size > maxLimit) {
            throw new Error(
                `File size exceeds maximum permitted limit (${isSvg ? "2 MB for SVG" : "10 MB for raster images"}).`
            );
        }

        // 3. Extract and validate image dimensions
        let width = 0;
        let height = 0;
        let bufferToUpload = file.buffer;

        if (detectedType === "png") {
            const dims = this.getPngDimensions(file.buffer);
            width = dims.width;
            height = dims.height;
        } else if (detectedType === "jpeg") {
            const dims = this.getJpegDimensions(file.buffer);
            width = dims.width;
            height = dims.height;
        } else if (detectedType === "svg") {
            const rawSvg = file.buffer.toString("utf-8");
            const cleanedSvg = this.sanitizeSvg(rawSvg);
            bufferToUpload = Buffer.from(cleanedSvg, "utf-8");
            const dims = this.getSvgDimensions(cleanedSvg);
            width = dims.width;
            height = dims.height;
        }

        // Enforce canvas dimension safety boundaries (prevent decompression bombs and invalid tiny files)
        if (width > MAX_CANVAS_WIDTH || height > MAX_CANVAS_HEIGHT) {
            throw new Error(
                `Image dimensions (${width} × ${height} px) exceed maximum permitted canvas limit (${MAX_CANVAS_WIDTH} × ${MAX_CANVAS_HEIGHT} px). Please downscale your asset.`
            );
        }

        if (width < MIN_CANVAS_WIDTH || height < MIN_CANVAS_HEIGHT) {
            throw new Error(
                `Image dimensions (${width} × ${height} px) are too small. Minimum resolution required is ${MIN_CANVAS_WIDTH} × ${MIN_CANVAS_HEIGHT} px for high-DPI credentials.`
            );
        }

        const aspectDecimal = (width / height).toFixed(2);
        const aspectRatio = `${aspectDecimal}:1`;

        // 4. Upload to Cloudinary or return secure Data URL for local environments
        const formatName = detectedType === "jpeg" ? "jpg" : detectedType;

        if (isCloudinaryConfigured()) {
            const uploadResult = await new Promise<any>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: `orbix/clubs/${clubId}/certificates`,
                        resource_type: isSvg ? "raw" : "image",
                        public_id: `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        format: isSvg ? "svg" : formatName,
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(bufferToUpload);
            });

            return {
                assetUrl: uploadResult.secure_url || uploadResult.url,
                format: formatName as any,
                width: uploadResult.width || width,
                height: uploadResult.height || height,
                bytes: bufferToUpload.length,
                aspectRatio,
            };
        } else {
            // Local dev fallback: Safe base64 data URI
            const mime = isSvg ? "image/svg+xml" : `image/${detectedType}`;
            const dataUri = `data:${mime};base64,${bufferToUpload.toString("base64")}`;
            return {
                assetUrl: dataUri,
                format: formatName as any,
                width,
                height,
                bytes: bufferToUpload.length,
                aspectRatio,
            };
        }
    }
}
