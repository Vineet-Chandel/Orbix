import React, { useState, useRef } from "react";
import { UploadCloud, FileText, AlertTriangle, X, Sparkles, CheckCircle2 } from "lucide-react";
import { uploadResumeApi, type GeminiAnalysisReport, type ResumeProfileData } from "../../../utils/resumeIntelligenceApi";

export interface ResumeUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: (resume: ResumeProfileData, report: GeminiAnalysisReport | null) => void;
}

export const ResumeUploadModal: React.FC<ResumeUploadModalProps> = ({
    isOpen,
    onClose,
    onUploadSuccess,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSet(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleUploadAndAnalyze = async () => {
        if (!file) return;
        setIsUploading(true);
        setErrorMsg(null);

        try {
            const data = await uploadResumeApi(file);
            onUploadSuccess(data.resume, data.report);
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || "Failed to upload and analyze resume.");
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
                if (e.target === e.currentTarget && !isUploading) onClose();
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
                                Upload & Analyze Resume
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Upload to profile and evaluate recruiter impact
                            </p>
                        </div>
                    </div>
                    {!isUploading && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-lg bg-rose-50 border-2 border-black text-rose-900 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Dropzone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed rounded-xl text-center space-y-3 cursor-pointer transition-all ${
                        file
                            ? "bg-[#a2ff86]/15 border-black"
                            : "bg-[#FAF6EE] border-black/40 hover:border-black hover:bg-[#FAF6EE]/80"
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="hidden"
                    />

                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                        {file ? (
                            <FileText className="w-6 h-6 text-black stroke-[2.5]" />
                        ) : (
                            <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                        )}
                    </div>

                    <div className="space-y-1">
                        {file ? (
                            <>
                                <p className="text-sm font-black text-black truncate max-w-xs mx-auto">
                                    {file.name}
                                </p>
                                <p className="text-xs text-neutral-600 font-mono">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-black text-black">
                                    Click or drag resume here
                                </p>
                                <p className="text-xs text-neutral-600">
                                    Standard PDF or DOCX format (Max 5 MB)
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 text-xs text-neutral-700 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                        This resume will automatically attach to your public Orbix developer profile, where recruiters can view and download it.
                    </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleUploadAndAnalyze}
                        disabled={!file || isUploading}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? (
                            <>
                                <Sparkles className="w-4 h-4 animate-spin" />
                                <span>Analyzing Resume...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                <span>Upload & Analyze</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default ResumeUploadModal;
