import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";

export interface DownloadPassPdfOptions {
    elementId: string;
    filename: string;
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (err: Error) => void;
}

/**
 * Generates and downloads a clean, high-resolution PDF of the Event Registration Pass.
 */
export async function downloadPassPdf({
    elementId,
    filename,
    onStart,
    onSuccess,
    onError,
}: DownloadPassPdfOptions): Promise<void> {
    try {
        if (onStart) onStart();

        const passNode = document.getElementById(elementId);
        if (!passNode) {
            throw new Error("Application pass element not found on page.");
        }

        // Wait for fonts to be ready
        if (document.fonts) {
            await document.fonts.ready;
        }

        // Generate crisp 2x retina PNG snapshot of the pass element
        const pngDataUrl = await toPng(passNode, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: "#FAF6EE",
            filter: (node) => {
                // Exclude action buttons marked with print:hidden or no-print
                if (node instanceof HTMLElement) {
                    if (
                        node.classList.contains("print:hidden") ||
                        node.classList.contains("no-print") ||
                        node.getAttribute("data-no-print") === "true"
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
        const margin = 28;
        const usableWidth = a4Width - margin * 2;
        const scaledHeight = (pngImage.height / pngImage.width) * usableWidth;
        const pageHeight = Math.max(841.89, scaledHeight + margin * 2);

        // Add page matching scaled pass receipt
        const page = pdfDoc.addPage([a4Width, pageHeight]);
        page.drawImage(pngImage, {
            x: margin,
            y: pageHeight - margin - scaledHeight,
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
        console.error("Failed to generate application pass PDF:", err);
        if (onError) onError(err);
        else throw err;
    }
}
