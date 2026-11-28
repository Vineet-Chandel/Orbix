import type { CertificateElement, CertificateTemplateRecord } from "../../types/certificateStudio.js";
import { orbixCertificateBrand } from "./certificateBranding.js";

type Seed = Omit<CertificateTemplateRecord, "id" | "clubId" | "createdAt" | "updatedAt">;
type Layout = "ribbon" | "paper" | "frame" | "parchment" | "crimson" | "sash" | "gala";

interface Theme {
    name: string;
    title: string;
    category: string;
    subcategory: string;
    style: string;
    layout: Layout;
    paper: string;
    ink: string;
    accent: string;
    detail: string;
    font: string;
}

const W = 842;
const H = 595;

const themes: Theme[] = [
    { name: "Azure Internship Portfolio", title: "Certificate of Internship", category: "academic", subcategory: "internship", style: "professional", layout: "ribbon", paper: "#F8FBFF", ink: "#14254A", accent: "#185DCC", detail: "#B78537", font: "Inter" },
    { name: "Ivory Appreciation Folio", title: "Certificate of Appreciation", category: "recognition", subcategory: "appreciation", style: "minimal", layout: "paper", paper: "#FCFAF5", ink: "#292822", accent: "#5E6659", detail: "#A17E53", font: "Cormorant Garamond" },
    { name: "Indigo Filigree Achievement", title: "Certificate of Achievement", category: "achievement", subcategory: "achievement", style: "classic", layout: "frame", paper: "#FFFAF0", ink: "#201B48", accent: "#79602A", detail: "#B69A54", font: "Playfair Display" },
    { name: "Parchment Academic Merit", title: "Certificate of Academic Merit", category: "academic", subcategory: "merit", style: "academic", layout: "parchment", paper: "#F7EFDF", ink: "#44301C", accent: "#795326", detail: "#AD8F5C", font: "Cormorant Garamond" },
    { name: "Crimson Achievement Honors", title: "Certificate of Achievement", category: "achievement", subcategory: "achievement", style: "classic", layout: "crimson", paper: "#FFFCFA", ink: "#481B22", accent: "#7D2534", detail: "#B38551", font: "Playfair Display" },
    { name: "Navy Participation Sash", title: "Certificate of Participation", category: "event", subcategory: "participation", style: "classic", layout: "sash", paper: "#FBFAF5", ink: "#132446", accent: "#183D64", detail: "#BD994F", font: "Libre Baskerville" },
    { name: "Midnight Gold Excellence", title: "Certificate of Excellence", category: "achievement", subcategory: "excellence", style: "professional", layout: "gala", paper: "#101B36", ink: "#FBF5EA", accent: "#F3D58B", detail: "#BE9853", font: "Playfair Display" },
];

