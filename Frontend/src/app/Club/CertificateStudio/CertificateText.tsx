import type { CertificateElement } from "../../../types/certificateStudio";
import { getCertificateFontFamily } from "./certificateFonts";

type TextElement = Pick<CertificateElement, "width" | "height" | "style" | "fieldKey" | "fitPolicy" | "minFontSize" | "maxFontSize" | "maxLines">;

function estimateWidth(line: string, size: number, spacing: number) {
    return Array.from(line).reduce((width, character) => {
        const factor = /[ilI.,'!\s]/.test(character) ? 0.30
            : /[MW@%]/.test(character) ? 0.91
            : /[A-Z0-9]/.test(character) ? 0.67
            : /[^\x00-\xff]/.test(character) ? 1
            : 0.57;
        return width + factor * size;
    }, Math.max(0, Array.from(line).length - 1) * spacing);
}

function wrapLines(value: string, width: number, size: number, spacing: number) {
    return value.split("\n").flatMap((paragraph) => {
        const lines: string[] = [];
        let line = "";
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && estimateWidth(candidate, size, spacing) > width) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        lines.push(line);
        return lines;
    });
}

export function CertificateText({ element, value, x = 0, y = 0, fillBox = false }: {
    element: TextElement;
    value: string;
    x?: number;
    y?: number;
    fillBox?: boolean;
}) {
    const { width, height, style = {} } = element;
    const fitPolicy = element.fitPolicy ?? (element.fieldKey === "award.description" ? "wrap" : "shrink");
    if (!(width > 0 && height > 0) || !value) return null;

    const text = style.textTransform === "uppercase" ? value.toUpperCase()
        : style.textTransform === "lowercase" ? value.toLowerCase()
        : style.textTransform === "capitalize" ? value.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
        : value;
    // Reserve space for font fallback and the wider glyphs in display serifs.
    const availableWidth = Math.max((width - 2) * 0.86, 1);
    const spacing = style.letterSpacing ?? 0;
    const lineHeight = style.lineHeight || 1.24;
    const configuredSize = Math.min(style.fontSize || 14, element.maxFontSize || Infinity);
    const baseSize = Math.min(configuredSize, height / lineHeight);
    let fontSize = baseSize;
    const minFontSize = Math.min(baseSize, element.minFontSize || 6);
    let lines = text.split("\n");

    if (fitPolicy === "wrap") {
        lines = wrapLines(text, availableWidth, fontSize, spacing);
        while (fontSize > minFontSize && (lines.length * fontSize * lineHeight > height || lines.length > (element.maxLines || Infinity))) {
            fontSize = Math.max(minFontSize, fontSize - 0.5);
            lines = wrapLines(text, availableWidth, fontSize, spacing);
        }
    } else if (fitPolicy === "shrink") {
        const widest = Math.max(1, ...lines.map((line) => estimateWidth(line, baseSize, spacing)));
        fontSize = Math.max(minFontSize, Math.min(baseSize, baseSize * availableWidth / widest));
    }
    fontSize = Math.min(fontSize, height / (lines.length * lineHeight));
    const advance = fontSize * lineHeight;
    const textAnchor = style.textAlign === "center" ? "middle" : style.textAlign === "right" ? "end" : "start";
    const textX = textAnchor === "middle" ? width / 2 : textAnchor === "end" ? width - 1 : 1;
    const fontWeight = style.fontWeight === "black" ? "900" : style.fontWeight;

    return (
        <svg x={x} y={y} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={fillBox ? "block h-full w-full overflow-hidden pointer-events-none" : "overflow-hidden"} aria-hidden="true">
            {lines.map((line, index) => (
                <text key={index}
                    x={textX} y={height / 2 + (index - (lines.length - 1) / 2) * advance}
                    textAnchor={textAnchor} dominantBaseline="central"
                    fill={style.color || "#0F172A"} fontFamily={getCertificateFontFamily(style.fontFamily)}
                    fontSize={fontSize} fontWeight={fontWeight} letterSpacing={spacing}
                    textLength={fitPolicy !== "warn" && estimateWidth(line, fontSize, spacing) > availableWidth ? availableWidth : undefined}
                    lengthAdjust="spacingAndGlyphs"
                >{line}</text>
            ))}
        </svg>
    );
}
