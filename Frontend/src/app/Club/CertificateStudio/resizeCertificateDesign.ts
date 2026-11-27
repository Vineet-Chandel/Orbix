import type { CertificateDesign } from "../../../types/certificateStudio";

export function resizeCertificateDesign(design: CertificateDesign, width: number, height: number): CertificateDesign {
    const oldWidth = design.page?.width || design.dimensions?.width || 842;
    const oldHeight = design.page?.height || design.dimensions?.height || 595;
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;
    const textScale = Math.sqrt(scaleX * scaleY);
    const squareScale = Math.min(width, height) / Math.min(oldWidth, oldHeight);
    const orientation = width >= height ? "landscape" : "portrait";
    return {
        ...design,
        page: { width, height, orientation, unit: design.page?.unit ?? "pt" },
        ...(design.dimensions ? { dimensions: { ...design.dimensions, width, height, orientation } } : {}),
        elements: design.elements.map((element) => {
            const square = element.type === "qr-code" || element.type === "badge" || element.id === "orbix-brand-icon";
            const resizedWidth = element.width * (square ? squareScale : scaleX);
            const resizedHeight = element.height * (square ? squareScale : scaleY);
            return {
                ...element,
                x: element.x * scaleX + (square ? (element.width * scaleX - resizedWidth) / 2 : 0),
                y: element.y * scaleY + (square ? (element.height * scaleY - resizedHeight) / 2 : 0),
                width: resizedWidth,
                height: resizedHeight,
                ...(element.minFontSize ? { minFontSize: element.minFontSize * textScale } : {}),
                ...(element.maxFontSize ? { maxFontSize: element.maxFontSize * textScale } : {}),
                ...(element.style ? { style: {
                    ...element.style,
                    ...(element.style.fontSize ? { fontSize: element.style.fontSize * textScale } : {}),
                    ...(element.style.letterSpacing ? { letterSpacing: element.style.letterSpacing * textScale } : {}),
                } } : {}),
            };
        }),
    };
}
