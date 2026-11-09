/**
 * Certificate Studio PDF Generation & Rendering Engine
 * Built with pdf-lib & qrcode for deterministic, pure-JS vector rendering
 * Phase 9 & Phase 16 Implementation
 */
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import QRCode from "qrcode";
import crypto from "crypto";
import type { CertificateDesign, CertificateElement, DynamicDataSnapshot } from "../../types/certificateStudio.js";

export interface RenderPdfResult {
    pdfBuffer: Buffer;
    sha256Hash: string;
    pageCount: number;
    warnings?: string[] | undefined;
}

export class CertificatePdfService {
    /**
     * Sanitizes string for WinAnsi-encoded StandardFonts (Helvetica, Times, Courier)
     * Transliterates small caps, normalizes diacritics, strips unencodable characters
     */
    static sanitizeForPdf(text: string): string {
        if (!text) return "";

        // 1. NFKD normalization decomposes accents and letters
        const normalized = text.normalize("NFKD");

        // 2. Transliteration dictionary for small caps and common Unicode stylistic variants
        const smallCapsMap: Record<string, string> = {
            'ᴀ': 'A', 'ʙ': 'B', 'ᴄ': 'C', 'ᴅ': 'D', 'ᴇ': 'E', 'ꜰ': 'F', 'ɢ': 'G', 'ʜ': 'H',
            'ɪ': 'I', 'ᴊ': 'J', 'ᴋ': 'K', 'ʟ': 'L', 'ᴍ': 'M', 'ɴ': 'N', 'ᴏ': 'O', 'ᴘ': 'P',
            'ǫ': 'Q', 'ʀ': 'R', 'ꜱ': 'S', 'ᴛ': 'T', 'ᴜ': 'U', 'ᴠ': 'V', 'ᴡ': 'W', 'x': 'X',
            'ʏ': 'Y', 'ᴢ': 'Z',
            '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...',
            '•': '*', '·': '*', '‚': ',', '„': '"'
        };

        let result = "";
        for (const char of normalized) {
            if (smallCapsMap[char]) {
                result += smallCapsMap[char];
            } else {
                const code = char.charCodeAt(0);
                // Standard printable ASCII (0x20 to 0x7E) + newline/carriage return
                if ((code >= 0x20 && code <= 0x7E) || code === 0x0A || code === 0x0D || code === 0x09) {
                    result += char;
                } else if (code >= 0xA0 && code <= 0xFF) {
                    // Latin-1 Supplement supported by WinAnsi
                    result += char;
                } else if (code >= 0x0300 && code <= 0x036F) {
                    // Skip decomposed combining diacritical marks
                    continue;
                } else {
                    // Fallback to ASCII approximation or space
                    result += " ";
                }
            }
        }

        return result;
    }

    /**
     * Resolves a dynamic fieldKey token (e.g. "recipient.name") against the recipient snapshot
     */
    static resolveFieldKey(fieldKey: string | undefined, snapshot: DynamicDataSnapshot, fallback = ""): string {
        if (!fieldKey) return fallback;

        const parts = fieldKey.split(".");
        let current: any = snapshot;

        for (const part of parts) {
            if (current == null) break;
            current = current[part];
        }

        if (current !== undefined && current !== null && current !== "") {
            return String(current);
        }

        // Check common aliases and fallback mappings
        if (
            (fieldKey === "recipient.fullName" || fieldKey === "recipient.name" || fieldKey === "recipient_name" || fieldKey === "recipientName") &&
            (snapshot.recipient?.name || snapshot.recipient?.fullName)
        ) {
            return snapshot.recipient.name || snapshot.recipient.fullName || fallback;
        }
        if ((fieldKey === "recipient.institution" || fieldKey === "recipient_institution") && snapshot.recipient?.collegeName) {
            return snapshot.recipient.collegeName;
        }
        if (
            (fieldKey === "event.name" || fieldKey === "event.title" || fieldKey === "event_name" || fieldKey === "event_title") &&
            (snapshot.event?.title || snapshot.event?.name)
        ) {
            return snapshot.event.title || snapshot.event.name || fallback;
        }
        if ((fieldKey === "award.position" || fieldKey === "position" || fieldKey === "award_position") && snapshot.award?.position) {
            return snapshot.award.position;
        }
        if ((fieldKey === "award.title" || fieldKey === "award_title") && snapshot.award?.title) {
            return snapshot.award.title;
        }
        if ((fieldKey === "award.achievement" || fieldKey === "achievement") && (snapshot.award as any)?.achievement) {
            return (snapshot.award as any).achievement;
        }
        if ((fieldKey === "team.name" || fieldKey === "team_name" || fieldKey === "teamName") && snapshot.team?.name) {
            return snapshot.team.name;
        }
        if ((fieldKey === "certificate.number" || fieldKey === "credential_code" || fieldKey === "credentialCode") && snapshot.certificate?.credentialCode) {
            return snapshot.certificate.credentialCode;
        }
        const customKey = parts[1];
        if (parts[0] === "custom" && customKey && snapshot.custom && snapshot.custom[customKey]) {
            return String(snapshot.custom[customKey]);
        }

        return fallback;
    }