function certificateArtwork(theme: Theme): CertificateElement[] {
    const shapes: CertificateElement[] = [];
    const rect = (x: number, y: number, width: number, height: number, color: string) => {
        shapes.push({ id: `art-${shapes.length}`, type: "shape", x, y, width, height, zIndex: 0, shapeType: "rectangle", isLocked: true, fillColor: color, style: { backgroundColor: color } });
    };
    const frame = (inset: number, weight: number, color: string) => {
        rect(inset, inset, W - 2 * inset, weight, color);
        rect(inset, H - inset - weight, W - 2 * inset, weight, color);
        rect(inset, inset, weight, H - 2 * inset, color);
        rect(W - inset - weight, inset, weight, H - 2 * inset, color);
    };
    const seal = (x: number, y: number, size: number, outer: string, inner: string) => {
        const rings = [
            { inset: 0, color: theme.detail, mark: " " },
            { inset: 0.055, color: outer, mark: " " },
            { inset: 0.141, color: theme.detail, mark: " " },
            { inset: 0.178, color: outer, mark: "+" },
        ];
        for (const { inset, color, mark } of rings) {
            const diameter = size * (1 - 2 * inset);
            shapes.push({
                id: `art-${shapes.length}`, type: "badge", x: x + inset * size, y: y + inset * size,
                width: diameter, height: diameter, zIndex: 1, isLocked: true, text: mark,
                style: { fontSize: size * 0.36, backgroundColor: color, color: inner },
            });
        }
    };

    switch (theme.layout) {
        case "ribbon":
            rect(0, 0, 133, H, "#153C9C"); rect(0, 0, 9, H, "#2DB5F5");
            for (let i = 0; i < 4; i++) {
                rect(9, i * 148, 124, 148, ["#194FBD", "#1D60D3", "#196DDC", "#218AE5"][i]!);
                rect(28 + i * 10, i * 148, 2, 148, "#70B5FC");
            }
            rect(760, 0, 32, 116, "#DDEAFF"); rect(769, 0, 14, 116, theme.accent);
            rect(763, 0, 2, 116, theme.detail); rect(787, 0, 2, 116, theme.detail);
            seal(748, 85, 56, "#E0B96C", "#44301C");
            break;
        case "paper":
            for (let i = 0; i < 9; i++) rect(34 + i * 7, 462 + i * 8, 774 - i * 14, 0.65, "#E8E0CF");
            frame(21, 1, "#D9D0BD");
            rect(356, 76, 130, 1, theme.detail);
            rect(364, 182, 114, 1, "#DED4C1");
            break;
        case "frame":
        case "parchment":
            frame(14, theme.layout === "frame" ? 2 : 7, theme.detail);
            frame(25, 1.5, theme.accent);
            for (const x of [31, W - 78]) for (const y of [31, H - 78]) {
                for (let step = 0; step < 4; step++) {
                    rect(x + step * 5, y + step * 5, 46 - step * 10, 1, theme.detail);
                    rect(x + step * 5, y + step * 5, 1, 46 - step * 10, theme.detail);
                }
            }
            if (theme.layout === "parchment") seal(715, 47, 54, "#B38E57", "#44301C");
            break;
        case "crimson":
            frame(20, 1.5, theme.detail);
            for (const x of [20, W - 124]) for (const y of [20, H - 124]) {
                rect(x, y < 100 ? y : y + 94, 104, 10, theme.accent);
                rect(x < 100 ? x : x + 94, y, 10, 104, theme.accent);
            }
            seal(729, 47, 56, "#E4BE85", theme.accent);
            break;
        case "sash":
            rect(644, 0, 198, H, "#142C50"); rect(672, 0, 142, H, "#183D64");
            rect(676, 0, 2, H, theme.detail); rect(808, 0, 2, H, theme.detail);
            seal(698, 133, 90, "#DFB865", "#142C50");
            break;
        case "gala":
            rect(0, 0, 159, H, "#0B1327");
            for (let i = 0; i < 9; i++) rect(24 + 13 * i, 180, 2.5, 415, i % 3 === 0 ? "#F3D58B" : "#856638");
            seal(36, 92, 87, "#E6C778", "#101B36");
            rect(816, 24, 2, H - 48, theme.detail);
            break;
    }
    return shapes;
}

