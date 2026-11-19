import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";

export interface DownloadPassPdfOptions {
    elementId: string;
    filename: string;
    backgroundColor?: string;
    pixelRatio?: number;
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (err: Error) => void;
}

/**
 * Generates and downloads a clean, ultra-high-resolution PDF of the Event Registration Pass / Certificate.
 * Preserves authentic Orbix Neo-Brutalist branding, logos, QR codes, and prevents any cropping or button artifacts.
 */
export async function downloadPassPdf({
    elementId,
    filename,
    backgroundColor,
    pixelRatio = 2.5,
    onStart,
    onSuccess,
    onError,
}: DownloadPassPdfOptions): Promise<void> {
    try {
        if (onStart) onStart();

        const passNode = document.getElementById(elementId);
        if (!passNode) {
            throw new Error(`Target pass element "#${elementId}" not found on page.`);
        }

        // Wait for fonts to finish rendering
        if (document.fonts) {
            await document.fonts.ready;
        }

        // Generate crisp 2.5x retina PNG snapshot of the pass element
        const pngDataUrl = await toPng(passNode, {
            quality: 1.0,
            pixelRatio,
            ...(backgroundColor ? { backgroundColor } : {}),
            filter: (node) => {
                // Strictly exclude UI action buttons, toggles, close buttons, and print triggers
                if (node instanceof HTMLElement) {
                    if (
                        node.classList.contains("print:hidden") ||
                        node.classList.contains("no-print") ||
                        node.getAttribute("data-no-print") === "true" ||
                        node.getAttribute("aria-label") === "Close"
                    ) {
                        return false;
                    }
                }
                return true;
            },
        });

        // Initialize PDF Document
        const pdfDoc = await PDFDocument.create();
        const pngImage = await pdfDoc.embedPng(pngDataUrl);

        // Standard A4 dimensions in PostScript points: 595.28 x 841.89
        const a4Width = 595.28;
        const a4Height = 841.89;
        const margin = 28;
        const usableWidth = a4Width - margin * 2;
        const scaledHeight = (pngImage.height / pngImage.width) * usableWidth;

        // Position on page: center vertically if shorter than A4; extend page if longer
        let pageWidth = a4Width;
        let pageHeight = a4Height;
        let drawX = margin;
        let drawY = Math.max(margin, (a4Height - scaledHeight) / 2);

        if (scaledHeight + margin * 2 > a4Height) {
            pageHeight = scaledHeight + margin * 2;
            drawY = margin;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(pngImage, {
            x: drawX,
            y: drawY,
            width: usableWidth,
            height: scaledHeight,
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

        if (onSuccess) onSuccess();
    } catch (err: any) {
        console.error("Failed to generate Orbix pass PDF:", err);
        if (onError) onError(err);
        else throw err;
    }
}

