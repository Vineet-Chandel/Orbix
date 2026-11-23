import type { CertificateDesign } from "../../../types/certificateStudio";

// Blank canvases remain editable in My Templates, but should not be issued.
export function hasCertificateContent(design: CertificateDesign): boolean {
    if (design.background?.imageUrl || design.background?.assetUrl) return true;
    return (design.elements || []).some((element) => {
        if (element.isHidden) return false;
        if (["static-text", "dynamic-text", "text", "dynamic_text"].includes(element.type)) {
            return Boolean((element.text || element.content || element.fallbackValue || element.fieldKey || "").trim());
        }
        if (element.type === "image") return Boolean(element.imageUrl);
        return ["signature", "badge", "qr-code", "qr_code"].includes(element.type);
    });
}
