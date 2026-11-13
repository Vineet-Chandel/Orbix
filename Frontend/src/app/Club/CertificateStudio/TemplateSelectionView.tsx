import React, { useState, useEffect, useMemo } from "react";
import {
    UploadCloud,
    Plus,
    Search,
    Copy,
    Trash2,
    Edit3,
    FileText,
    Sparkles,
    AlertTriangle,
    Layers,
    ArrowRight,
    Eye,
    X,
    Filter,
    ShieldCheck,
    CheckCircle2,
    RefreshCw,
    Info,
    Sliders,
    Award,
    Square,
    Lock,
    Check,
    Calendar,
    User,
    Building2,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchCertificateTemplates,
    duplicateCertificateTemplate,
    archiveCertificateTemplate,
    renameCertificateTemplate,
    uploadCertificateBackground,
} from "../../../api/certificateStudioApi";
import type { CertificateDesign, CertificateTemplateRecord } from "../../../types/certificateStudio";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { NeoSelect } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";

// ============================================================================
// AUTHENTIC MINIATURE CERTIFICATE THUMBNAIL RENDERER
// Draws real certificate background, borders, title, dynamic tokens, signature, QR
// ============================================================================
export const CertificateThumbnailPreview: React.FC<{
    design: CertificateDesign;
    sampleRecipientName?: string;
    sampleCollege?: string;
    sampleEventTitle?: string;
    className?: string;
}> = ({ design, sampleRecipientName, sampleCollege, sampleEventTitle, className = "" }) => {
    const pageWidth = design.page?.width || 842;
    const pageHeight = design.page?.height || 595;
    const bg = design.background || { type: "preset", color: "#FFFFFF" };
    const elements = design.elements || [];

    const bgColor = bg.color || (bg.type === "preset" ? "#FFFFFF" : "#FFFFFF");
    const borderColor = bg.borderColor || "#000000";
    const borderWidth = bg.borderWidth || 6;
    const borderStyle = bg.borderStyle || "solid";
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
                {bg.imageUrl && (
                    <image
                        href={bg.imageUrl}
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
                    .slice()
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((elem) => {
                        const style = elem.style || {};
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

                        if (elem.type === "static-text" || elem.type === "dynamic-text") {
                            let displayText = elem.text || elem.fallbackValue || "";
                            if (elem.fieldKey === "recipient.name" && sampleRecipientName) {
                                displayText = sampleRecipientName;
                            } else if (elem.fieldKey === "recipient.collegeName" && sampleCollege) {
                                displayText = sampleCollege;
                            } else if (elem.fieldKey === "event.title" && sampleEventTitle) {
                                displayText = sampleEventTitle;
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
                                            : "400"
                                    }
                                    letterSpacing={style.letterSpacing ? `${style.letterSpacing}px` : undefined}
                                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
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
                                    fill={style.backgroundColor || "#000000"}
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

                        if (elem.type === "qr-code") {
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
            </svg>
        </div>
    );
};

// ============================================================================
// PREDEFINED PAPER SIZES & SCRATCH DESIGN PRESETS (PHASE 4)
// ============================================================================
export interface PaperSizeSpec {
    id: string;
    name: string;
    label: string;
    width: number;
    height: number;
    orientation: "landscape" | "portrait";
    aspectRatio: string;
    description: string;
}

export const PREDEFINED_PAPER_SIZES: PaperSizeSpec[] = [
    {
        id: "a4-landscape",
        name: "A4 Landscape",
        label: "A4 Horizontal (842 × 595 pt)",
        width: 842,
        height: 595,
        orientation: "landscape",
        aspectRatio: "1.415 : 1",
        description: "Standard international format for completion, workshop, and hackathon certificates",
    },
    {
        id: "a4-portrait",
        name: "A4 Portrait",
        label: "A4 Vertical (595 × 842 pt)",
        width: 595,
        height: 842,
        orientation: "portrait",
        aspectRatio: "1 : 1.415",
        description: "Vertical diploma format ideal for academic honors, fellowships, and formal degrees",
    },
    {
        id: "letter-landscape",
        name: "US Letter Landscape",
        label: "US Letter Horizontal (792 × 612 pt)",
        width: 792,
        height: 612,
        orientation: "landscape",
        aspectRatio: "1.294 : 1",
        description: "North American format for corporate credentials, summits, and symposiums",
    },
    {
        id: "letter-portrait",
        name: "US Letter Portrait",
        label: "US Letter Vertical (612 × 792 pt)",
        width: 612,
        height: 792,
        orientation: "portrait",
        aspectRatio: "1 : 1.294",
        description: "Vertical institutional diploma format conforming to ANSI standard Letter paper",
    },
    {
        id: "square-credential",
        name: "Square Credential",
        label: "Square 1:1 (600 × 600 pt)",
        width: 600,
        height: 600,
        orientation: "landscape",
        aspectRatio: "1 : 1",
        description: "Square format optimized for LinkedIn shares, portfolio badges, and social media showcase",
    },
];

export interface ScratchPresetSpec {
    id: string;
    title: string;
    badge: string;
    description: string;
    design: CertificateDesign;
}

export const SCRATCH_DESIGN_PRESETS: ScratchPresetSpec[] = [
    {
        id: "minimalist-modern",
        title: "Minimalist Modern",
        badge: "Clean Contemporary",
        description: "Crisp white canvas with modern slate borders, cobalt accent bar, and geometric sans typography.",
        design: {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: {
                type: "color",
                color: "#FFFFFF",
                borderStyle: "modern",
                borderWidth: 6,
                borderColor: "#0F172A",
                accentColor: "#2563EB",
            },
            elements: [
                {
                    id: "sc_min_title",
                    type: "static-text",
                    x: 60,
                    y: 70,
                    width: 722,
                    height: 44,
                    zIndex: 1,
                    text: "CERTIFICATE OF ACHIEVEMENT",
                    style: { fontFamily: "Inter", fontSize: 26, fontWeight: "900", color: "#0F172A", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_min_sub",
                    type: "static-text",
                    x: 60,
                    y: 130,
                    width: 722,
                    height: 22,
                    zIndex: 2,
                    text: "THIS HONOR IS PROUDLY PRESENTED TO",
                    style: { fontFamily: "Inter", fontSize: 11, fontWeight: "bold", color: "#64748B", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_min_name",
                    type: "dynamic-text",
                    x: 60,
                    y: 180,
                    width: 722,
                    height: 56,
                    zIndex: 3,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma",
                    style: { fontFamily: "Playfair Display", fontSize: 36, fontWeight: "bold", color: "#0F172A", textAlign: "center" },
                },
                {
                    id: "sc_min_desc",
                    type: "dynamic-text",
                    x: 100,
                    y: 260,
                    width: 642,
                    height: 48,
                    zIndex: 4,
                    fieldKey: "award.description",
                    fallbackValue: "For demonstrating exemplary commitment, architectural excellence, and technical mastery.",
                    style: { fontFamily: "Inter", fontSize: 13, fontWeight: "normal", color: "#334155", textAlign: "center", lineHeight: 1.5 },
                },
                {
                    id: "sc_min_event",
                    type: "dynamic-text",
                    x: 100,
                    y: 330,
                    width: 642,
                    height: 32,
                    zIndex: 5,
                    fieldKey: "event.title",
                    fallbackValue: "National Cloud Native Summit 2026",
                    style: { fontFamily: "Inter", fontSize: 15, fontWeight: "bold", color: "#1E293B", textAlign: "center" },
                },
                {
                    id: "sc_min_qr",
                    type: "qr-code",
                    x: 60,
                    y: 470,
                    width: 60,
                    height: 60,
                    zIndex: 6,
                    fieldKey: "certificate.credentialCode",
                },
                {
                    id: "sc_min_sig",
                    type: "signature",
                    x: 610,
                    y: 475,
                    width: 170,
                    height: 50,
                    zIndex: 7,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Faculty Coordinator & Club Advisor",
                    style: { borderColor: "#0F172A", color: "#0F172A" },
                },
            ],
        },
    },
    {
        id: "academic-honors",
        title: "Academic Honors Diploma",
        badge: "Formal Parchment",
        description: "Classic parchment tone with gold ornate corner motifs, serif headings, and academic seal.",
        design: {
            page: { width: 595, height: 842, orientation: "portrait", unit: "pt" },
            background: {
                type: "color",
                color: "#FAF6EE",
                borderStyle: "ornate",
                borderWidth: 4,
                borderColor: "#B45309",
                accentColor: "#D97706",
            },
            elements: [
                {
                    id: "sc_acad_inst",
                    type: "dynamic-text",
                    x: 40,
                    y: 80,
                    width: 515,
                    height: 30,
                    zIndex: 1,
                    fieldKey: "recipient.collegeName",
                    fallbackValue: "DELHI TECHNOLOGICAL UNIVERSITY",
                    style: { fontFamily: "Inter", fontSize: 13, fontWeight: "bold", color: "#78350F", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_acad_title",
                    type: "static-text",
                    x: 40,
                    y: 130,
                    width: 515,
                    height: 50,
                    zIndex: 2,
                    text: "DIPLOMA OF EXCELLENCE",
                    style: { fontFamily: "Playfair Display", fontSize: 26, fontWeight: "900", color: "#451A03", textAlign: "center" },
                },
                {
                    id: "sc_acad_sub",
                    type: "static-text",
                    x: 40,
                    y: 200,
                    width: 515,
                    height: 24,
                    zIndex: 3,
                    text: "BE IT KNOWN TO ALL PERSONS THAT",
                    style: { fontFamily: "Inter", fontSize: 10, fontWeight: "bold", color: "#92400E", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_acad_name",
                    type: "dynamic-text",
                    x: 40,
                    y: 245,
                    width: 515,
                    height: 60,
                    zIndex: 4,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma",
                    style: { fontFamily: "Playfair Display", fontSize: 34, fontWeight: "bold", color: "#1E293B", textAlign: "center" },
                },
                {
                    id: "sc_acad_dept",
                    type: "dynamic-text",
                    x: 40,
                    y: 330,
                    width: 515,
                    height: 28,
                    zIndex: 5,
                    fieldKey: "recipient.department",
                    fallbackValue: "Department of Computer Science & Engineering",
                    style: { fontFamily: "Inter", fontSize: 12, fontWeight: "600", color: "#78350F", textAlign: "center" },
                },
                {
                    id: "sc_acad_desc",
                    type: "dynamic-text",
                    x: 50,
                    y: 390,
                    width: 495,
                    height: 60,
                    zIndex: 6,
                    fieldKey: "award.description",
                    fallbackValue: "Having demonstrated outstanding academic merit, algorithmic rigor, and continuous contributions to university projects.",
                    style: { fontFamily: "Playfair Display", fontSize: 13, fontWeight: "normal", color: "#451A03", textAlign: "center", lineHeight: 1.5 },
                },
                {
                    id: "sc_acad_badge",
                    type: "badge",
                    x: 267,
                    y: 490,
                    width: 60,
                    height: 60,
                    zIndex: 7,
                    text: "SEAL",
                    style: { backgroundColor: "#D97706", color: "#FFFFFF", fontSize: 11, fontWeight: "900", borderRadius: 30 },
                },
                {
                    id: "sc_acad_sig1",
                    type: "signature",
                    x: 50,
                    y: 720,
                    width: 170,
                    height: 50,
                    zIndex: 8,
                    signerName: "Dr. Alok Mittal",
                    signerTitle: "Dean of Academic Affairs",
                    style: { borderColor: "#78350F", color: "#78350F" },
                },
                {
                    id: "sc_acad_sig2",
                    type: "signature",
                    x: 375,
                    y: 720,
                    width: 170,
                    height: 50,
                    zIndex: 9,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Faculty Coordinator",
                    style: { borderColor: "#78350F", color: "#78350F" },
                },
            ],
        },
    },
    {
        id: "grand-champion",
        title: "Grand Champion Gold",
        badge: "Winner & Honors",
        description: "Double gold frame with victory badge, bold position title, and celebratory contrast styling.",
        design: {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: {
                type: "color",
                color: "#FFFDF5",
                borderStyle: "double",
                borderWidth: 6,
                borderColor: "#D97706",
                accentColor: "#F59E0B",
            },
            elements: [
                {
                    id: "sc_champ_badge",
                    type: "badge",
                    x: 396,
                    y: 45,
                    width: 50,
                    height: 50,
                    zIndex: 1,
                    text: "1ST",
                    style: { backgroundColor: "#F59E0B", color: "#000000", fontSize: 13, fontWeight: "900", borderRadius: 25 },
                },
                {
                    id: "sc_champ_title",
                    type: "static-text",
                    x: 60,
                    y: 110,
                    width: 722,
                    height: 45,
                    zIndex: 2,
                    text: "GRAND CHAMPIONSHIP AWARD",
                    style: { fontFamily: "Space Grotesk", fontSize: 28, fontWeight: "900", color: "#92400E", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_champ_pos",
                    type: "dynamic-text",
                    x: 60,
                    y: 165,
                    width: 722,
                    height: 28,
                    zIndex: 3,
                    fieldKey: "award.position",
                    fallbackValue: "WINNER — FIRST PLACE",
                    style: { fontFamily: "Space Grotesk", fontSize: 15, fontWeight: "900", color: "#B45309", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_champ_name",
                    type: "dynamic-text",
                    x: 60,
                    y: 220,
                    width: 722,
                    height: 56,
                    zIndex: 4,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma",
                    style: { fontFamily: "Playfair Display", fontSize: 38, fontWeight: "bold", color: "#000000", textAlign: "center" },
                },
                {
                    id: "sc_champ_event",
                    type: "dynamic-text",
                    x: 60,
                    y: 300,
                    width: 722,
                    height: 32,
                    zIndex: 5,
                    fieldKey: "event.title",
                    fallbackValue: "Orbix National HackSphere 2026",
                    style: { fontFamily: "Space Grotesk", fontSize: 16, fontWeight: "bold", color: "#1E293B", textAlign: "center" },
                },
                {
                    id: "sc_champ_qr",
                    type: "qr-code",
                    x: 60,
                    y: 470,
                    width: 60,
                    height: 60,
                    zIndex: 6,
                    fieldKey: "certificate.credentialCode",
                },
                {
                    id: "sc_champ_sig",
                    type: "signature",
                    x: 610,
                    y: 475,
                    width: 170,
                    height: 50,
                    zIndex: 7,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Chief Evaluation Jury",
                    style: { borderColor: "#D97706", color: "#92400E" },
                },
            ],
        },
    },
    {
        id: "neo-brutalist",
        title: "Neo-Brutalist High-Contrast",
        badge: "Orbix Signature",
        description: "Heavy 8pt solid black border, Canary Yellow header bar, and punchy Space Grotesk typography.",
        design: {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: {
                type: "color",
                color: "#FFFFFF",
                borderStyle: "neo-brutalist",
                borderWidth: 8,
                borderColor: "#000000",
                accentColor: "#FFE566",
            },
            elements: [
                {
                    id: "sc_nb_title",
                    type: "static-text",
                    x: 50,
                    y: 65,
                    width: 742,
                    height: 48,
                    zIndex: 1,
                    text: "ORBIX MERIT CREDENTIAL",
                    style: { fontFamily: "Space Grotesk", fontSize: 30, fontWeight: "900", color: "#000000", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_nb_sub",
                    type: "static-text",
                    x: 50,
                    y: 125,
                    width: 742,
                    height: 24,
                    zIndex: 2,
                    text: "OFFICIAL VERIFIED CAMPUS RECORD",
                    style: { fontFamily: "Space Grotesk", fontSize: 12, fontWeight: "bold", color: "#000000", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_nb_name",
                    type: "dynamic-text",
                    x: 50,
                    y: 180,
                    width: 742,
                    height: 60,
                    zIndex: 3,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma",
                    style: { fontFamily: "Space Grotesk", fontSize: 36, fontWeight: "900", color: "#000000", textAlign: "center" },
                },
                {
                    id: "sc_nb_event",
                    type: "dynamic-text",
                    x: 80,
                    y: 270,
                    width: 682,
                    height: 34,
                    zIndex: 4,
                    fieldKey: "event.title",
                    fallbackValue: "Orbix Developer Championship 2026",
                    style: { fontFamily: "Space Grotesk", fontSize: 16, fontWeight: "bold", color: "#000000", textAlign: "center" },
                },
                {
                    id: "sc_nb_code",
                    type: "dynamic-text",
                    x: 80,
                    y: 330,
                    width: 682,
                    height: 26,
                    zIndex: 5,
                    fieldKey: "certificate.credentialCode",
                    fallbackValue: "ORB-SOC-2026-F9A3B2",
                    style: { fontFamily: "Courier Prime", fontSize: 13, fontWeight: "bold", color: "#000000", textAlign: "center" },
                },
                {
                    id: "sc_nb_qr",
                    type: "qr-code",
                    x: 60,
                    y: 460,
                    width: 65,
                    height: 65,
                    zIndex: 6,
                    fieldKey: "certificate.credentialCode",
                },
                {
                    id: "sc_nb_sig",
                    type: "signature",
                    x: 600,
                    y: 470,
                    width: 180,
                    height: 52,
                    zIndex: 7,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Faculty Coordinator & Club Advisor",
                    style: { borderColor: "#000000", color: "#000000" },
                },
            ],
        },
    },
    {
        id: "executive-corporate",
        title: "Executive Corporate Slate",
        badge: "Industry Standard",
        description: "Sophisticated slate background, deep navy double frame, and crisp corporate styling.",
        design: {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: {
                type: "color",
                color: "#F8FAFC",
                borderStyle: "double",
                borderWidth: 5,
                borderColor: "#1E293B",
                accentColor: "#475569",
            },
            elements: [
                {
                    id: "sc_corp_title",
                    type: "static-text",
                    x: 60,
                    y: 75,
                    width: 722,
                    height: 44,
                    zIndex: 1,
                    text: "CERTIFICATE OF PROFESSIONAL MERIT",
                    style: { fontFamily: "Inter", fontSize: 25, fontWeight: "bold", color: "#0F172A", textAlign: "center", letterSpacing: 1.5 },
                },
                {
                    id: "sc_corp_sub",
                    type: "static-text",
                    x: 60,
                    y: 135,
                    width: 722,
                    height: 22,
                    zIndex: 2,
                    text: "FOR DEMONSTRATED TECHNICAL COMPETENCE AND CONTRIBUTION",
                    style: { fontFamily: "Inter", fontSize: 10, fontWeight: "bold", color: "#64748B", textAlign: "center", letterSpacing: 2 },
                },
                {
                    id: "sc_corp_name",
                    type: "dynamic-text",
                    x: 60,
                    y: 190,
                    width: 722,
                    height: 56,
                    zIndex: 3,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma",
                    style: { fontFamily: "Inter", fontSize: 34, fontWeight: "900", color: "#0F172A", textAlign: "center" },
                },
                {
                    id: "sc_corp_desc",
                    type: "dynamic-text",
                    x: 90,
                    y: 270,
                    width: 662,
                    height: 44,
                    zIndex: 4,
                    fieldKey: "award.description",
                    fallbackValue: "Successfully completing comprehensive enterprise workshop training and technical assessments.",
                    style: { fontFamily: "Inter", fontSize: 13, fontWeight: "normal", color: "#334155", textAlign: "center", lineHeight: 1.5 },
                },
                {
                    id: "sc_corp_event",
                    type: "dynamic-text",
                    x: 90,
                    y: 335,
                    width: 662,
                    height: 30,
                    zIndex: 5,
                    fieldKey: "event.title",
                    fallbackValue: "Enterprise Software Architecture Summit 2026",
                    style: { fontFamily: "Inter", fontSize: 14, fontWeight: "bold", color: "#1E293B", textAlign: "center" },
                },
                {
                    id: "sc_corp_qr",
                    type: "qr-code",
                    x: 60,
                    y: 470,
                    width: 60,
                    height: 60,
                    zIndex: 6,
                    fieldKey: "certificate.credentialCode",
                },
                {
                    id: "sc_corp_sig",
                    type: "signature",
                    x: 610,
                    y: 475,
                    width: 170,
                    height: 50,
                    zIndex: 7,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Program Director",
                    style: { borderColor: "#1E293B", color: "#0F172A" },
                },
            ],
        },
    },
];

export function createBlankPaperDesign(spec: PaperSizeSpec): CertificateDesign {
    const width = spec.width;
    const height = spec.height;
    const isPortrait = spec.orientation === "portrait";

    return {
        page: { width, height, orientation: spec.orientation, unit: "pt" },
        background: {
            type: "color",
            color: "#FFFFFF",
            borderStyle: "double",
            borderWidth: 5,
            borderColor: "#0F172A",
            accentColor: "#2563EB",
        },
        elements: [
            {
                id: `bk_title_${Date.now()}`,
                type: "static-text",
                x: Math.round(width * 0.1),
                y: Math.round(height * (isPortrait ? 0.12 : 0.14)),
                width: Math.round(width * 0.8),
                height: 44,
                zIndex: 1,
                text: "CERTIFICATE OF APPRECIATION",
                style: {
                    fontFamily: "Space Grotesk",
                    fontSize: Math.min(30, Math.round(width / 26)),
                    fontWeight: "900",
                    color: "#0F172A",
                    textAlign: "center",
                    letterSpacing: 2,
                },
            },
            {
                id: `bk_sub_${Date.now()}`,
                type: "static-text",
                x: Math.round(width * 0.1),
                y: Math.round(height * (isPortrait ? 0.22 : 0.25)),
                width: Math.round(width * 0.8),
                height: 24,
                zIndex: 2,
                text: "THIS HONOR IS PROUDLY PRESENTED TO",
                style: {
                    fontFamily: "Inter",
                    fontSize: Math.min(12, Math.round(width / 60)),
                    fontWeight: "bold",
                    color: "#64748B",
                    textAlign: "center",
                    letterSpacing: 2,
                },
            },
            {
                id: `bk_name_${Date.now()}`,
                type: "dynamic-text",
                x: Math.round(width * 0.1),
                y: Math.round(height * (isPortrait ? 0.34 : 0.38)),
                width: Math.round(width * 0.8),
                height: 56,
                zIndex: 3,
                fieldKey: "recipient.name",
                fallbackValue: "Recipient Full Name",
                style: {
                    fontFamily: "Playfair Display",
                    fontSize: Math.min(36, Math.round(width / 22)),
                    fontWeight: "bold",
                    color: "#0F172A",
                    textAlign: "center",
                },
            },
            {
                id: `bk_event_${Date.now()}`,
                type: "dynamic-text",
                x: Math.round(width * 0.12),
                y: Math.round(height * (isPortrait ? 0.48 : 0.54)),
                width: Math.round(width * 0.76),
                height: 36,
                zIndex: 4,
                fieldKey: "event.title",
                fallbackValue: "Annual Technical Symposium & HackSphere 2026",
                style: {
                    fontFamily: "Inter",
                    fontSize: Math.min(16, Math.round(width / 48)),
                    fontWeight: "bold",
                    color: "#1E293B",
                    textAlign: "center",
                },
            },
            {
                id: `bk_qr_${Date.now()}`,
                type: "qr-code",
                x: Math.round(width * 0.08),
                y: Math.round(height - 100),
                width: 55,
                height: 55,
                zIndex: 5,
                fieldKey: "certificate.credentialCode",
            },
            {
                id: `bk_sig_${Date.now()}`,
                type: "signature",
                x: Math.round(width - (isPortrait ? 200 : 220)),
                y: Math.round(height - 95),
                width: isPortrait ? 150 : 170,
                height: 48,
                zIndex: 6,
                signerName: "Prof. Rajesh Verma",
                signerTitle: "Faculty Coordinator & Club Advisor",
                style: {
                    borderColor: "#0F172A",
                    color: "#0F172A",
                },
            },
        ],
    };
}

// ============================================================================
// MAIN TEMPLATE SELECTION VIEW
// ============================================================================
interface TemplateSelectionViewProps {
    onSelectTemplate: (design: CertificateDesign, templateName: string, templateId?: string) => void;
    onStartScratch?: (orientation: "landscape" | "portrait", themePreset?: string) => void;
    initialTab?: "library" | "upload" | "scratch" | "my-templates";
    onIssueWithTemplate?: (design: CertificateDesign, templateName: string, templateId?: string) => void;
}

export const TemplateSelectionView: React.FC<TemplateSelectionViewProps> = ({
    onSelectTemplate,
    onStartScratch: _onStartScratch,
    initialTab = "library",
    onIssueWithTemplate,
}) => {
    const toast = useToast();

    // Four starting options: "library" | "upload" | "scratch" | "my-templates"
    const [startTab, setStartTab] = useState<"library" | "upload" | "scratch" | "my-templates">(initialTab);

    // Templates state
    const [systemTemplates, setSystemTemplates] = useState<CertificateTemplateRecord[]>([]);
    const [clubTemplates, setClubTemplates] = useState<CertificateTemplateRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Interactive Filters for System Template Library
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedStyle, setSelectedStyle] = useState<string>("all");
    const [selectedOrientation, setSelectedOrientation] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Interactive Filters & Sorting for Club Templates (Phase 8)
    const [myTemplatesSearch, setMyTemplatesSearch] = useState("");
    const [myTemplatesCategory, setMyTemplatesCategory] = useState<string>("all");
    const [myTemplatesStatus, setMyTemplatesStatus] = useState<string>("all");
    const [myTemplatesSort, setMyTemplatesSort] = useState<"updated" | "name" | "usage">("updated");

    // Rename Modal state (Phase 8)
    const [renameModalTemplate, setRenameModalTemplate] = useState<CertificateTemplateRecord | null>(null);
    const [renameInput, setRenameInput] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    // Preview Modal state
    const [previewTemplate, setPreviewTemplate] = useState<CertificateTemplateRecord | null>(null);
    const [sampleRecipientIndex, setSampleRecipientIndex] = useState(0);

    const SAMPLE_RECIPIENTS = [
        { name: "Aarav Sharma", college: "Delhi Technological University", event: "National Hackathon Summit 2026" },
        { name: "Priya Lakshmi Nair", college: "Indian Institute of Technology, Bombay", event: "Annual Engineering Conclave" },
        { name: "Devansh Mehra", college: "Birla Institute of Technology & Science, Pilani", event: "Campus Builder Showcase" },
    ];

    // Background upload state
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadOrientation, setUploadOrientation] = useState<"landscape" | "portrait">("landscape");
    const [uploadBackgroundFit, setUploadBackgroundFit] = useState<"cover" | "contain" | "stretch">("cover");
    const [uploadImageMeta, setUploadImageMeta] = useState<{
        width: number;
        height: number;
        format: string;
        sizeMb: string;
        aspectRatio: string;
    } | null>(null);
    const [hasFlattenedText, setHasFlattenedText] = useState(false);

    // Scratch Workflow state (Phase 4)
    const [scratchMode, setScratchMode] = useState<"presets" | "custom">("presets");

    // Custom Canvas Dimensions Configurator
    const [customWidth, setCustomWidth] = useState<number>(842);
    const [customHeight, setCustomHeight] = useState<number>(595);
    const [customOrientation, setCustomOrientation] = useState<"landscape" | "portrait">("landscape");
    const [customBgColor, setCustomBgColor] = useState<string>("#FFFFFF");
    const [customBorderStyle, setCustomBorderStyle] = useState<"double" | "solid" | "ornate" | "modern" | "neo-brutalist" | "none">("double");
    const [customBorderWidth, setCustomBorderWidth] = useState<number>(6);
    const [customBorderColor, setCustomBorderColor] = useState<string>("#000000");
    const [customAccentColor, setCustomAccentColor] = useState<string>("#FFE566");
    const [customCertTitle, setCustomCertTitle] = useState<string>("CERTIFICATE OF APPRECIATION");

    // Aspect ratio calculation
    const customAspectRatioText = useMemo(() => {
        if (customHeight <= 0) return "1 : 1";
        const ratio = customWidth / customHeight;
        return `${ratio.toFixed(2)} : 1`;
    }, [customWidth, customHeight]);

    // Live custom design object for real-time SVG thumbnail rendering
    const liveCustomDesign: CertificateDesign = useMemo(() => {
        return {
            page: {
                width: customWidth,
                height: customHeight,
                orientation: customOrientation,
                unit: "pt",
            },
            background: {
                type: "color",
                color: customBgColor,
                borderStyle: customBorderStyle,
                borderWidth: customBorderWidth,
                borderColor: customBorderColor,
                accentColor: customAccentColor,
            },
            elements: [
                {
                    id: "c_title",
                    type: "static-text",
                    x: Math.round(customWidth * 0.1),
                    y: Math.round(customHeight * 0.14),
                    width: Math.round(customWidth * 0.8),
                    height: 44,
                    zIndex: 1,
                    text: customCertTitle || "CERTIFICATE OF RECOGNITION",
                    style: {
                        fontFamily: "Space Grotesk",
                        fontSize: Math.min(28, Math.round(customWidth / 28)),
                        fontWeight: "900",
                        color: customBorderColor,
                        textAlign: "center",
                    },
                },
                {
                    id: "c_name",
                    type: "dynamic-text",
                    x: Math.round(customWidth * 0.1),
                    y: Math.round(customHeight * 0.38),
                    width: Math.round(customWidth * 0.8),
                    height: 52,
                    zIndex: 2,
                    fieldKey: "recipient.name",
                    fallbackValue: "Aarav Sharma (Recipient Full Name)",
                    style: {
                        fontFamily: "Playfair Display",
                        fontSize: Math.min(34, Math.round(customWidth / 24)),
                        fontWeight: "bold",
                        color: customBorderColor,
                        textAlign: "center",
                    },
                },
                {
                    id: "c_qr",
                    type: "qr-code",
                    x: Math.round(customWidth * 0.08),
                    y: Math.round(customHeight - 90),
                    width: 50,
                    height: 50,
                    zIndex: 3,
                    fieldKey: "certificate.credentialCode",
                },
                {
                    id: "c_sig",
                    type: "signature",
                    x: Math.round(customWidth - 190),
                    y: Math.round(customHeight - 80),
                    width: 150,
                    height: 45,
                    zIndex: 4,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Faculty Coordinator",
                    style: {
                        borderColor: customBorderColor,
                        color: customBorderColor,
                    },
                },
            ],
        };
    }, [
        customWidth,
        customHeight,
        customOrientation,
        customBgColor,
        customBorderStyle,
        customBorderWidth,
        customBorderColor,
        customAccentColor,
        customCertTitle,
    ]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await fetchCertificateTemplates();
            setSystemTemplates(data.systemTemplates || []);
            setClubTemplates(data.clubTemplates || []);
        } catch (err: any) {
            console.error("Load templates error:", err);
            toast.error(err.message || "Failed to load templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    // Filter templates
    const filteredSystemTemplates = useMemo(() => {
        return systemTemplates.filter((tmpl) => {
            // Category filter
            if (selectedCategory !== "all" && tmpl.category !== selectedCategory) {
                return false;
            }
            // Style filter
            const tmplStyle = tmpl.style || (tmpl.design as any)?.style || "";
            if (selectedStyle !== "all" && tmplStyle !== selectedStyle) {
                return false;
            }
            // Orientation filter
            if (selectedOrientation !== "all" && tmpl.orientation !== selectedOrientation) {
                return false;
            }
            // Search query filter (matches name, category, subcategory, style)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = tmpl.name.toLowerCase().includes(q);
                const matchCategory = tmpl.category.toLowerCase().includes(q);
                const matchSub = (tmpl.subcategory || (tmpl.design as any)?.subcategory || "").toLowerCase().includes(q);
                const matchStyle = tmplStyle.toLowerCase().includes(q);
                if (!matchName && !matchCategory && !matchSub && !matchStyle) {
                    return false;
                }
            }
            return true;
        });
    }, [systemTemplates, selectedCategory, selectedStyle, selectedOrientation, searchQuery]);

    // Handle "Use Template" for Built-in System Templates
    // Creates a club-owned editable copy, preserving the immutable system template!
    const handleUseSystemTemplate = async (tmpl: CertificateTemplateRecord) => {
        try {
            toast.info(`Creating club copy of "${tmpl.name}"...`);
            const cloned = await duplicateCertificateTemplate(tmpl.id);
            toast.success(`Loaded "${cloned.name}" into Certificate Studio!`);
            onSelectTemplate(cloned.design, cloned.name, cloned.id);
        } catch (err: any) {
            console.error("Duplicate template error:", err);
            toast.error(err.message || "Failed to clone template. Loading template directly.");
            onSelectTemplate(tmpl.design, `${tmpl.name} (Custom)`, undefined);
        }
    };

    // Duplicate action for Club Templates
    const handleDuplicateClubTemplate = async (tmplId: string) => {
        try {
            const copy = await duplicateCertificateTemplate(tmplId);
            toast.success(`Created copy "${copy.name}".`);
            await loadTemplates();
        } catch (err: any) {
            toast.error(err.message || "Failed to duplicate template.");
        }
    };

    // Archive action for Club Templates (Screen Modal)
    const [templateToArchive, setTemplateToArchive] = useState<CertificateTemplateRecord | null>(null);
    const [isArchiving, setIsArchiving] = useState(false);

    const handleArchiveClubTemplate = (tmpl: CertificateTemplateRecord) => {
        setTemplateToArchive(tmpl);
    };

    const handleConfirmArchive = async () => {
        if (!templateToArchive) return;
        setIsArchiving(true);
        try {
            await archiveCertificateTemplate(templateToArchive.id);
            toast.success(`Template "${templateToArchive.name}" archived.`);
            await loadTemplates();
            setTemplateToArchive(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to archive template.");
        } finally {
            setIsArchiving(false);
        }
    };

    // Rename handlers for Club Templates (Phase 8)
    const handleStartRename = (tmpl: CertificateTemplateRecord) => {
        setRenameModalTemplate(tmpl);
        setRenameInput(tmpl.name);
    };

    const handleSaveRename = async () => {
        if (!renameModalTemplate) return;
        const trimmed = renameInput.trim();
        if (!trimmed) {
            toast.error("Template name cannot be empty.");
            return;
        }
        if (trimmed === renameModalTemplate.name) {
            setRenameModalTemplate(null);
            return;
        }
        setIsRenaming(true);
        try {
            await renameCertificateTemplate(renameModalTemplate.id, trimmed);
            toast.success(`Template renamed to "${trimmed}".`);
            setRenameModalTemplate(null);
            await loadTemplates();
        } catch (err: any) {
            console.error("Rename template error:", err);
            toast.error(err.message || "Failed to rename template.");
        } finally {
            setIsRenaming(false);
        }
    };

    // Filtered & Sorted Club Templates (Phase 8)
    const filteredClubTemplates = useMemo(() => {
        return clubTemplates
            .filter((tmpl) => {
                if (myTemplatesCategory !== "all" && tmpl.category !== myTemplatesCategory) {
                    return false;
                }
                if (myTemplatesStatus !== "all" && tmpl.status !== myTemplatesStatus) {
                    return false;
                }
                if (myTemplatesSearch.trim()) {
                    const q = myTemplatesSearch.toLowerCase();
                    const matchName = tmpl.name.toLowerCase().includes(q);
                    const matchCategory = tmpl.category.toLowerCase().includes(q);
                    const matchCreator = (tmpl.creatorName || "").toLowerCase().includes(q);
                    if (!matchName && !matchCategory && !matchCreator) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => {
                if (myTemplatesSort === "name") {
                    return a.name.localeCompare(b.name);
                }
                if (myTemplatesSort === "usage") {
                    return (b.usageCount || 0) - (a.usageCount || 0);
                }
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [clubTemplates, myTemplatesCategory, myTemplatesStatus, myTemplatesSearch, myTemplatesSort]);

    // Handle File Drop / Select for Background Upload
    const handleFileSelect = (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase();

        // 1. Explicit format rejection guidance
        if (ext === "pdf") {
            toast.error(
                "PDF files cannot be used as an editable template. Please export your background as a high-resolution PNG or JPG from Canva, Figma, or Illustrator and re-upload."
            );
            return;
        }
        if (ext === "psd") {
            toast.error(
                "Photoshop (.psd) files cannot be used directly. Please export your background as a high-resolution PNG or JPG from Photoshop."
            );
            return;
        }
        if (ext === "ai") {
            toast.error(
                "Illustrator (.ai) files cannot be used directly. Please export as PNG, JPG, or sanitized SVG."
            );
            return;
        }
        if (ext === "docx" || ext === "doc") {
            toast.error(
                "Word documents cannot be used as certificate backgrounds. Please export your page/slide as PNG or JPG."
            );
        }
        if (ext === "html" || ext === "htm") {
            toast.error("HTML files are not supported as certificate backgrounds.");
            return;
        }
        if (!ext || !["png", "jpg", "jpeg", "svg"].includes(ext)) {
            toast.error(`Unsupported format ".${ext}". Please upload PNG, JPG, JPEG, or sanitized SVG.`);
            return;
        }

        // 2. Client-side size limit checks
        const isSvg = ext === "svg";
        const maxLimit = isSvg ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxLimit) {
            toast.error(`File is too large (maximum ${isSvg ? "2 MB for SVG" : "10 MB for raster images"}).`);
            return;
        }

        setUploadedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setUploadPreviewUrl(dataUrl);

            if (ext === "svg") {
                setUploadImageMeta({
                    width: 842,
                    height: 595,
                    format: "SVG",
                    sizeMb: (file.size / (1024 * 1024)).toFixed(2),
                    aspectRatio: "1.41:1 (Vector)",
                });
            } else {
                const img = new Image();
                img.onload = () => {
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    const ratio = (w / h).toFixed(2);
                    setUploadImageMeta({
                        width: w,
                        height: h,
                        format: ext.toUpperCase(),
                        sizeMb: (file.size / (1024 * 1024)).toFixed(2),
                        aspectRatio: `${ratio}:1`,
                    });
                    // Intelligently auto-match orientation
                    if (w < h) {
                        setUploadOrientation("portrait");
                    } else {
                        setUploadOrientation("landscape");
                    }
                };
                img.src = dataUrl;
            }
        };
        reader.readAsDataURL(file);
    };

    // Confirm upload background and open in visual editor
    const handleConfirmUpload = async () => {
        if (!uploadedFile) {
            toast.error("Please choose a certificate background image first.");
            return;
        }

        setIsUploading(true);
        try {
            const res = await uploadCertificateBackground(uploadedFile);
            toast.success("Background validated and uploaded successfully!");

            const width = uploadOrientation === "portrait" ? 595 : 842;
            const height = uploadOrientation === "portrait" ? 842 : 595;

            const elements: any[] = [];

            // If user indicated their background contains flattened text, pre-place an adjustable masking patch!
            if (hasFlattenedText) {
                elements.push({
                    id: `elem_${Date.now()}_mask_patch`,
                    type: "shape",
                    x: Math.round((width - 340) / 2),
                    y: Math.round(height * 0.38),
                    width: 340,
                    height: 65,
                    zIndex: 1,
                    style: {
                        backgroundColor: "#FFFFFF",
                        borderColor: "#000000",
                        borderWidth: 0,
                        borderRadius: 4,
                        opacity: 1,
                    },
                });
            }

            // Award Title
            elements.push({
                id: `elem_${Date.now()}_title`,
                type: "dynamic-text",
                fieldKey: "award.title",
                fallbackValue: "Certificate of Participation",
                x: 71,
                y: Math.round(height * 0.18),
                width: width - 142,
                height: 50,
                zIndex: 2,
                style: { fontSize: 30, fontWeight: "black", color: "#0F172A", textAlign: "center" },
            });

            // Recipient Name
            elements.push({
                id: `elem_${Date.now()}_recipient`,
                type: "dynamic-text",
                fieldKey: "recipient.name",
                fallbackValue: "Recipient Full Name",
                x: 71,
                y: Math.round(height * 0.38),
                width: width - 142,
                height: 55,
                zIndex: 3,
                style: { fontSize: 36, fontWeight: "black", color: "#0F172A", textAlign: "center" },
            });

            // Description Citation
            elements.push({
                id: `elem_${Date.now()}_desc`,
                type: "dynamic-text",
                fieldKey: "award.description",
                fallbackValue: "In recognition of verified active participation and excellence.",
                x: 100,
                y: Math.round(height * 0.54),
                width: width - 200,
                height: 50,
                zIndex: 2,
                style: { fontSize: 13, fontWeight: "normal", color: "#334155", textAlign: "center" },
            });

            // QR Code
            elements.push({
                id: `elem_${Date.now()}_qr`,
                type: "qr-code",
                fieldKey: "certificate.credentialCode",
                x: Math.round(width / 2 - 25),
                y: Math.round(height * 0.74),
                width: 50,
                height: 50,
                zIndex: 3,
            });

            const newDesign: CertificateDesign = {
                style: "modern",
                aspectRatio: uploadOrientation === "portrait" ? "1:1.414 (A4)" : "1.414:1 (A4)",
                page: {
                    width,
                    height,
                    orientation: uploadOrientation,
                    unit: "pt",
                },
                background: {
                    type: "image",
                    imageUrl: res.assetUrl,
                    fit: uploadBackgroundFit,
                    borderStyle: "none",
                },
                elements,
            };

            onSelectTemplate(newDesign, `Custom (${uploadedFile.name.replace(/\.[^/.]+$/, "")})`);
        } catch (err: any) {
            toast.error(err.message || "Failed to upload background.");
        } finally {
            setIsUploading(false);
        }
    };

    // Categories definition
    const CATEGORIES = [
        { id: "all", label: "All Templates" },
        { id: "event", label: "Event Certificates" },
        { id: "achievement", label: "Achievement & Winners" },
        { id: "recognition", label: "Recognition & Honor" },
        { id: "team", label: "Team Certificates" },
        { id: "academic", label: "Academic & Professional" },
    ];

    // Styles definition
    const STYLES = [
        { id: "all", label: "All Styles" },
        { id: "minimal", label: "Minimal" },
        { id: "classic", label: "Classic" },
        { id: "modern", label: "Modern" },
        { id: "academic", label: "Academic" },
        { id: "professional", label: "Professional" },
        { id: "creative", label: "Creative" },
        { id: "neo_brutalist", label: "Neo-Brutalist" },
    ];

    return (
        <div className="space-y-6">
            {/* 4 Starting Options Navigation Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                    type="button"
                    onClick={() => setStartTab("library")}
                    className={`p-4 rounded-2xl border-3 border-black text-left transition-all ${
                        startTab === "library"
                            ? "bg-[#FFE566] shadow-[4px_4px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center mb-2 shadow-[1px_1px_0px_#000]">
                        <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <div className="text-sm font-black text-black">1. Orbix Library</div>
                    <div className="text-xs text-neutral-600 mt-0.5 font-normal">
                        {systemTemplates.length} verified pro templates
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStartTab("upload")}
                    className={`p-4 rounded-2xl border-3 border-black text-left transition-all ${
                        startTab === "upload"
                            ? "bg-[#FFE566] shadow-[4px_4px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center mb-2 shadow-[1px_1px_0px_#000]">
                        <UploadCloud className="w-5 h-5 text-black" />
                    </div>
                    <div className="text-sm font-black text-black">2. Upload Design</div>
                    <div className="text-xs text-neutral-600 mt-0.5 font-normal">Import Canva, Figma PNG/SVG</div>
                </button>

                <button
                    type="button"
                    onClick={() => setStartTab("scratch")}
                    className={`p-4 rounded-2xl border-3 border-black text-left transition-all ${
                        startTab === "scratch"
                            ? "bg-[#FFE566] shadow-[4px_4px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center mb-2 shadow-[1px_1px_0px_#000]">
                        <Plus className="w-5 h-5 text-black" />
                    </div>
                    <div className="text-sm font-black text-black">3. Blank Canvas</div>
                    <div className="text-xs text-neutral-600 mt-0.5 font-normal">Start from A4 preset</div>
                </button>

                <button
                    type="button"
                    onClick={() => setStartTab("my-templates")}
                    className={`p-4 rounded-2xl border-3 border-black text-left transition-all ${
                        startTab === "my-templates"
                            ? "bg-[#FFE566] shadow-[4px_4px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center mb-2 shadow-[1px_1px_0px_#000]">
                        <Layers className="w-5 h-5 text-black" />
                    </div>
                    <div className="text-sm font-black text-black">
                        4. My Templates ({clubTemplates.length})
                    </div>
                    <div className="text-xs text-neutral-600 mt-0.5 font-normal">Your club-saved designs</div>
                </button>
            </div>

            {/* ================================================================ */}
            {/* OPTION 1: ORBIX TEMPLATE LIBRARY */}
            {/* ================================================================ */}
            {startTab === "library" && (
                <div className="space-y-6">
                    {/* Centrally Governed Immutability Banner */}
                    <div className="p-4 bg-[#FAF6EE] rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[1px_1px_0px_#000] shrink-0 mt-0.5">
                                <Lock className="w-4 h-4 text-neutral-800" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                                    <span>System Templates Library</span>
                                    <span className="px-2 py-0.5 bg-[#FFE566] text-black text-[9px] rounded font-black border border-black/30">
                                        IMMUTABLE
                                    </span>
                                </h4>
                                <p className="text-xs text-neutral-600 mt-0.5">
                                    Centrally managed by Orbix. System templates cannot be overwritten by clubs. Selecting a template duplicates an editable copy to <strong>My Templates</strong>, keeping historical credentials strictly standardized.
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-white border-2 border-black text-xs font-black shrink-0 shadow-[2px_2px_0px_#000]">
                            {systemTemplates.length} System Templates
                        </span>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="p-5 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        {/* Search & Orientation bar */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative w-full md:w-80">
                                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, category, style..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black text-xs font-bold focus:outline-none bg-[#FAF6EE]"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Orientation Selector Pills */}
                            <div className="flex items-center gap-2 self-start md:self-auto">
                                <span className="text-xs font-black text-neutral-700 flex items-center gap-1">
                                    <Filter className="w-3.5 h-3.5" /> Orientation:
                                </span>
                                {[
                                    { id: "all", label: "All" },
                                    { id: "landscape", label: "Landscape" },
                                    { id: "portrait", label: "Portrait" },
                                ].map((o) => (
                                    <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setSelectedOrientation(o.id)}
                                        className={`px-2.5 py-1 rounded-lg border-2 border-black text-[11px] font-black transition-all ${
                                            selectedOrientation === o.id
                                                ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100"
                                        }`}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category Pills */}
                        <div className="space-y-1.5">
                            <div className="text-[11px] font-black text-neutral-600 uppercase tracking-wider">
                                Certificate Categories
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {CATEGORIES.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(c.id)}
                                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all ${
                                            selectedCategory === c.id
                                                ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Design Style Filter Pills */}
                        <div className="space-y-1.5 pt-2 border-t border-black/10">
                            <div className="text-[11px] font-black text-neutral-600 uppercase tracking-wider">
                                Design Styles
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {STYLES.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setSelectedStyle(s.id)}
                                        className={`px-2.5 py-1 rounded-lg border border-black text-[11px] font-bold transition-all ${
                                            selectedStyle === s.id
                                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                                : "bg-[#FAF6EE] text-neutral-800 hover:bg-neutral-200"
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Template Gallery Grid */}
                    {loading ? (
                        <div className="p-16 text-center text-sm font-bold text-neutral-600 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000]">
                            Loading authentic template library...
                        </div>
                    ) : filteredSystemTemplates.length === 0 ? (
                        <div className="p-12 bg-white rounded-2xl border-3 border-black text-center space-y-3 shadow-[3px_3px_0px_#000]">
                            <div className="font-black text-base text-black">No Templates Matched Your Filter</div>
                            <p className="text-xs text-neutral-600">
                                Try adjusting your category, style, or search query to browse available templates.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory("all");
                                    setSelectedStyle("all");
                                    setSelectedOrientation("all");
                                    setSearchQuery("");
                                }}
                                className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-[#FFE566] text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSystemTemplates.map((tmpl) => (
                                <div
                                    key={tmpl.id}
                                    className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] hover:shadow-[7px_7px_0px_#000] transition-all flex flex-col justify-between group space-y-4"
                                >
                                    {/* Authentic Certificate Thumbnail Preview */}
                                    <div
                                        onClick={() => setPreviewTemplate(tmpl)}
                                        className="w-full rounded-xl border-2 border-black bg-neutral-900/5 relative p-2 flex flex-col items-center justify-center cursor-pointer group-hover:scale-[1.01] transition-transform overflow-hidden shadow-inner"
                                    >
                                        <div className="w-full rounded-lg overflow-hidden border border-black/30 shadow-md">
                                            <CertificateThumbnailPreview
                                                design={tmpl.design}
                                                sampleRecipientName="Recipient Full Name"
                                            />
                                        </div>

                                        {/* Hover Overlay Pill */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5" /> Full Preview
                                            </span>
                                        </div>
                                    </div>

                                    {/* Template Metadata */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 border border-black/30 text-[10px] font-black text-neutral-800">
                                                <Lock className="w-2.5 h-2.5 text-neutral-600" />
                                                Orbix System (Immutable)
                                            </span>
                                            <span className="text-[10px] font-black text-neutral-600 bg-[#FAF6EE] px-1.5 py-0.5 rounded border border-black/20">
                                                v{tmpl.version}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FFE566] border border-black/30 text-black">
                                                {tmpl.category}
                                            </span>
                                            {tmpl.subcategory && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black/30 text-neutral-800">
                                                    {tmpl.subcategory.replace("_", " ")}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 border border-black/20 text-neutral-600">
                                                {tmpl.orientation.toUpperCase()} · {tmpl.pageSizeLabel || `${tmpl.pageWidth} × ${tmpl.pageHeight} pt`}
                                            </span>
                                            {tmpl.style && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 border border-black/20 text-neutral-600 capitalize">
                                                    {tmpl.style}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="font-black text-base text-black leading-tight">
                                            {tmpl.name}
                                        </h3>

                                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-black/10 text-neutral-600">
                                            <span className="font-bold flex items-center gap-1 text-[11px]">
                                                <Building2 className="w-3 h-3 text-neutral-400" />
                                                {tmpl.ownerClubName || "Orbix Central"}
                                            </span>
                                            <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
                                                <Award className="w-3 h-3 text-emerald-600" />
                                                {tmpl.usageCount || 0} issued
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Preview & Use Template */}
                                    <div className="pt-3 border-t-2 border-black/10 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTemplate(tmpl)}
                                            className="px-3 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                            title="Inspect certificate in full resolution"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-black" />
                                            <span>Preview</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleUseSystemTemplate(tmpl)}
                                            className="flex-1 py-2 px-3 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            <span>Use Template</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* OPTION 2: UPLOAD CERTIFICATE DESIGN */}
            {/* ================================================================ */}
            {startTab === "upload" && (
                <div className="p-6 sm:p-8 bg-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000] space-y-6 max-w-3xl mx-auto">
                    {/* 3.2 Upload Guidance Header */}
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFE566] border-2 border-black text-xs font-black text-black">
                            <Sparkles className="w-4 h-4" />
                            <span>Prepare Your Certificate Design</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-black">
                            Upload Custom Background Artwork
                        </h3>
                        <div className="p-4 rounded-xl border-2 border-black bg-[#FAF6EE] space-y-2">
                            <p className="text-xs sm:text-sm text-neutral-800 font-bold leading-relaxed">
                                &ldquo;For the best result, upload your certificate background without recipient names, dates, positions or other information that needs to change for each recipient.&rdquo;
                            </p>
                            <p className="text-xs text-neutral-600 font-medium">
                                Orbix will automatically overlay editable dynamic text layers, authorized faculty signatures, and verifiable QR security tokens directly on top of your background design.
                            </p>
                        </div>
                    </div>

                    {/* Do's and Don'ts Visual Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3.5 rounded-xl border-2 border-emerald-600 bg-emerald-50/70 space-y-1.5">
                            <div className="font-black text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>What to include in background:</span>
                            </div>
                            <ul className="text-neutral-700 space-y-1 list-disc pl-4 text-[11px] font-medium">
                                <li>Club branding, crests, logos & watermarks</li>
                                <li>Decorative borders, frames & ribbon artwork</li>
                                <li>Fixed headers (e.g. &ldquo;CERTIFICATE OF COMPLETION&rdquo;)</li>
                                <li>Institutional signatures or official seal graphics</li>
                            </ul>
                        </div>

                        <div className="p-3.5 rounded-xl border-2 border-amber-600 bg-amber-50/70 space-y-1.5">
                            <div className="font-black text-amber-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>What to leave blank:</span>
                            </div>
                            <ul className="text-neutral-700 space-y-1 list-disc pl-4 text-[11px] font-medium">
                                <li>Recipient student names (Jane Doe, Aarav Sharma)</li>
                                <li>Issue dates & dynamic timestamps</li>
                                <li>Event positions, ranks & project titles</li>
                                <li>Verification QR code areas (Orbix places these)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Format and Upload Bounds Specification */}
                    <div className="p-3.5 rounded-xl border-2 border-black bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-black">Supported Formats:</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black font-black text-[10px]">
                                PNG (≤10 MB)
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black font-black text-[10px]">
                                JPG / JPEG (≤10 MB)
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black font-black text-[10px]">
                                Sanitized SVG (≤2 MB)
                            </span>
                        </div>
                        <div className="text-[11px] font-bold text-neutral-500">
                            Resolution: 400×300 px to 5000×5000 px
                        </div>
                    </div>

                    {/* Orientation & Background Fit Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Orientation Selector */}
                        <div>
                            <label className="text-xs font-black text-black block mb-1.5">
                                Page Orientation
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setUploadOrientation("landscape")}
                                    className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-black text-center transition-all ${
                                        uploadOrientation === "landscape"
                                            ? "bg-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-white hover:bg-neutral-100"
                                    }`}
                                >
                                    Landscape (842×595 pt)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUploadOrientation("portrait")}
                                    className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-black text-center transition-all ${
                                        uploadOrientation === "portrait"
                                            ? "bg-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-white hover:bg-neutral-100"
                                    }`}
                                >
                                    Portrait (595×842 pt)
                                </button>
                            </div>
                        </div>

                        {/* Background Fit Selector (Cover / Contain / Stretch) */}
                        <div>
                            <label className="text-xs font-black text-black block mb-1.5">
                                Background Fit Mode
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "cover", label: "Cover (Fill)", desc: "Trim excess margin" },
                                    { id: "contain", label: "Contain (Fit)", desc: "Fit entire artwork" },
                                    { id: "stretch", label: "Stretch", desc: "Fill canvas edges" },
                                ].map((fit) => (
                                    <button
                                        key={fit.id}
                                        type="button"
                                        onClick={() => setUploadBackgroundFit(fit.id as any)}
                                        className={`py-2 px-2 rounded-xl border-2 border-black text-[11px] font-black text-center transition-all ${
                                            uploadBackgroundFit === fit.id
                                                ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100"
                                        }`}
                                        title={fit.desc}
                                    >
                                        {fit.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files?.[0]) {
                                handleFileSelect(e.dataTransfer.files[0]);
                            }
                        }}
                        className={`p-6 sm:p-8 rounded-2xl border-3 border-dashed border-black/50 hover:border-black bg-[#FAF6EE] flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                            uploadedFile ? "border-solid bg-white shadow-inner" : ""
                        }`}
                        onClick={() => {
                            if (!uploadedFile) document.getElementById("cert-bg-file-input")?.click();
                        }}
                    >
                        <input
                            id="cert-bg-file-input"
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                            }}
                        />

                        {uploadPreviewUrl ? (
                            <div className="space-y-4 w-full max-w-lg">
                                {/* Preview with selected fit */}
                                <div className="w-full h-52 rounded-xl border-2 border-black bg-neutral-900/5 relative overflow-hidden flex items-center justify-center p-2 shadow-inner">
                                    <img
                                        src={uploadPreviewUrl}
                                        alt="Uploaded background preview"
                                        className={`w-full h-full rounded border border-black/20 ${
                                            uploadBackgroundFit === "contain"
                                                ? "object-contain"
                                                : uploadBackgroundFit === "stretch"
                                                ? "object-fill"
                                                : "object-cover"
                                        }`}
                                    />
                                </div>

                                {/* Metadata Pill Badges */}
                                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
                                    <span className="px-2.5 py-1 rounded-lg bg-neutral-100 border border-black text-black">
                                        {uploadedFile?.name}
                                    </span>
                                    {uploadImageMeta && (
                                        <>
                                            <span className="px-2 py-1 rounded-lg bg-[#a2ff86] border border-black text-black font-black">
                                                {uploadImageMeta.format} · {uploadImageMeta.sizeMb} MB
                                            </span>
                                            <span className="px-2 py-1 rounded-lg bg-[#FAF6EE] border border-black text-neutral-800">
                                                {uploadImageMeta.width} × {uploadImageMeta.height} px
                                            </span>
                                            <span className="px-2 py-1 rounded-lg bg-white border border-black text-neutral-700">
                                                Ratio: {uploadImageMeta.aspectRatio}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Action Buttons on Uploaded File */}
                                <div className="flex items-center justify-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            document.getElementById("cert-bg-file-input")?.click();
                                        }}
                                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Replace Image</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUploadedFile(null);
                                            setUploadPreviewUrl(null);
                                            setUploadImageMeta(null);
                                        }}
                                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-red-50 text-red-600 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Remove</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="w-14 h-14 rounded-2xl bg-white border-3 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                                    <UploadCloud className="w-7 h-7 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-black text-black">
                                        Drag & drop your certificate background here
                                    </div>
                                    <div className="text-xs text-neutral-600 font-bold">
                                        or click to browse files from your computer
                                    </div>
                                </div>
                                <div className="inline-block px-3 py-1 rounded-lg bg-neutral-100 border border-black/30 text-[10px] font-bold text-neutral-600">
                                    Supports PNG, JPG, JPEG (up to 10 MB) or clean SVG (up to 2 MB)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3.4 Flattened Existing Certificates Handling Card */}
                    <div className="p-4 rounded-2xl border-3 border-black bg-[#FAF6EE] space-y-3">
                        <div className="flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="font-black text-xs sm:text-sm text-black">
                                    Already have a flattened certificate with names/dates in the background?
                                </h4>
                                <p className="text-[11px] text-neutral-700 leading-relaxed font-medium">
                                    Uploading an image with text baked into the pixels cannot reliably make the text editable or reconstruct the background behind it. We never promise fake automatic text reconstruction. You have two options:
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                            <div className="p-3 rounded-xl border-2 border-black bg-white space-y-1">
                                <div className="font-black text-black flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-[#FFE566] border border-black flex items-center justify-center text-[10px] font-black">1</span>
                                    <span>Option A (Clean Export)</span>
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Return to Canva, Photoshop, Figma, or PowerPoint. Hide the recipient name and date layers, then export a clean background image.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl border-2 border-black bg-white space-y-1">
                                <div className="font-black text-black flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-[#a2ff86] border border-black flex items-center justify-center text-[10px] font-black">2</span>
                                    <span>Option B (Mask & Overlay)</span>
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Use Orbix&apos;s Masking Patch tool to cover the old dynamic text with an adjustable background patch, then overlay dynamic tokens on top.
                                </p>
                            </div>
                        </div>

                        {/* Checkbox for auto-placing a masking patch */}
                        <div className="pt-1">
                            <NeoCheckbox
                                checked={hasFlattenedText}
                                onCheckedChange={(checked) => setHasFlattenedText(checked)}
                                colorScheme="yellow"
                                size="sm"
                                label="My background has flattened names/dates — automatically add a Masking Patch over the recipient name line"
                                labelClassName="text-xs font-bold text-black"
                            />
                        </div>
                    </div>

                    {/* Submit and Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setUploadedFile(null);
                                setUploadPreviewUrl(null);
                                setUploadImageMeta(null);
                                setHasFlattenedText(false);
                            }}
                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold"
                        >
                            Reset
                        </button>

                        <button
                            type="button"
                            onClick={handleConfirmUpload}
                            disabled={!uploadedFile || isUploading}
                            className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <span>{isUploading ? "Validating & Uploading..." : "Open in Design Editor"}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* OPTION 3: CREATE FROM SCRATCH WORKFLOW (PHASE 4) */}
            {/* ================================================================ */}
            {startTab === "scratch" && (
                <div className="space-y-6 max-w-6xl mx-auto">
                    {/* Header Banner */}
                    <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFE566] border border-black text-[11px] font-black uppercase tracking-wider mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                <span>Phase 4 &bull; Visual Creation Workflow</span>
                            </div>
                            <h3 className="font-black text-lg sm:text-xl text-black">
                                Create Certificate From Scratch
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium max-w-2xl mt-1">
                                Design your digital credential directly inside Orbix. Choose a standard paper size, start from a coordinated design preset, or customize exact dimensions and border styles.
                            </p>
                        </div>

                        {/* Mode Switcher Tabs */}
                        <div className="flex items-center p-1 rounded-xl border-2 border-black bg-[#FAF6EE] shadow-[2px_2px_0px_#000] shrink-0">
                            <button
                                type="button"
                                onClick={() => setScratchMode("presets")}
                                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                                    scratchMode === "presets"
                                        ? "bg-white text-black border border-black shadow-[1px_1px_0px_#000]"
                                        : "text-neutral-600 hover:text-black"
                                }`}
                            >
                                Standard Sizes &amp; Presets
                            </button>
                            <button
                                type="button"
                                onClick={() => setScratchMode("custom")}
                                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                                    scratchMode === "custom"
                                        ? "bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]"
                                        : "text-neutral-600 hover:text-black"
                                }`}
                            >
                                Custom Dimensions &amp; Canvas
                            </button>
                        </div>
                    </div>

                    {/* SUB-VIEW A: PREDEFINED SIZES & DESIGN PRESETS */}
                    {scratchMode === "presets" && (
                        <div className="space-y-8">
                            {/* Section 1: Predefined Paper Sizes (Blank Canvas) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black text-sm text-black uppercase tracking-wider flex items-center gap-2">
                                            <Square className="w-4 h-4 text-black" />
                                            <span>Predefined Paper Sizes (Blank Canvas)</span>
                                        </h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                            Select a certified print standard to launch a clean blank canvas with auto-proportioned margins.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                                        5 Formats Available
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                                    {PREDEFINED_PAPER_SIZES.map((spec) => {
                                        const isPortrait = spec.orientation === "portrait";
                                        const isSquare = spec.id === "square-credential";

                                        return (
                                            <div
                                                key={spec.id}
                                                onClick={() => {
                                                    const design = createBlankPaperDesign(spec);
                                                    onSelectTemplate(design, `Blank ${spec.name}`);
                                                }}
                                                className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-[#FAF6EE] transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                                            >
                                                {/* Mini ratio mockup */}
                                                <div className="w-full h-24 rounded-lg bg-[#F5F1E6] border border-black/20 flex items-center justify-center p-2">
                                                    <div
                                                        className={`border-2 border-black bg-white rounded shadow-sm flex items-center justify-center font-black text-[10px] text-neutral-700 transition-transform group-hover:scale-105 ${
                                                            isSquare
                                                                ? "w-16 h-16"
                                                                : isPortrait
                                                                ? "w-12 h-18"
                                                                : "w-20 h-13"
                                                        }`}
                                                    >
                                                        {spec.aspectRatio}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-black text-xs text-black group-hover:text-blue-700 transition-colors">
                                                            {spec.name}
                                                        </span>
                                                        <ArrowRight className="w-3.5 h-3.5 text-black opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                    <div className="text-[10px] font-mono text-neutral-500 font-bold">
                                                        {spec.width} &times; {spec.height} pt
                                                    </div>
                                                    <p className="text-[10px] text-neutral-600 line-clamp-2 leading-tight">
                                                        {spec.description}
                                                    </p>
                                                </div>

                                                <div className="pt-2 border-t border-black/10">
                                                    <span className="text-[10px] font-black uppercase text-black inline-flex items-center gap-1 group-hover:underline">
                                                        Open Canvas &rarr;
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 2: Reusable Coordinated Design Presets */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black text-sm text-black uppercase tracking-wider flex items-center gap-2">
                                            <Award className="w-4 h-4 text-black" />
                                            <span>Reusable Design Presets</span>
                                        </h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                            Curated, ready-to-customize designs combining harmonious borders, fonts, badges, and verification blocks.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                                        5 Curated Styles
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {SCRATCH_DESIGN_PRESETS.map((preset) => {
                                        return (
                                            <div
                                                key={preset.id}
                                                className="rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between hover:shadow-[7px_7px_0px_#000] transition-all group"
                                            >
                                                {/* Card Header Preview */}
                                                <div className="p-4 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded bg-black text-[#FFE566] text-[10px] font-black uppercase tracking-wider">
                                                        {preset.badge}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-neutral-500 uppercase">
                                                        {preset.design.page?.orientation || "landscape"}
                                                    </span>
                                                </div>

                                                {/* Authentic SVG miniature renderer */}
                                                <div className="p-4 bg-neutral-50 border-b-2 border-black flex items-center justify-center">
                                                    <div className="w-full max-w-[280px] rounded-lg border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000] transition-transform group-hover:scale-[1.02]">
                                                        <CertificateThumbnailPreview
                                                            design={preset.design}
                                                            sampleRecipientName="Aarav Sharma"
                                                            sampleCollege="Delhi Technological University"
                                                            sampleEventTitle="National HackSphere 2026"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                                                    <div className="space-y-1">
                                                        <h5 className="font-black text-sm text-black">
                                                            {preset.title}
                                                        </h5>
                                                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                                            {preset.description}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => onSelectTemplate(preset.design, preset.title)}
                                                        className="w-full py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                    >
                                                        <span>Use This Preset</span>
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUB-VIEW B: CUSTOM DIMENSIONS & CANVAS CONFIGURATOR */}
                    {scratchMode === "custom" && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Configurator Form (7 cols) */}
                            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-5">
                                <div>
                                    <h4 className="font-black text-sm text-black uppercase tracking-wider flex items-center gap-2">
                                        <Sliders className="w-4 h-4 text-black" />
                                        <span>Canvas Dimensions &amp; Geometry</span>
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                        Configure custom width, height, paper orientation, background and frame styling.
                                    </p>
                                </div>

                                {/* Certificate Title */}
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                                        Initial Certificate Title
                                    </label>
                                    <input
                                        type="text"
                                        value={customCertTitle}
                                        onChange={(e) => setCustomCertTitle(e.target.value)}
                                        className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-white shadow-inner"
                                        placeholder="e.g. CERTIFICATE OF APPRECIATION"
                                    />
                                </div>

                                {/* Dimensions Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-neutral-700">
                                                Width (pt)
                                            </label>
                                            <span className="text-[10px] text-neutral-500 font-mono">400 &ndash; 2000</span>
                                        </div>
                                        <input
                                            type="number"
                                            min={400}
                                            max={2000}
                                            value={customWidth}
                                            onChange={(e) => {
                                                const val = Math.max(400, Math.min(2000, Number(e.target.value) || 842));
                                                setCustomWidth(val);
                                                if (val > customHeight) setCustomOrientation("landscape");
                                                else if (val < customHeight) setCustomOrientation("portrait");
                                            }}
                                            className="w-full p-2.5 text-xs font-black font-mono border-2 border-black rounded-xl bg-white"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-neutral-700">
                                                Height (pt)
                                            </label>
                                            <span className="text-[10px] text-neutral-500 font-mono">400 &ndash; 2000</span>
                                        </div>
                                        <input
                                            type="number"
                                            min={400}
                                            max={2000}
                                            value={customHeight}
                                            onChange={(e) => {
                                                const val = Math.max(400, Math.min(2000, Number(e.target.value) || 595));
                                                setCustomHeight(val);
                                                if (customWidth > val) setCustomOrientation("landscape");
                                                else if (customWidth < val) setCustomOrientation("portrait");
                                            }}
                                            className="w-full p-2.5 text-xs font-black font-mono border-2 border-black rounded-xl bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Orientation and Dimension Swap */}
                                <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE] flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-neutral-700">Aspect Ratio:</span>
                                        <span className="font-mono font-black text-black px-2 py-0.5 rounded bg-white border border-black">
                                            {customAspectRatioText}
                                        </span>
                                        <span className="font-bold text-neutral-700 ml-2">Orientation:</span>
                                        <span className="font-black text-black capitalize">
                                            {customOrientation}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const w = customWidth;
                                            const h = customHeight;
                                            setCustomWidth(h);
                                            setCustomHeight(w);
                                            setCustomOrientation(h > w ? "landscape" : "portrait");
                                        }}
                                        className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 font-black text-[11px] shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1.5"
                                        title="Swap width and height"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 text-black" />
                                        <span>Swap Orientation</span>
                                    </button>
                                </div>

                                {/* Background Color Swatches & Picker */}
                                <div className="space-y-2 border-t border-black/10 pt-4">
                                    <label className="block text-xs font-bold text-neutral-700">
                                        Background Color
                                    </label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[
                                            { label: "Pure White", color: "#FFFFFF" },
                                            { label: "Ivory Parchment", color: "#FAF6EE" },
                                            { label: "Soft Cloud", color: "#F8FAFC" },
                                            { label: "Canary Yellow", color: "#FFE566" },
                                            { label: "Mint Fresh", color: "#DCFCE7" },
                                            { label: "Lavender", color: "#F3E8FF" },
                                            { label: "Obsidian Dark", color: "#0F172A" },
                                        ].map((swatch) => (
                                            <button
                                                key={swatch.color}
                                                type="button"
                                                onClick={() => setCustomBgColor(swatch.color)}
                                                className={`w-7 h-7 rounded-lg border-2 border-black transition-transform ${
                                                    customBgColor === swatch.color
                                                        ? "scale-110 shadow-[2px_2px_0px_#000] ring-2 ring-blue-600 ring-offset-1"
                                                        : "hover:scale-105"
                                                }`}
                                                style={{ backgroundColor: swatch.color }}
                                                title={swatch.label}
                                            />
                                        ))}

                                        <div className="flex items-center gap-1.5 ml-2">
                                            <input
                                                type="color"
                                                value={customBgColor}
                                                onChange={(e) => setCustomBgColor(e.target.value)}
                                                className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                            />
                                            <span className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                                                {customBgColor}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Decorative Borders */}
                                <div className="space-y-3 border-t border-black/10 pt-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                                Decorative Border Style
                                            </label>
                                            <NeoSelect
                                                value={customBorderStyle}
                                                onChange={(val) => setCustomBorderStyle(val as any)}
                                                className="w-full"
                                                size="sm"
                                            >
                                                <option value="double">Classic Double Frame</option>
                                                <option value="solid">Bold Solid Frame</option>
                                                <option value="ornate">Gold / Ornate Corners Frame</option>
                                                <option value="modern">Modern Top Accent Bar</option>
                                                <option value="neo-brutalist">Neo-Brutalist High-Contrast</option>
                                                <option value="none">No Border (Full Bleed)</option>
                                            </NeoSelect>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-bold text-neutral-700">
                                                    Border Width
                                                </label>
                                                <span className="text-xs font-mono font-bold text-black">{customBorderWidth} pt</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={1}
                                                max={20}
                                                value={customBorderWidth}
                                                onChange={(e) => setCustomBorderWidth(Number(e.target.value))}
                                                className="w-full accent-black cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* Border and Accent Colors */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                                Border Color
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={customBorderColor}
                                                    onChange={(e) => setCustomBorderColor(e.target.value)}
                                                    className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={customBorderColor}
                                                    onChange={(e) => setCustomBorderColor(e.target.value)}
                                                    className="flex-1 p-2 text-xs font-mono font-bold border-2 border-black rounded-xl uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                                Accent Color
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={customAccentColor}
                                                    onChange={(e) => setCustomAccentColor(e.target.value)}
                                                    className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={customAccentColor}
                                                    onChange={(e) => setCustomAccentColor(e.target.value)}
                                                    className="flex-1 p-2 text-xs font-mono font-bold border-2 border-black rounded-xl uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectTemplate(liveCustomDesign, customCertTitle || "Custom Blank Certificate");
                                        }}
                                        className="w-full py-3 rounded-xl border-3 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-sm font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <span>Launch Custom Blank Canvas</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Right Live Preview Box (5 cols) */}
                            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4 sticky top-6">
                                <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                                    <h4 className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-black" />
                                        <span>Live Canvas Preview</span>
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold text-neutral-500">
                                        {customWidth} &times; {customHeight} pt
                                    </span>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center overflow-hidden">
                                    <div className="w-full max-w-[340px] rounded border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden">
                                        <CertificateThumbnailPreview
                                            design={liveCustomDesign}
                                            sampleRecipientName="Aarav Sharma"
                                            sampleCollege="Delhi Technological University"
                                            sampleEventTitle="National HackSphere 2026"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                                    <div className="p-2 rounded-lg bg-neutral-100 border border-neutral-300">
                                        <div className="text-neutral-500 text-[10px]">Border Style</div>
                                        <div className="text-black uppercase">{customBorderStyle}</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-neutral-100 border border-neutral-300">
                                        <div className="text-neutral-500 text-[10px]">Ratio &amp; Format</div>
                                        <div className="text-black">{customAspectRatioText} ({customOrientation})</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* OPTION 4: MY CLUB SAVED TEMPLATES (PHASE 8) */}
            {/* ================================================================ */}
            {startTab === "my-templates" && (
                <div className="space-y-6">
                    {/* Club Templates Toolbar: Search, Filters, Sort & Actions */}
                    <div className="p-5 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={myTemplatesSearch}
                                    onChange={(e) => setMyTemplatesSearch(e.target.value)}
                                    placeholder="Search your templates by name, category, or creator..."
                                    className="w-full pl-9 pr-8 py-2 rounded-xl border-2 border-black text-xs font-bold focus:outline-none bg-[#FAF6EE]"
                                />
                                {myTemplatesSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setMyTemplatesSearch("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filters & Sort Controls */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Category Filter */}
                                <NeoSelect
                                    value={myTemplatesCategory}
                                    onChange={(val) => setMyTemplatesCategory(val)}
                                    size="sm"
                                    triggerClassName="px-3 py-2 rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000]"
                                >
                                    <option value="all">All Categories</option>
                                    <option value="event">Event</option>
                                    <option value="achievement">Achievement</option>
                                    <option value="recognition">Recognition</option>
                                    <option value="team">Team</option>
                                    <option value="academic">Academic</option>
                                    <option value="workshop">Workshop</option>
                                    <option value="custom">Custom</option>
                                </NeoSelect>

                                {/* Status Filter */}
                                <NeoSelect
                                    value={myTemplatesStatus}
                                    onChange={(val) => setMyTemplatesStatus(val)}
                                    size="sm"
                                    triggerClassName="px-3 py-2 rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000]"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </NeoSelect>

                                {/* Sort Order */}
                                <NeoSelect
                                    value={myTemplatesSort}
                                    onChange={(val) => setMyTemplatesSort(val as any)}
                                    size="sm"
                                    triggerClassName="px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                >
                                    <option value="updated">Recently Edited</option>
                                    <option value="usage">Most Issued</option>
                                    <option value="name">Alphabetical (A-Z)</option>
                                </NeoSelect>

                                {/* Quick Creation Shortcuts */}
                                <button
                                    type="button"
                                    onClick={() => setStartTab("scratch")}
                                    className="px-3 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5 text-black" />
                                    <span>Blank Canvas</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStartTab("upload")}
                                    className="px-3 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1"
                                >
                                    <UploadCloud className="w-3.5 h-3.5 text-black" />
                                    <span>Upload Design</span>
                                </button>
                            </div>
                        </div>

                        {/* Summary Pill Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-black/10 text-xs">
                            <span className="font-bold text-neutral-600">
                                Showing <strong className="text-black">{filteredClubTemplates.length}</strong> of{" "}
                                <strong className="text-black">{clubTemplates.length}</strong> club templates
                            </span>
                            {(myTemplatesSearch || myTemplatesCategory !== "all" || myTemplatesStatus !== "all") && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMyTemplatesSearch("");
                                        setMyTemplatesCategory("all");
                                        setMyTemplatesStatus("all");
                                    }}
                                    className="text-xs font-black text-neutral-700 hover:text-black underline"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Template Grid or Empty States */}
                    {clubTemplates.length === 0 ? (
                        <div className="p-12 bg-white rounded-2xl border-3 border-black text-center space-y-4 shadow-[4px_4px_0px_#000]">
                            <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-3 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                                <FileText className="w-7 h-7 text-black" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black text-lg text-black">No Custom Club Templates Yet</h4>
                                <p className="text-xs text-neutral-600 max-w-md mx-auto">
                                    Your club haven&apos;t saved any custom templates yet. You can duplicate a professionally designed template from the Orbix Library, upload background artwork, or build one from scratch.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStartTab("library")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[3px_3px_0px_#000]"
                                >
                                    Browse Orbix Library
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStartTab("scratch")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[3px_3px_0px_#000]"
                                >
                                    Create From Scratch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStartTab("upload")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[3px_3px_0px_#000]"
                                >
                                    Upload Artwork
                                </button>
                            </div>
                        </div>
                    ) : filteredClubTemplates.length === 0 ? (
                        <div className="p-12 bg-white rounded-2xl border-3 border-black text-center space-y-3 shadow-[4px_4px_0px_#000]">
                            <Filter className="w-10 h-10 text-neutral-400 mx-auto" />
                            <h4 className="font-black text-base text-black">No Templates Match Your Filters</h4>
                            <p className="text-xs text-neutral-600">
                                Try adjusting your search query, category, or status filter to find what you&apos;re looking for.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setMyTemplatesSearch("");
                                    setMyTemplatesCategory("all");
                                    setMyTemplatesStatus("all");
                                }}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-[#FFE566] text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredClubTemplates.map((tmpl) => (
                                <div
                                    key={tmpl.id}
                                    className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] hover:shadow-[7px_7px_0px_#000] transition-all flex flex-col justify-between group space-y-4"
                                >
                                    {/* 1. Card Top Bar: Status, Version, and Usage Count */}
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            {/* Status Badge */}
                                            {tmpl.status === "published" ? (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black/40 text-black">
                                                    Published
                                                </span>
                                            ) : tmpl.status === "archived" ? (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-neutral-200 border border-neutral-400 text-neutral-700">
                                                    Archived
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 border border-amber-400 text-amber-900">
                                                    Draft
                                                </span>
                                            )}

                                            {/* Version Pill */}
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black text-white">
                                                v{tmpl.version}
                                            </span>
                                        </div>

                                        {/* Usage Count Pill */}
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center gap-1">
                                            <Award className="w-3 h-3 text-emerald-600" />
                                            <span>{tmpl.usageCount || 0} Issued</span>
                                        </span>
                                    </div>

                                    {/* 2. Authentic Miniature Certificate Thumbnail Preview */}
                                    <div
                                        onClick={() => setPreviewTemplate(tmpl)}
                                        className="w-full rounded-xl border-2 border-black bg-neutral-900/5 relative p-2 flex flex-col items-center justify-center cursor-pointer group-hover:scale-[1.01] transition-transform overflow-hidden shadow-inner"
                                    >
                                        <div className="w-full rounded-lg overflow-hidden border border-black/30 shadow-md">
                                            <CertificateThumbnailPreview
                                                design={tmpl.design}
                                                sampleRecipientName="Recipient Full Name"
                                            />
                                        </div>

                                        {/* Hover Overlay Pill */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5" /> Full Preview
                                            </span>
                                        </div>
                                    </div>

                                    {/* 3. Template Metadata Details */}
                                    <div className="space-y-2">
                                        {/* Badges: Category, Orientation, Page Size */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FFE566] border border-black/30 text-black">
                                                {tmpl.category}
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 border border-black/20 text-neutral-700 capitalize">
                                                {tmpl.orientation}
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 border border-black/20 text-neutral-700">
                                                {tmpl.pageSizeLabel || `${tmpl.pageWidth} × ${tmpl.pageHeight} pt`}
                                            </span>
                                        </div>

                                        {/* Name with Rename button */}
                                        <div className="flex items-center justify-between gap-2 group/title">
                                            <h3 className="font-black text-base text-black truncate flex-1" title={tmpl.name}>
                                                {tmpl.name}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => handleStartRename(tmpl)}
                                                className="p-1 rounded-md hover:bg-neutral-100 border border-transparent hover:border-black/30 text-neutral-400 hover:text-black transition-colors"
                                                title="Rename template"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Detailed Metadata Grid: Owner Club, Creator, Last Edited */}
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1.5 border-t border-black/10 text-neutral-600">
                                            <div className="flex items-center gap-1 truncate" title={tmpl.ownerClubName || "Your Club"}>
                                                <Building2 className="w-3 h-3 text-neutral-400 shrink-0" />
                                                <span className="font-semibold truncate">{tmpl.ownerClubName || "Your Club"}</span>
                                            </div>
                                            <div className="flex items-center gap-1 truncate" title={tmpl.creatorName || "Club Staff"}>
                                                <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                                <span className="font-medium truncate">{tmpl.creatorName || "Club Staff"}</span>
                                            </div>
                                            <div className="flex items-center gap-1 col-span-2 text-neutral-500 font-medium">
                                                <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                                                <span>
                                                    Edited {new Date(tmpl.updatedAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Immutability Snapshot Notice for Issued Templates */}
                                        {Boolean(tmpl.usageCount && tmpl.usageCount > 0) && (
                                            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-900 font-bold flex items-center gap-1.5 leading-snug">
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Immutable snapshot active for past credentials. Changes save as v{tmpl.version + 1}.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Actions Toolbar */}
                                    <div className="pt-3 border-t-2 border-black/10 flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTemplate(tmpl)}
                                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                            title="Full resolution preview"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleStartRename(tmpl)}
                                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                            title="Rename template"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDuplicateClubTemplate(tmpl.id)}
                                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                            title="Duplicate template"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleArchiveClubTemplate(tmpl)}
                                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-red-50 text-red-600 shadow-[2px_2px_0px_#000] cursor-pointer"
                                            title="Archive template"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onSelectTemplate(tmpl.design, tmpl.name, tmpl.id)}
                                            className="flex-1 py-2 px-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                            title="Edit in Certificate Studio"
                                        >
                                            <Edit3 className="w-3.5 h-3.5 text-black" />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onIssueWithTemplate
                                                    ? onIssueWithTemplate(tmpl.design, tmpl.name, tmpl.id)
                                                    : onSelectTemplate(tmpl.design, tmpl.name, tmpl.id)
                                            }
                                            className="py-2 px-3 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                            title="Use this template for certificate issuance"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-black" />
                                            <span>Issue</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* RENAME TEMPLATE MODAL (PHASE 8) */}
            {/* ================================================================ */}
            {renameModalTemplate && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setRenameModalTemplate(null)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-md p-6 space-y-4 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                    <Edit3 className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="text-base font-black text-black">Rename Template</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRenameModalTemplate(null)}
                                className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-neutral-600 block mb-1">
                                    Template Name
                                </label>
                                <input
                                    type="text"
                                    value={renameInput}
                                    onChange={(e) => setRenameInput(e.target.value)}
                                    placeholder="Enter template name..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black text-sm font-bold bg-[#FAF6EE] focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveRename();
                                        if (e.key === "Escape") setRenameModalTemplate(null);
                                    }}
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-300 text-xs space-y-1">
                                <div className="flex justify-between text-neutral-600">
                                    <span>Version:</span>
                                    <strong className="text-black">v{renameModalTemplate.version}</strong>
                                </div>
                                <div className="flex justify-between text-neutral-600">
                                    <span>Total Issued:</span>
                                    <strong className="text-emerald-700">{renameModalTemplate.usageCount || 0} credentials</strong>
                                </div>
                                <p className="text-[10px] text-neutral-500 pt-1">
                                    Renaming updates the template catalog title for your club without affecting verified credentials.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={() => setRenameModalTemplate(null)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isRenaming || !renameInput.trim()}
                                onClick={handleSaveRename}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isRenaming ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Save Name</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* HIGH-FIDELITY PREVIEW MODAL */}
            {/* ================================================================ */}
            {previewTemplate && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                    onClick={() => setPreviewTemplate(null)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-4xl p-6 sm:p-8 space-y-6 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                        High-Fidelity Certificate Preview
                                    </span>
                                    {previewTemplate.isSystem ? (
                                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black/30 text-[10px] font-black text-neutral-800 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5 text-neutral-600" /> Orbix System (Immutable)
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black/30 text-[10px] font-black text-black">
                                            Club Template
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-black">
                                    {previewTemplate.name}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewTemplate(null)}
                                className="w-9 h-9 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black"
                            >
                                <X className="w-5 h-5 text-black" />
                            </button>
                        </div>

                        {/* Recipient Switcher Bar */}
                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                            <span className="font-black text-black flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                Test Real Recipient Data:
                            </span>
                            <div className="flex items-center gap-2">
                                {SAMPLE_RECIPIENTS.map((rec, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSampleRecipientIndex(idx)}
                                        className={`px-2.5 py-1 rounded-lg border-2 border-black font-black text-xs transition-all ${
                                            sampleRecipientIndex === idx
                                                ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100"
                                        }`}
                                    >
                                        {rec.name.split(" ")[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Large Full Resolution Certificate Preview */}
                        <div className="w-full rounded-2xl border-3 border-black bg-neutral-900/5 p-4 flex items-center justify-center shadow-inner overflow-hidden">
                            <div className="w-full rounded-xl overflow-hidden border-2 border-black shadow-lg">
                                <CertificateThumbnailPreview
                                    design={previewTemplate.design}
                                    sampleRecipientName={SAMPLE_RECIPIENTS[sampleRecipientIndex].name}
                                    sampleCollege={SAMPLE_RECIPIENTS[sampleRecipientIndex].college}
                                    sampleEventTitle={SAMPLE_RECIPIENTS[sampleRecipientIndex].event}
                                />
                            </div>
                        </div>

                        {/* Template Details & Metadata Info (All 10 Phase 8 Attributes) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Category</span>
                                <span className="font-black text-black capitalize">{previewTemplate.category}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Page Size</span>
                                <span className="font-black text-black">{previewTemplate.pageSizeLabel || `${previewTemplate.pageWidth} × ${previewTemplate.pageHeight} pt`}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Orientation</span>
                                <span className="font-black text-black capitalize">{previewTemplate.orientation}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Owner Club</span>
                                <span className="font-black text-black truncate block">{previewTemplate.ownerClubName || (previewTemplate.isSystem ? "Orbix Official" : "Your Club")}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Version / Status</span>
                                <span className="font-black text-black">v{previewTemplate.version} · {previewTemplate.status}</span>
                            </div>
                            <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Total Issued</span>
                                <span className="font-black text-emerald-700 flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5" /> {previewTemplate.usageCount || 0}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={() => setPreviewTemplate(null)}
                                className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold"
                            >
                                Close Preview
                            </button>

                            <div className="flex items-center gap-2">
                                {previewTemplate.isSystem ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const tmpl = previewTemplate;
                                            setPreviewTemplate(null);
                                            handleUseSystemTemplate(tmpl);
                                        }}
                                        className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <span>Duplicate to My Templates</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const tmpl = previewTemplate;
                                                setPreviewTemplate(null);
                                                handleDuplicateClubTemplate(tmpl.id);
                                            }}
                                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Duplicate</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const tmpl = previewTemplate;
                                                setPreviewTemplate(null);
                                                onSelectTemplate(tmpl.design, tmpl.name, tmpl.id);
                                            }}
                                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>Edit Design</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const tmpl = previewTemplate;
                                                setPreviewTemplate(null);
                                                if (onIssueWithTemplate) {
                                                    onIssueWithTemplate(tmpl.design, tmpl.name, tmpl.id);
                                                } else {
                                                    onSelectTemplate(tmpl.design, tmpl.name, tmpl.id);
                                                }
                                            }}
                                            className="px-5 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span>Issue Certificates</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Archive Template Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(templateToArchive)}
                onClose={() => setTemplateToArchive(null)}
                onConfirm={handleConfirmArchive}
                title="Archive Certificate Template"
                description={`Are you sure you want to archive "${templateToArchive?.name || "this template"}"? It will no longer appear in your active template library.`}
                confirmText="Archive Template"
                confirmLabel="Archive"
                variant="danger"
                isLoading={isArchiving}
            />
        </div>
    );
};
