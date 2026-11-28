import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useCertificateCanvasZoom(
    containerRef: RefObject<HTMLDivElement | null>,
    pageWidth: number,
    pageHeight: number,
) {
    const [fitZoom, setFitZoom] = useState(0.85);
    const [manualZoom, setManualZoom] = useState<number | null>(null);
    const zoom = manualZoom ?? fitZoom;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const fit = () => {
            const styles = getComputedStyle(container);
            const width = container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight) - 8;
            const height = container.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom) - 8;
            if (width > 0 && height > 0) {
                setFitZoom(Math.max(0.05, Math.min(1.4, width / pageWidth, height / pageHeight)));
            }
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(container);
        return () => observer.disconnect();
    }, [containerRef, pageWidth, pageHeight]);

    const changeZoom = (delta: number) => {
        setManualZoom((current) => Math.max(0.05, Math.min(1.4, Number(((current ?? fitZoom) + delta).toFixed(2)))));
    };

    return { zoom, changeZoom, fitToScreen: () => setManualZoom(null) };
}
