import React from "react";
import type { CertificateDesign } from "../../../types/certificateStudio";
import { getCertificateFontFamily } from "./certificateFonts";
import { hasCertificateContent } from "./templateContent";

export const CertificateThumbnailPreview: React.FC<{
    design: CertificateDesign;
    sampleRecipientName?: string;
    sampleCollege?: string;
    sampleEventTitle?: string;
    className?: string;
}> = ({ design, sampleRecipientName, sampleCollege, sampleEventTitle, className = "" }) => {
    const pageWidth = design.page?.width || design.dimensions?.width || 842;
    const pageHeight = design.page?.height || design.dimensions?.height || 595;
    const bg = design.background || { type: "preset", color: "#FFFFFF" };
    const elements = design.elements || [];
    const backgroundImage = bg.imageUrl || bg.assetUrl;

    const bgColor = bg.color || (bg.type === "preset" ? "#FFFFFF" : "#FFFFFF");
    const borderColor = bg.borderColor || "#000000";
    const borderWidth = bg.borderWidth ?? 6;
    const borderStyle = bg.borderStyle || "none";
    const accentColor = bg.accentColor || borderColor;

    return (
        <div className={`relative w-full overflow-hidden ${className}`}>
            <svg
                viewBox={`0 0 ${pageWidth} ${pageHeight}`}
                className="w-full h-auto block select-none pointer-events-none"
                style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
            >
                {/* Background base fill */}
                <rect width={pageWidth} height={pageHeight} fill={bgColor} />

                {/* Uploaded Background Image if present */}
                {backgroundImage && (
                    <image
                        href={backgroundImage}
                        x="0"
                        y="0"
                        width={pageWidth}
                        height={pageHeight}
                        preserveAspectRatio={bg.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}
                    />
                )}

                {/* Certificate Borders */}
                {borderStyle === "double" && (
                    <>
                        <rect
                            x={borderWidth}
                            y={borderWidth}
                            width={pageWidth - borderWidth * 2}
                            height={pageHeight - borderWidth * 2}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={borderWidth}
                        />
                        <rect
                            x={borderWidth + 8}
                            y={borderWidth + 8}
                            width={pageWidth - (borderWidth + 8) * 2}
                            height={pageHeight - (borderWidth + 8) * 2}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={Math.max(1.5, borderWidth / 3)}
                        />
                    </>
                )}
                {borderStyle === "solid" && (
                    <rect
                        x={borderWidth / 2}
                        y={borderWidth / 2}
                        width={pageWidth - borderWidth}
                        height={pageHeight - borderWidth}
                        fill="none"
                        stroke={borderColor}
                        strokeWidth={borderWidth}
                    />
                )}
                {borderStyle === "ornate" && (
                    <>
                        <rect
                            x={14}
                            y={14}
                            width={pageWidth - 28}
                            height={pageHeight - 28}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={borderWidth}
                        />
                        <rect
                            x={24}
                            y={24}
                            width={pageWidth - 48}
                            height={pageHeight - 48}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={2}
                            strokeDasharray="6 4"
                        />
                        {/* Corner Ornaments */}
                        <circle cx={24} cy={24} r={6} fill={borderColor} />
                        <circle cx={pageWidth - 24} cy={24} r={6} fill={borderColor} />
                        <circle cx={24} cy={pageHeight - 24} r={6} fill={borderColor} />
                        <circle cx={pageWidth - 24} cy={pageHeight - 24} r={6} fill={borderColor} />
                    </>
                )}
                {borderStyle === "modern" && (
                    <>
                        <rect
                            x={borderWidth}
                            y={borderWidth}
                            width={pageWidth - borderWidth * 2}
                            height={pageHeight - borderWidth * 2}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={borderWidth}
                        />
                        {/* Modern Top Accent Bar */}
                        <rect
                            x={borderWidth}
                            y={borderWidth}
                            width={pageWidth - borderWidth * 2}
                            height={8}
                            fill={accentColor}
                        />
                    </>
                )}
                {borderStyle === "neo-brutalist" && (
                    <>
                        {/* Offset hard shadow */}
                        <rect
                            x={borderWidth + 6}
                            y={borderWidth + 6}
                            width={pageWidth - borderWidth * 2}
                            height={pageHeight - borderWidth * 2}
                            fill="#000000"
                        />
                        {/* Main frame */}
                        <rect
                            x={borderWidth}
                            y={borderWidth}
                            width={pageWidth - borderWidth * 2}
                            height={pageHeight - borderWidth * 2}
                            fill={bgColor}
                            stroke={borderColor}
                            strokeWidth={Math.max(borderWidth, 6)}
                        />
                        {/* Top accent bar */}
                        {accentColor && (
                            <rect
                                x={borderWidth + Math.max(borderWidth, 6) / 2}
                                y={borderWidth + Math.max(borderWidth, 6) / 2}
                                width={pageWidth - borderWidth * 2 - Math.max(borderWidth, 6)}
                                height={10}
                                fill={accentColor}
                            />
                        )}
                    </>
                )}

                {/* Certificate Elements in z-index order */}
                {elements
                    .filter((element) => !element.isHidden)
                    .slice()
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((elem) => {
                        const style = { ...elem, ...elem.style };
                        const fontSize = style.fontSize || 14;
                        const fontWeight = style.fontWeight || "normal";
                        const fill = style.color || "#000000";
                        const textAlign = style.textAlign || "left";

                        let textAnchor: "start" | "middle" | "end" = "start";
                        let textX = elem.x;
                        if (textAlign === "center") {
                            textAnchor = "middle";
                            textX = elem.x + elem.width / 2;
                        } else if (textAlign === "right") {
                            textAnchor = "end";
                            textX = elem.x + elem.width;
                        }
                        const textY = elem.y + elem.height / 2;

                        if (["static-text", "dynamic-text", "text", "dynamic_text"].includes(elem.type)) {
                            let displayText = elem.text || elem.content || elem.fallbackValue || (elem.fieldKey ? elem.fieldKey : "");
                            if (elem.fieldKey === "recipient.name" && sampleRecipientName) {
                                displayText = sampleRecipientName;
                            } else if (elem.fieldKey === "recipient.collegeName" && sampleCollege) {
                                displayText = sampleCollege;
                            } else if (elem.fieldKey === "event.title" && sampleEventTitle) {
                                displayText = sampleEventTitle;
                            }

                            const lines = displayText.split("\n");
                            if (lines.length > 1) {
                                const lineHeight = fontSize * 1.25;
                                const startY = textY - ((lines.length - 1) * lineHeight) / 2;
                                return (
                                    <text
                                        key={elem.id}
                                        x={textX}
                                        y={startY}
                                        textAnchor={textAnchor}
                                        dominantBaseline="central"
                                        fill={fill}
                                        fontSize={fontSize}
                                        fontWeight={
                                            fontWeight === "black"
                                                ? "900"
                                                : fontWeight === "bold"
                                                ? "700"
                                                : fontWeight
                                        }
                                        letterSpacing={style.letterSpacing ? `${style.letterSpacing}px` : undefined}
                                        fontFamily={getCertificateFontFamily(style.fontFamily)}
                                    >
                                        {lines.map((line, lIdx) => (
                                            <tspan key={lIdx} x={textX} dy={lIdx === 0 ? 0 : lineHeight}>
                                                {line}
                                            </tspan>
                                        ))}
                                    </text>
                                );
                            }

                            return (
                                <text
                                    key={elem.id}
                                    x={textX}
                                    y={textY}
                                    textAnchor={textAnchor}
                                    dominantBaseline="central"
                                    fill={fill}
                                    fontSize={fontSize}
                                    fontWeight={
                                        fontWeight === "black"
                                            ? "900"
                                            : fontWeight === "bold"
                                            ? "700"
                                            : fontWeight
                                    }
                                    letterSpacing={style.letterSpacing ? `${style.letterSpacing}px` : undefined}
                                    fontFamily={getCertificateFontFamily(style.fontFamily)}
                                >
                                    {displayText}
                                </text>
                            );
                        }

                        if (elem.type === "shape") {
                            return (
                                <rect
                                    key={elem.id}
                                    x={elem.x}
                                    y={elem.y}
                                    width={elem.width}
                                    height={elem.height}
                                    fill={elem.fillColor || style.backgroundColor || "#000000"}
                                    stroke={elem.strokeColor || style.borderColor}
                                    strokeWidth={elem.strokeWidth ?? style.borderWidth ?? 0}
                                    rx={style.borderRadius || 0}
                                />
                            );
                        }

                        if (elem.type === "badge") {
                            return (
                                <g key={elem.id} transform={`translate(${elem.x}, ${elem.y})`}>
                                    <circle
                                        cx={elem.width / 2}
                                        cy={elem.height / 2}
                                        r={Math.min(elem.width, elem.height) / 2}
                                        fill={style.backgroundColor || "#F59E0B"}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={elem.width / 2}
                                        y={elem.height / 2}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={style.fontSize || 10}
                                        fontWeight="900"
                                        fill={style.color || "#000000"}
                                    >
                                        {elem.text || "AWARD"}
                                    </text>
                                </g>
                            );
                        }

                        if (elem.type === "image" && elem.imageUrl) {
                            return (
                                <image
                                    key={elem.id}
                                    href={elem.imageUrl}
                                    x={elem.x}
                                    y={elem.y}
                                    width={elem.width}
                                    height={elem.height}
                                    preserveAspectRatio={elem.imageFit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
                                />
                            );
                        }

                        if (elem.type === "signature") {
                            return (
                                <g key={elem.id} transform={`translate(${elem.x}, ${elem.y})`}>
                                    <line
                                        x1="0"
                                        y1={elem.height - 22}
                                        x2={elem.width}
                                        y2={elem.height - 22}
                                        stroke={style.borderColor || "#000000"}
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={elem.width / 2}
                                        y={elem.height - 11}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fontWeight="700"
                                        fill={style.color || "#000000"}
                                    >
                                        {elem.signerName || "Authorized Signatory"}
                                    </text>
                                    <text
                                        x={elem.width / 2}
                                        y={elem.height - 1}
                                        textAnchor="middle"
                                        fontSize={7.5}
                                        fill={style.color || "#666666"}
                                    >
                                        {elem.signerTitle || "Club Coordinator"}
                                    </text>
                                </g>
                            );
                        }

                        if (elem.type === "qr-code" || elem.type === "qr_code") {
                            return (
                                <g key={elem.id} transform={`translate(${elem.x}, ${elem.y})`}>
                                    <rect
                                        width={elem.width}
                                        height={elem.height}
                                        fill="#FFFFFF"
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                        rx="2"
                                    />
                                    {/* Mini simulated QR code matrix pattern */}
                                    <rect x={elem.width * 0.15} y={elem.height * 0.15} width={elem.width * 0.25} height={elem.height * 0.25} fill="#000000" />
                                    <rect x={elem.width * 0.6} y={elem.height * 0.15} width={elem.width * 0.25} height={elem.height * 0.25} fill="#000000" />
                                    <rect x={elem.width * 0.15} y={elem.height * 0.6} width={elem.width * 0.25} height={elem.height * 0.25} fill="#000000" />
                                    <rect x={elem.width * 0.45} y={elem.height * 0.45} width={elem.width * 0.15} height={elem.height * 0.15} fill="#000000" />
                                    <rect x={elem.width * 0.65} y={elem.height * 0.65} width={elem.width * 0.2} height={elem.height * 0.2} fill="#000000" />
                                </g>
                            );
                        }

                        return null;
                    })}
                {!hasCertificateContent(design) && (
                    <text x={pageWidth / 2} y={pageHeight / 2} textAnchor="middle"
                        fill="#737373" fontSize={18} fontFamily="sans-serif">
                        Empty template
                    </text>
                )}
            </svg>
        </div>
    );
};