    /**
     * Converts hex color string (#RRGGBB) to pdf-lib rgb(r, g, b)
     */
    static hexToRgb(hex = "#000000") {
        let clean = hex.replace("#", "").trim();
        if (clean.length === 3) {
            clean = clean.split("").map((c) => c + c).join("");
        }
        if (clean.length !== 6) {
            return rgb(0, 0, 0);
        }

        const r = parseInt(clean.substring(0, 2), 16) / 255;
        const g = parseInt(clean.substring(2, 4), 16) / 255;
        const b = parseInt(clean.substring(4, 6), 16) / 255;

        return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
    }

    // Static asset cache for reusing fetched/decoded background artwork across multiple recipients in a batch (Phase 19)
    private static assetCache = new Map<string, { buffer: Buffer; isPng: boolean; cachedAt: number }>();

    /**
     * Clears in-memory template asset cache
     */
    static clearAssetCache(): void {
        this.assetCache.clear();
    }

    /**
     * Returns current number of cached template assets
     */
    static getAssetCacheSize(): number {
        return this.assetCache.size;
    }

    /**
     * Prefetches and caches remote asset in memory to avoid repeated network round-trips
     */
    static async prefetchAsset(
        url: string,
        localCache?: Map<string, { buffer: Buffer; isPng: boolean }>
    ): Promise<{ buffer: Buffer; isPng: boolean } | null> {
        if (!url) return null;
        const cached = localCache?.get(url) || this.assetCache.get(url);
        if (cached && (Date.now() - (cached as any).cachedAt < 3600000 || !(cached as any).cachedAt)) {
            return { buffer: cached.buffer, isPng: cached.isPng };
        }

        try {
            if (url.startsWith("data:image/png;base64,")) {
                const buffer = Buffer.from(url.replace("data:image/png;base64,", ""), "base64");
                const entry = { buffer, isPng: true, cachedAt: Date.now() };
                this.assetCache.set(url, entry);
                if (localCache) localCache.set(url, { buffer, isPng: true });
                return entry;
            } else if (url.startsWith("data:image/jpeg;base64,") || url.startsWith("data:image/jpg;base64,")) {
                const buffer = Buffer.from(url.replace(/^data:image\/(jpeg|jpg);base64,/, ""), "base64");
                const entry = { buffer, isPng: false, cachedAt: Date.now() };
                this.assetCache.set(url, entry);
                if (localCache) localCache.set(url, { buffer, isPng: false });
                return entry;
            } else if (url.startsWith("http://") || url.startsWith("https://")) {
                const fetchRes = await fetch(url);
                if (fetchRes.ok) {
                    const arrayBuf = await fetchRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuf);
                    const isPng = url.toLowerCase().endsWith(".png");
                    const entry = { buffer, isPng, cachedAt: Date.now() };
                    this.assetCache.set(url, entry);
                    if (localCache) localCache.set(url, { buffer, isPng });
                    return entry;
                }
            }
        } catch (err) {
            console.warn(`[CertificatePdfService] Asset prefetch failed for ${url}:`, err);
        }
        return null;
    }

    /**
     * Renders a high-resolution PDF from a CertificateDesign and DynamicDataSnapshot
     */
    static async renderCertificatePdf(
        design: CertificateDesign,
        snapshot: DynamicDataSnapshot,
        verificationBaseUrl: string = "https://orbix.dev",
        options?: { assetCache?: Map<string, { buffer: Buffer; isPng: boolean }> }
    ): Promise<RenderPdfResult> {
        const doc = await PDFDocument.create();

        const width = design.page.width || (design.page.orientation === "portrait" ? 595 : 842);
        const height = design.page.height || (design.page.orientation === "portrait" ? 842 : 595);

        const page = doc.addPage([width, height]);

        // Embed standard fonts for reliable rendering
        const fontSans = await doc.embedFont(StandardFonts.Helvetica);
        const fontSansBold = await doc.embedFont(StandardFonts.HelveticaBold);
        const fontSerif = await doc.embedFont(StandardFonts.TimesRoman);
        const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
        const fontMono = await doc.embedFont(StandardFonts.Courier);
        const fontMonoBold = await doc.embedFont(StandardFonts.CourierBold);

        // 1. Render Background
        const bg = design.background;
        const bgColor = bg.color ? this.hexToRgb(bg.color) : rgb(1, 1, 1);
        page.drawRectangle({
            x: 0,
            y: 0,
            width,
            height,
            color: bgColor,
        });

        const warnings: string[] = [];

        // Validate required recipient information
        if (!snapshot.recipient?.name || snapshot.recipient.name.trim().length === 0) {
            warnings.push("Recipient name is missing or empty in data snapshot.");
        }
        if (!snapshot.certificate?.credentialCode) {
            warnings.push("Credential verification code is missing.");
        }

        // Embed background image asset if present (Phase 9 & Phase 19 asset reuse)
        const bgImageUrl = bg.imageUrl || (bg as any).assetUrl;
        if (bgImageUrl) {
            try {
                let bgImgBuffer: Buffer | null = null;
                let isPng = false;

                // Check cache first to avoid re-fetching on batch runs
                const cached = options?.assetCache?.get(bgImageUrl) || this.assetCache.get(bgImageUrl);
                if (cached) {
                    bgImgBuffer = cached.buffer;
                    isPng = cached.isPng;
                } else if (bgImageUrl.startsWith("data:image/png;base64,")) {
                    bgImgBuffer = Buffer.from(bgImageUrl.replace("data:image/png;base64,", ""), "base64");
                    isPng = true;
                    this.assetCache.set(bgImageUrl, { buffer: bgImgBuffer, isPng: true, cachedAt: Date.now() });
                } else if (
                    bgImageUrl.startsWith("data:image/jpeg;base64,") ||
                    bgImageUrl.startsWith("data:image/jpg;base64,")
                ) {
                    bgImgBuffer = Buffer.from(bgImageUrl.replace(/^data:image\/(jpeg|jpg);base64,/, ""), "base64");
                    isPng = false;
                    this.assetCache.set(bgImageUrl, { buffer: bgImgBuffer, isPng: false, cachedAt: Date.now() });
                } else if (bgImageUrl.startsWith("http://") || bgImageUrl.startsWith("https://")) {
                    const fetchRes = await fetch(bgImageUrl);
                    if (fetchRes.ok) {
                        const arrayBuf = await fetchRes.arrayBuffer();
                        bgImgBuffer = Buffer.from(arrayBuf);
                        isPng = bgImageUrl.toLowerCase().endsWith(".png");
                        this.assetCache.set(bgImageUrl, { buffer: bgImgBuffer, isPng, cachedAt: Date.now() });
                        if (options?.assetCache) {
                            options.assetCache.set(bgImageUrl, { buffer: bgImgBuffer, isPng });
                        }
                    }
                }

                if (bgImgBuffer) {
                    const embeddedBg = isPng ? await doc.embedPng(bgImgBuffer) : await doc.embedJpg(bgImgBuffer);
                    page.drawImage(embeddedBg, {
                        x: 0,
                        y: 0,
                        width,
                        height,
                    });
                }
            } catch (bgErr) {
                console.error("[CertificatePdfService] Background image embed warning:", bgErr);
                warnings.push("Failed to embed background artwork asset in PDF.");
            }
        }

        // Background decorative border if specified
        if (bg.borderStyle && bg.borderStyle !== "none") {
            const borderColor = bg.borderColor ? this.hexToRgb(bg.borderColor) : rgb(0.1, 0.1, 0.1);
            const borderWidth = bg.borderWidth || 6;
            const inset = borderWidth + 12;

            if (bg.borderStyle === "double") {
                // Outer border
                page.drawRectangle({
                    x: 10,
                    y: 10,
                    width: width - 20,
                    height: height - 20,
                    borderColor,
                    borderWidth: 2,
                });
                // Inner border
                page.drawRectangle({
                    x: inset,
                    y: inset,
                    width: width - inset * 2,
                    height: height - inset * 2,
                    borderColor,
                    borderWidth: borderWidth,
                });
            } else if (bg.borderStyle === "ornate") {
                // Outer gold/accent
                page.drawRectangle({
                    x: 12,
                    y: 12,
                    width: width - 24,
                    height: height - 24,
                    borderColor,
                    borderWidth: 4,
                });
                // Inner thin border
                page.drawRectangle({
                    x: 20,
                    y: 20,
                    width: width - 40,
                    height: height - 40,
                    borderColor,
                    borderWidth: 1.5,
                });
            } else if (bg.borderStyle === "neo-brutalist") {
                // Neo-brutalist high contrast heavy border
                const nbBorderWidth = Math.max(borderWidth, 8);
                page.drawRectangle({
                    x: 16,
                    y: 16,
                    width: width - 32,
                    height: height - 32,
                    borderColor,
                    borderWidth: nbBorderWidth,
                });
                // Top accent band if configured
                if (bg.accentColor) {
                    const accColor = this.hexToRgb(bg.accentColor);
                    page.drawRectangle({
                        x: 16 + nbBorderWidth / 2,
                        y: height - 16 - nbBorderWidth / 2 - 10,
                        width: width - 32 - nbBorderWidth,
                        height: 10,
                        color: accColor,
                    });
                }
            } else {
                // Solid / Modern border
                page.drawRectangle({
                    x: 16,
                    y: 16,
                    width: width - 32,
                    height: height - 32,
                    borderColor,
                    borderWidth: Math.min(borderWidth, 8),
                });
            }
        }

        // Helper to split multi-line text by words into lines that fit within a maximum width
        const wrapTextLines = (text: string, maxW: number, f: any, size: number): string[] => {
            const rawParagraphs = text.split("\n");
            const resultLines: string[] = [];
            for (const para of rawParagraphs) {
                const words = para.split(" ");
                let currentLine = "";
                for (const word of words) {
                    const candidate = currentLine ? `${currentLine} ${word}` : word;
                    if (f.widthOfTextAtSize(candidate, size) <= maxW || !currentLine) {
                        currentLine = candidate;
                    } else {
                        resultLines.push(currentLine);
                        currentLine = word;
                    }
                }
                if (currentLine) resultLines.push(currentLine);
            }
            return resultLines;
        };

        // 2. Sort Elements by zIndex
        const elements = [...(design.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        // 3. Render Each Element
        for (const elem of elements) {
            if (elem.isHidden) continue;

            // In PDF coordinate space, y = 0 is BOTTOM left.
            // In web editor coordinate space, y = 0 is TOP left.
            // Conversion: pdfX = elem.x, pdfY = height - elem.y - elem.height
            const pdfX = elem.x;
            const pdfY = height - elem.y - elem.height;

            if (elem.type === "static-text" || elem.type === "dynamic-text") {
                let textContent =
                    elem.type === "dynamic-text"
                        ? this.resolveFieldKey(elem.fieldKey, snapshot, elem.text || elem.fallbackValue || (elem as any).content || "")
                        : elem.text || (elem as any).content || "";

                if (!textContent) continue;
                textContent = this.sanitizeForPdf(textContent);
                if (!textContent.trim()) continue;

                // Font selection
                const isBold =
                    elem.style?.fontWeight === "bold" ||
                    elem.style?.fontWeight === "black" ||
                    elem.style?.fontWeight === "700" ||
                    elem.style?.fontWeight === "900";

                const isSerif =
                    elem.style?.fontFamily?.toLowerCase().includes("times") ||
                    elem.style?.fontFamily?.toLowerCase().includes("playfair") ||
                    elem.style?.fontFamily?.toLowerCase().includes("serif");

                const isMono =
                    elem.style?.fontFamily?.toLowerCase().includes("courier") ||
                    elem.style?.fontFamily?.toLowerCase().includes("mono");

                const font = isMono
                    ? isBold
                        ? fontMonoBold
                        : fontMono
                    : isSerif
                    ? isBold
                        ? fontSerifBold
                        : fontSerif
                    : isBold
                    ? fontSansBold
                    : fontSans;

                let fontSize = elem.style?.fontSize || (elem as any).fontSize || 14;
                const textColor = this.hexToRgb(elem.style?.color || (elem as any).color || "#000000");
                const maxWidth = elem.width;
                const maxHeight = elem.height;

                // Layout and Auto-Fit Policies (Phase 9)
                const policy = elem.fitPolicy || "shrink";

                if (policy === "wrap") {
                    let lines = wrapTextLines(textContent, maxWidth, font, fontSize);
                    let lineHeight = fontSize * 1.25;
                    let totalTextHeight = lines.length * lineHeight;

                    // Automatically shrink if wrapped lines exceed bounding box height
                    while (totalTextHeight > maxHeight && fontSize > 8) {
                        fontSize -= 0.5;
                        lineHeight = fontSize * 1.25;
                        lines = wrapTextLines(textContent, maxWidth, font, fontSize);
                        totalTextHeight = lines.length * lineHeight;
                    }

                    const align = elem.style?.textAlign || "left";
                    const startY = pdfY + elem.height - (elem.height - totalTextHeight) / 2 - fontSize;

                    lines.forEach((line, lineIdx) => {
                        const lineWidth = font.widthOfTextAtSize(line, fontSize);
                        let lineX = pdfX;
                        if (align === "center") {
                            lineX = pdfX + (maxWidth - lineWidth) / 2;
                        } else if (align === "right") {
                            lineX = pdfX + maxWidth - lineWidth;
                        }
                        const lineY = startY - lineIdx * lineHeight;

                        page.drawText(line, {
                            x: Math.max(0, lineX),
                            y: Math.max(0, lineY),
                            size: fontSize,
                            font,
                            color: textColor,
                        });
                    });
                } else {
                    // "shrink" or "warn"
                    let textWidth = font.widthOfTextAtSize(textContent, fontSize);

                    if (policy === "shrink") {
                        while (textWidth > maxWidth && fontSize > 7) {
                            fontSize -= 0.5;
                            textWidth = font.widthOfTextAtSize(textContent, fontSize);
                        }
                    } else if (policy === "warn") {
                        if (textWidth > maxWidth) {
                            warnings.push(
                                `Element "${elem.id}" (${elem.fieldKey || elem.text}) overflows container width (${Math.round(textWidth)}pt > ${maxWidth}pt)`
                            );
                        }
                    } else if (maxWidth > 0) {
                        while (textWidth > maxWidth && fontSize > 7) {
                            fontSize -= 0.5;
                            textWidth = font.widthOfTextAtSize(textContent, fontSize);
                        }
                    }

                    // Alignment calculation
                    let renderX = pdfX;
                    const align = elem.style?.textAlign || "left";
                    if (align === "center") {
                        renderX = pdfX + (maxWidth - textWidth) / 2;
                    } else if (align === "right") {
                        renderX = pdfX + maxWidth - textWidth;
                    }

                    // Vertical centering within element box
                    const fontHeight = font.heightAtSize(fontSize);
                    const renderY = pdfY + (elem.height - fontHeight) / 2;

                    const textDrawOptions: any = {
                        x: Math.max(0, renderX),
                        y: Math.max(0, renderY),
                        size: fontSize,
                        font,
                        color: textColor,
                    };
                    if (elem.rotation) {
                        textDrawOptions.rotate = degrees(elem.rotation);
                    }
                    page.drawText(textContent, textDrawOptions);
                }
            } else if (elem.type === "shape") {
                const shapeColor = this.hexToRgb(elem.style?.backgroundColor || "#000000");
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: elem.width,
                    height: elem.height,
                    color: shapeColor,
                });
            } else if (elem.type === "badge") {
                const badgeBg = this.hexToRgb(elem.style?.backgroundColor || "#F59E0B");
                page.drawEllipse({
                    x: pdfX + elem.width / 2,
                    y: pdfY + elem.height / 2,
                    xScale: elem.width / 2,
                    yScale: elem.height / 2,
                    color: badgeBg,
                });
                if (elem.text) {
                    const badgeText = this.sanitizeForPdf(elem.text);
                    const bFont = fontSansBold;
                    const bSize = elem.style?.fontSize || 12;
                    const bWidth = bFont.widthOfTextAtSize(badgeText, bSize);
                    page.drawText(badgeText, {
                        x: pdfX + (elem.width - bWidth) / 2,
                        y: pdfY + (elem.height - bFont.heightAtSize(bSize)) / 2,
                        size: bSize,
                        font: bFont,
                        color: this.hexToRgb(elem.style?.color || "#000000"),
                    });
                }
            } else if (elem.type === "qr-code") {
                // Generate QR Code PNG Buffer with high error correction
                const credentialCode = snapshot.certificate.credentialCode;
                const verifyUrl = `${verificationBaseUrl}/verify/certificate/${encodeURIComponent(credentialCode)}`;

                try {
                    const qrPngBuffer = await QRCode.toBuffer(verifyUrl, {
                        type: "png",
                        errorCorrectionLevel: "H",
                        margin: 1,
                        width: Math.round(elem.width * 2), // 2x resolution
                        color: {
                            dark: "#000000",
                            light: "#FFFFFF",
                        },
                    });

                    const embeddedQr = await doc.embedPng(qrPngBuffer);
                    page.drawImage(embeddedQr, {
                        x: pdfX,
                        y: pdfY,
                        width: elem.width,
                        height: elem.height,
                    });
                } catch (qrErr) {
                    console.error("QR Code embed error in PDF:", qrErr);
                }
            } else if (elem.type === "image" && elem.imageUrl) {
                try {
                    if (elem.imageUrl.startsWith("data:image/png;base64,")) {
                        const base64Data = elem.imageUrl.replace("data:image/png;base64,", "");
                        const imgBuffer = Buffer.from(base64Data, "base64");
                        const embeddedImg = await doc.embedPng(imgBuffer);
                        page.drawImage(embeddedImg, {
                            x: pdfX,
                            y: pdfY,
                            width: elem.width,
                            height: elem.height,
                        });
                    } else if (
                        elem.imageUrl.startsWith("data:image/jpeg;base64,") ||
                        elem.imageUrl.startsWith("data:image/jpg;base64,")
                    ) {
                        const base64Data = elem.imageUrl.replace(/^data:image\/(jpeg|jpg);base64,/, "");
                        const imgBuffer = Buffer.from(base64Data, "base64");
                        const embeddedImg = await doc.embedJpg(imgBuffer);
                        page.drawImage(embeddedImg, {
                            x: pdfX,
                            y: pdfY,
                            width: elem.width,
                            height: elem.height,
                        });
                    }
                } catch (imgErr) {
                    console.error("Image embed error in PDF:", imgErr);
                }
            } else if (elem.type === "signature") {
                const strokeColor = this.hexToRgb(elem.style?.borderColor || "#000000");
                // Horizontal signature line
                page.drawLine({
                    start: { x: pdfX, y: pdfY + 28 },
                    end: { x: pdfX + elem.width, y: pdfY + 28 },
                    thickness: 1.5,
                    color: strokeColor,
                });

                // Signer Name
                const signerName = this.sanitizeForPdf(
                    elem.signerName ||
                    this.resolveFieldKey("certificate.signerName", snapshot, "Authorized Signatory")
                );
                const sNameFont = fontSansBold;
                const sNameSize = 10;
                const sNameWidth = sNameFont.widthOfTextAtSize(signerName, sNameSize);
                page.drawText(signerName, {
                    x: pdfX + (elem.width - sNameWidth) / 2,
                    y: pdfY + 14,
                    size: sNameSize,
                    font: sNameFont,
                    color: strokeColor,
                });

                // Signer Role / Title
                const signerRole = this.sanitizeForPdf(
                    elem.signerTitle ||
                    this.resolveFieldKey("certificate.signerRole", snapshot, "Club Coordinator")
                );
                const sRoleFont = fontSans;
                const sRoleSize = 8.5;
                const sRoleWidth = sRoleFont.widthOfTextAtSize(signerRole, sRoleSize);
                page.drawText(signerRole, {
                    x: pdfX + (elem.width - sRoleWidth) / 2,
                    y: pdfY + 2,
                    size: sRoleSize,
                    font: sRoleFont,
                    color: strokeColor,
                });
            }
        }

        const pdfBytes = await doc.save();
        const pdfBuffer = Buffer.from(pdfBytes);

        // Compute authoritative SHA-256 Digest
        const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

        return {
            pdfBuffer,
            sha256Hash,
            pageCount: doc.getPageCount(),
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
}
