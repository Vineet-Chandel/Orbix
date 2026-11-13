/**
 * Certificate Studio Low-Resolution & Vector Preview Service (Phase 15)
 * Pure server-side SVG preview rendering with zero external browser dependencies.
 * Generates lightweight, crisp vector previews for in-app spoilers and reveal animations.
 */
import QRCode from "qrcode";
import type { CertificateDesign, DynamicDataSnapshot } from "../../types/certificateStudio.js";
import { CertificatePdfService } from "./certificatePdfService.js";
import { query } from "../../database/client.js";
import { CertificateTemplateService } from "./certificateTemplateService.js";

export interface SvgPreviewOptions {
    blurred?: boolean;
    scale?: number;
}

export class CertificatePreviewService {
    /**
     * Sanitizes string to safe XML / SVG entities to prevent SVG injection (CWE-79)
     */
    static escapeXml(unsafe: string | null | undefined): string {
        if (!unsafe) return "";
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    /**
     * Generates a deterministic, pure vector SVG representation of a certificate
     */
    static async renderCertificateSvg(
        design: CertificateDesign,
        snapshot: DynamicDataSnapshot,
        options: SvgPreviewOptions = {}
    ): Promise<string> {
        const width = design.page?.width || (design.page?.orientation === "portrait" ? 595 : 842);
        const height = design.page?.height || (design.page?.orientation === "portrait" ? 842 : 595);

        const bgColor = design.background?.color || "#ffffff";
        const bgImageUrl = design.background?.imageUrl || (design.background as any)?.assetUrl;
        const isBlurred = Boolean(options.blurred || (options as any).isSpoiler);

        // Sort elements by zIndex
        const elements = [...(design.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        let qrCodeDataUri = "";
        const verificationUrl =
            snapshot.certificate?.verificationUrl ||
            `https://orbix.dev/verify/certificate/${snapshot.certificate?.credentialCode || "PREVIEW"}`;

        try {
            qrCodeDataUri = await QRCode.toDataURL(verificationUrl, {
                margin: 1,
                width: 140,
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });
        } catch (e) {
            console.error("QR Code generation warning for preview:", e);
        }

        // SVG header and definitions
        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <filter id="spoilerBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" result="blur" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
    </filter>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&amp;family=Inter:wght@400;600;800&amp;family=Playfair+Display:ital,wght@0,600;1,400&amp;display=swap');
      text { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
  </defs>
  <!-- Background Layer -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="${this.escapeXml(bgColor)}" />`;

        if (bgImageUrl) {
            svg += `\n  <image href="${this.escapeXml(bgImageUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />`;
        }

        // Decorative borders
        const borderStyle = design.background?.borderStyle || "none";
        const borderColor = design.background?.borderColor || "#1a1a1a";
        const borderWidth = design.background?.borderWidth || 4;

        if (borderStyle === "solid") {
            svg += `\n  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="${borderWidth}" />`;
        } else if (borderStyle === "double") {
            svg += `\n  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="2" />`;
            svg += `\n  <rect x="22" y="22" width="${width - 44}" height="${height - 44}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="${borderWidth}" />`;
        } else if (borderStyle === "ornate") {
            svg += `\n  <rect x="14" y="14" width="${width - 28}" height="${height - 28}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="3" />`;
            svg += `\n  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${this.escapeXml(borderColor)}" stroke-width="1.5" stroke-dasharray="4,2" />`;
        }

        // Elements Group (blurred if spoiler)
        svg += `\n  <g ${isBlurred ? 'filter="url(#spoilerBlur)"' : ""}>`;

        for (const elem of elements) {
            const x = elem.x || 0;
            const y = elem.y || 0;
            const elemWidth = elem.width || 200;
            const elemHeight = elem.height || 40;
            const style = elem.style || {};
            const fontSize = style.fontSize || 16;
            const color = style.color || "#000000";
            const fontWeight = style.fontWeight || "normal";
            const textAlign = style.textAlign || "center";
            const textAnchor = textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
            const textX = textAlign === "center" ? x + elemWidth / 2 : textAlign === "right" ? x + elemWidth : x;
            const textY = y + elemHeight / 2 + fontSize / 3;

            if (elem.type === "static-text" || elem.type === "dynamic-text") {
                let rawText = elem.text || elem.fallbackValue || "";
                if (elem.type === "dynamic-text" && elem.fieldKey) {
                    rawText = CertificatePdfService.resolveFieldKey(elem.fieldKey, snapshot, elem.text || elem.fallbackValue || "");
                }

                svg += `\n    <text x="${textX}" y="${textY}" text-anchor="${textAnchor}" fill="${this.escapeXml(
                    color
                )}" font-size="${fontSize}" font-weight="${fontWeight}">${this.escapeXml(
                    rawText
                )}</text>`;
            } else if (elem.type === "qr-code") {
                const qrHref = qrCodeDataUri || elem.imageUrl || "";
                if (qrHref) {
                    svg += `\n    <image href="${this.escapeXml(qrHref)}" x="${x}" y="${y}" width="${elemWidth}" height="${elemHeight}" />`;
                }
            } else if (elem.type === "signature") {
                const lineY = y + elemHeight - 28;
                svg += `\n    <line x1="${x + 10}" y1="${lineY}" x2="${x + elemWidth - 10}" y2="${lineY}" stroke="${this.escapeXml(
                    color
                )}" stroke-width="1.5" />`;
                const signerName = elem.signerName || snapshot.certificate?.signerName || "Authorized Signatory";
                const signerRole = elem.signerTitle || snapshot.certificate?.signerRole || "Coordinator";
                svg += `\n    <text x="${x + elemWidth / 2}" y="${lineY + 14}" text-anchor="middle" fill="${this.escapeXml(
                    color
                )}" font-size="12" font-weight="bold">${this.escapeXml(signerName)}</text>`;
                svg += `\n    <text x="${x + elemWidth / 2}" y="${lineY + 26}" text-anchor="middle" fill="#666666" font-size="10">${this.escapeXml(
                    signerRole
                )}</text>`;
            } else if (elem.type === "image" && elem.imageUrl) {
                svg += `\n    <image href="${this.escapeXml(elem.imageUrl)}" x="${x}" y="${y}" width="${elemWidth}" height="${elemHeight}" preserveAspectRatio="contain" />`;
            } else if (elem.type === "shape") {
                const shapeType = elem.shapeType || "rectangle";
                if (shapeType === "ellipse" || shapeType === "circle") {
                    svg += `\n    <ellipse cx="${x + elemWidth / 2}" cy="${y + elemHeight / 2}" rx="${elemWidth / 2}" ry="${elemHeight / 2}" fill="${this.escapeXml(
                        elem.fillColor || style.backgroundColor || "#e2e8f0"
                    )}" stroke="${this.escapeXml(elem.strokeColor || color)}" stroke-width="${elem.strokeWidth || style.borderWidth || 1}" />`;
                } else {
                    svg += `\n    <rect x="${x}" y="${y}" width="${elemWidth}" height="${elemHeight}" rx="${elem.cornerRadius || style.borderRadius || 0}" fill="${this.escapeXml(
                        elem.fillColor || style.backgroundColor || "#e2e8f0"
                    )}" stroke="${this.escapeXml(elem.strokeColor || color)}" stroke-width="${elem.strokeWidth || style.borderWidth || 1}" />`;
                }
            }
        }

        svg += "\n  </g>";

        // If blurred, overlay a sleek centered spoiler badge in the SVG
        if (isBlurred) {
            svg += `\n  <g>
    <rect x="${width / 2 - 130}" y="${height / 2 - 28}" width="260" height="56" rx="14" fill="#000000" fill-opacity="0.85" stroke="#FFE566" stroke-width="2" />
    <text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle" fill="#FFE566" font-size="14" font-weight="bold" letter-spacing="1">🔒 SPOILER PREVIEW</text>
  </g>`;
        }

        svg += "\n</svg>";
        return svg;
    }

    /**
     * Alias for renderCertificateSvg
     */
    static async renderPreviewSvg(
        design: CertificateDesign,
        snapshot: DynamicDataSnapshot,
        options: SvgPreviewOptions = {}
    ): Promise<string> {
        return this.renderCertificateSvg(design, snapshot, options);
    }

    /**
     * Retrieves certificate and generates vector preview SVG
     */
    static async getCertificatePreview(
        certificateIdOrCode: string,
        blurred: boolean = false
    ): Promise<{ svg: string; cert: any } | null> {
        const certRes = await query(
            `SELECT
                c.id, c.club_id, c.title, c.certificate_type, c.recipient_name,
                c.credential_code, c.signer_name, c.signer_role, c.issue_date,
                c.design_snapshot, c.recipient_snapshot, c.description, c.sha256_hash,
                c.is_revoked, c.user_id,
                vc.name AS "clubName", vc.slug AS "clubSlug", vc.college_name AS "collegeName",
                vc.logo_url AS "clubLogoUrl",
                e.title AS "eventTitle", e.starts_at AS "eventDate"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE c.id::text = $1 OR LOWER(c.credential_code) = LOWER($1)
             LIMIT 1;`,
            [certificateIdOrCode]
        );

        if (!certRes.rows[0]) return null;
        const cert = certRes.rows[0];

        // Retrieve design: from design_snapshot, or fallback to first system template
        let design: any = cert.design_snapshot;
        if (!design || !design.elements || design.elements.length === 0) {
            const sysList = await CertificateTemplateService.getTemplates(cert.club_id);
            design = sysList.systemTemplates[0]?.design;
        }

        // Retrieve or build snapshot
        let snapshot: any = cert.recipient_snapshot;
        if (!snapshot || !snapshot.recipient) {
            snapshot = {
                recipient: {
                    id: cert.user_id,
                    name: cert.recipient_name,
                    username: "",
                    collegeName: cert.collegeName,
                },
                event: cert.eventTitle
                    ? {
                          title: cert.eventTitle,
                          date: cert.eventDate ? new Date(cert.eventDate).toLocaleDateString() : undefined,
                      }
                    : undefined,
                club: {
                    id: cert.club_id,
                    name: cert.clubName,
                    slug: cert.clubSlug,
                    collegeName: cert.collegeName,
                    logoUrl: cert.clubLogoUrl,
                },
                award: {
                    title: cert.title,
                    type: cert.certificate_type,
                    description: cert.description,
                },
                certificate: {
                    credentialCode: cert.credential_code,
                    issueDate: new Date(cert.issue_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }),
                    verificationUrl: `https://orbix.dev/verify/certificate/${cert.credential_code}`,
                    signerName: cert.signer_name || cert.clubName,
                    signerRole: cert.signer_role || "Club Coordinator",
                },
            };
        }

        const svg = await this.renderCertificateSvg(design, snapshot, { blurred });
        return { svg, cert };
    }
}