function buildTemplate(theme: Theme): Seed {
    const artwork = certificateArtwork(theme);
    const left = theme.layout === "ribbon" || theme.layout === "gala" ? 194 : theme.layout === "sash" ? 56 : 86;
    const right = theme.layout === "sash" ? 605 : theme.layout === "ribbon" ? 742 : 756;
    const width = right - left;
    const align = ["ribbon", "sash", "gala"].includes(theme.layout) ? "left" : "center";
    const brandX = align === "left" ? left : (W - 76) / 2;
    const fields: CertificateElement[] = [...artwork, ...orbixCertificateBrand(brandX, 46, theme.layout === "gala")];

    const text = (id: string, y: number, height: number, value: string, fontSize: number, color: string,
        { key, x = left, boxWidth = width, serif = false, weight = "normal", smallCaps = false, wrap = false }: {
            key?: string; x?: number; boxWidth?: number; serif?: boolean; weight?: string; smallCaps?: boolean; wrap?: boolean;
        } = {}) => {
        fields.push({
            id, type: key ? "dynamic-text" : "static-text", ...(key ? { fieldKey: key, fallbackValue: value } : { text: value }),
            x, y, width: boxWidth, height, zIndex: 3, fitPolicy: wrap ? "wrap" : "shrink", maxLines: wrap ? 3 : 1,
            style: { fontFamily: serif ? theme.font : "Inter", fontSize, color, fontWeight: weight, textAlign: align,
                lineHeight: 1.24, letterSpacing: smallCaps ? 1 : 0, textTransform: smallCaps ? "uppercase" : "none" },
        });
    };
    text("issuer", 82, 20, "Orbix Developer Society", 12, theme.ink, { key: "club.name", weight: "bold", smallCaps: true });
    text("title", 113, 73, theme.title, 39, theme.layout === "gala" ? theme.accent : theme.ink, { key: "award.title", serif: true, weight: "bold" });
    text("presented-to", 202, 27, "PRESENTED TO", 11, theme.ink, { weight: "bold", smallCaps: true });
    text("recipient", 235, 72, "Recipient Full Name", 46, theme.accent, { key: "recipient.name", serif: true, weight: "bold" });
    fields.push({ id: "recipient-rule", type: "shape", x: left, y: 311, width, height: 1, zIndex: 2, style: { backgroundColor: theme.detail } });
    text("recipient-campus", 325, 28, "Recipient Institution", 13, theme.ink, { key: "recipient.collegeName" });
    text("award-description", 362, 59, "In recognition of their contribution and commitment to the campus community.", 14, theme.ink, { key: "award.description", wrap: true });
    text("event", 425, 29, "Campus Technical Program", 14, theme.ink, { key: "event.title", weight: "bold" });

    const signatureWidth = Math.min(175, width * 0.32);
    const dateX = right - signatureWidth;
    for (const x of [left, dateX]) {
        fields.push({ id: `footer-rule-${x}`, type: "shape", x, y: 488, width: signatureWidth, height: 1, zIndex: 2, style: { backgroundColor: theme.detail } });
    }
    text("signer", 497, 22, "Authorized Signatory", 12, theme.ink, { key: "certificate.signerName", boxWidth: signatureWidth, weight: "bold" });
    text("signer-role", 523, 18, "Club Coordinator", 10, theme.ink, { key: "certificate.signerRole", boxWidth: signatureWidth });
    text("issue-date", 497, 22, "Issue date", 12, theme.ink, { key: "certificate.issueDate", x: dateX, boxWidth: signatureWidth, weight: "bold" });
    const qrX = theme.layout === "sash" ? 720 : theme.layout === "gala" ? 54 : left + (width - 44) / 2;
    const qrY = theme.layout === "sash" || theme.layout === "gala" ? 480 : 497;
    fields.push({ id: "verify-credential", type: "qr-code", x: qrX, y: qrY, width: 40, height: 40, zIndex: 5, fieldKey: "certificate.credentialCode" });

    return {
        isSystem: true, name: theme.name, category: theme.category, subcategory: theme.subcategory, style: theme.style,
        aspectRatio: "1.414:1 (A4)", orientation: "landscape", pageWidth: W, pageHeight: H, version: 1,
        status: "published", backgroundFit: "cover",
        design: {
            style: theme.style, subcategory: theme.subcategory, aspectRatio: "1.414:1 (A4)",
            page: { width: W, height: H, orientation: "landscape", unit: "pt" },
            background: { type: "color", color: theme.paper, borderStyle: "none" },
            elements: fields,
        },
    };
}

export const PREMIUM_CERTIFICATE_TEMPLATES = themes.map(buildTemplate);
