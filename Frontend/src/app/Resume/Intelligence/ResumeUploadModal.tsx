import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, X, ArrowRight } from "lucide-react";
import { uploadAndAnalyzeResumeFile } from "../../../utils/resumeIntelligenceApi";
import type { ResumeContent, AnalysisReport } from "../../../../../Backend/src/services/resume/resumeTypes";

interface ResumeUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportDraft: (draft: ResumeContent, report: AnalysisReport) => void;
}

export const ResumeUploadModal: React.FC<ResumeUploadModalProps> = ({
    isOpen,
    onClose,
    onImportDraft,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            validateAndSet(selected);
        }
    };

    const validateAndSet = (selected: File) => {
        setErrorMsg(null);
        const name = selected.name.toLowerCase();
        if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            setErrorMsg("Only .pdf and .docx documents are supported.");
            return;
        }
        if (selected.size > 5 * 1024 * 1024) {
            setErrorMsg(`File size ${(selected.size / (1024 * 1024)).toFixed(2)} MB exceeds the 5 MB limit.`);
            return;
        }
        setFile(selected);
    };

    const handleUploadAndAnalyze = async () => {
        if (!file) return;
        setIsUploading(true);
        setErrorMsg(null);

        try {
            const data = await uploadAndAnalyzeResumeFile(file);
            setUploadResult(data);
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to parse and analyze document.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uploadModalTitle"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
            <div className="w-full max-w-lg bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <UploadCloud className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="uploadModalTitle" className="text-base font-black tracking-tight uppercase text-black">
                                Upload Existing Resume
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Extract text, evaluate 8 recruiter checks, and convert to an editable draft
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

                {!uploadResult ? (
                    <div className="space-y-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                        />

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer.files?.[0]) validateAndSet(e.dataTransfer.files[0]);
                            }}
                            className="p-8 border-2 border-dashed border-black rounded-xl bg-[#FAF6EE] text-center space-y-3 cursor-pointer hover:bg-amber-50/50 transition-all"
                        >
                            <FileText className="w-10 h-10 mx-auto text-neutral-700" />
                            {file ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-black">{file.name}</p>
                                    <p className="text-[11px] font-mono text-neutral-600">
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-black">
                                        Click to browse or drag & drop your resume
                                    </p>
                                    <p className="text-[11px] text-neutral-600">
                                        Supported formats: PDF, DOCX (Max 5.0 MB)
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg bg-white border-2 border-black text-xs font-black uppercase cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!file || isUploading}
                                onClick={handleUploadAndAnalyze}
                                className="px-5 py-2 rounded-lg bg-[#a2ff86] text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_#000] hover:bg-[#8cee6d] cursor-pointer disabled:opacity-50"
                            >
                                {isUploading ? "Extracting & Scanning..." : "Analyze Document"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-black font-black">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                <span>Document Extracted Successfully!</span>
                            </div>
                            <p className="text-neutral-700">
                                Detected candidate: <span className="font-bold text-black">{uploadResult.parsedDraft.contact.fullName}</span>
                            </p>
                            <p className="text-neutral-700">
                                Identified sections: {uploadResult.detectedSections.join(", ") || "General Content"}
                            </p>
                            <p className="text-neutral-700">
                                Overall Quality Score: <span className="font-black text-black">{uploadResult.report.overallScore}/100</span>
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setUploadResult(null);
                                    setFile(null);
                                }}
                                className="px-4 py-2 rounded-lg bg-white border-2 border-black text-xs font-black uppercase cursor-pointer"
                            >
                                Upload Another
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onImportDraft(uploadResult.parsedDraft, uploadResult.report);
                                    onClose();
                                }}
                                className="px-5 py-2 rounded-lg bg-[#a2ff86] text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_#000] hover:bg-[#8cee6d] cursor-pointer inline-flex items-center gap-1.5"
                            >
                                <span>Import as Editable Draft</span>
                                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
