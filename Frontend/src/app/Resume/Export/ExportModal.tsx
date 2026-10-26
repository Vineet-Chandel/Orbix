import React, { useState } from "react";
import { Download, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { downloadResumePdf, downloadResumeDocx } from "../../../utils/resumeIntelligenceApi";
import type { ResumeContent, ExportValidationResult } from "../../../../../Backend/src/services/resume/resumeTypes";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: ResumeContent;
    templateId: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    content,
    templateId,
}) => {
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingDocx, setIsExportingDocx] = useState(false);
    const [lastValidation, setLastValidation] = useState<ExportValidationResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const baseName = (content.contact.fullName || "Resume").replace(/\s+/g, "_");

    const handleDownloadPdf = async () => {
        setIsExportingPdf(true);
        setErrorMsg(null);
        try {
            const filename = `${baseName}_Orbix.pdf`;
            const { blob, validation } = await downloadResumePdf(content, templateId, filename);
            setLastValidation(validation);

            // Trigger browser download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to generate PDF");
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleDownloadDocx = async () => {
        setIsExportingDocx(true);
        setErrorMsg(null);
        try {
            const filename = `${baseName}_Orbix.docx`;
            const { blob, validation } = await downloadResumeDocx(content, templateId, filename);
            setLastValidation(validation);

            // Trigger browser download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to generate DOCX");
        } finally {
            setIsExportingDocx(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exportModalTitle"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
            <div className="w-full max-w-lg bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a2ff86] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Download className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="exportModalTitle" className="text-base font-black tracking-tight uppercase text-black">
                                Export Professional Resume
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Genuine downloadable documents with real selectable text and clean pagination
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-lg bg-rose-50 border-2 border-black text-rose-900 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="space-y-3 pt-1">
                    {/* PDF Export Button */}
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black uppercase text-black">
                                    ATS Standard PDF
                                </h4>
                                <span className="text-[10px] font-black uppercase bg-[#a2ff86] px-1.5 py-0.2 rounded border border-black">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                Single-column vector PDF with selectable text, standard margins, and verified links.
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={isExportingPdf}
                            onClick={handleDownloadPdf}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white text-xs font-black uppercase border-2 border-black hover:bg-neutral-800 cursor-pointer disabled:opacity-50 shrink-0 shadow-[2px_2px_0px_#000]"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isExportingPdf ? "Generating..." : "Download PDF"}</span>
                        </button>
                    </div>

                    {/* DOCX Export Button */}
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <h4 className="text-xs font-black uppercase text-black">
                                Editable Word Document (DOCX)
                            </h4>
                            <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                Native Microsoft Word document with editable sections and consistent formatting.
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={isExportingDocx}
                            onClick={handleDownloadDocx}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-xs font-black uppercase border-2 border-black hover:bg-neutral-100 cursor-pointer disabled:opacity-50 shrink-0 shadow-[2px_2px_0px_#000]"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isExportingDocx ? "Generating..." : "Download DOCX"}</span>
                        </button>
                    </div>
                </div>

                {/* Post Generation Validation Report */}
                {lastValidation && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-black text-xs space-y-1.5 animate-fadeIn">
                        <div className="flex items-center gap-2 font-black text-emerald-950">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>Document Export Validated Successfully!</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-800 pt-1">
                            <div>File Size: {(lastValidation.filesizeBytes / 1024).toFixed(1)} KB (Budget: &lt;5 MB)</div>
                            <div>Format: {lastValidation.format.toUpperCase()} (Selectable Text)</div>
                        </div>
                    </div>
                )}

                <div className="p-3 rounded-lg bg-neutral-100 text-[10px] text-neutral-600 font-medium leading-relaxed border border-black/20">
                    ATS Parsing Note: Recruiting platforms (Greenhouse, Workday, etc.) process documents independently. Orbix validates that all text, links, and headings are properly structured without complex layout tables.
                </div>
            </div>
        </div>
    );
};
