import React, { useEffect, useState } from "react";
import {
    Calendar,
    Clock,
    CheckCircle2,
    UploadCloud,
    ExternalLink,
    FileText,
    Sparkles,
    Check,
    Layers,
    X,
} from "lucide-react";
import { eventLifecycleApi } from "../../api/eventLifecycleApi";
import type { ConfiguredStage } from "../Club/TimelineBuilder/types";
import { useToast } from "../../context/ToastContext";
import { uploadClubImageToCloudinary, type UploadSignatureConfig } from "../../utils/clubProfileApi";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
);

interface EventPublicTimelineViewProps {
    eventId: string;
    isRegistered?: boolean;
    registrationStatus?: string | null;
}

export const EventPublicTimelineView: React.FC<EventPublicTimelineViewProps> = ({
    eventId,
    isRegistered,
    registrationStatus,
}) => {
    const toast = useToast();
    const [stages, setStages] = useState<ConfiguredStage[]>([]);
    const [loading, setLoading] = useState(true);

    // Active submission modal state
    const [submittingStage, setSubmittingStage] = useState<ConfiguredStage | null>(null);
    const [existingSubmission, setExistingSubmission] = useState<any | null>(null);
    const [loadingSubmission, setLoadingSubmission] = useState(false);

    // Submission form fields state
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [liveUrl, setLiveUrl] = useState("");
    const [uploadedFile, setUploadedFile] = useState<{ url: string; publicId: string; filename: string; bytes: number } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!eventId) return;
        setLoading(true);
        eventLifecycleApi
            .getPublicTimeline(eventId)
            .then((res) => setStages(res))
            .catch((err) => console.error("Error loading timeline:", err))
            .finally(() => setLoading(false));
    }, [eventId]);

    // Handle opening submission dialog for a stage
    const handleOpenSubmission = async (stage: ConfiguredStage) => {
        setSubmittingStage(stage);
        setLoadingSubmission(true);
        try {
            const res = await eventLifecycleApi.getMyStageSubmission(eventId, stage.id);
            if (res.submission) {
                setExistingSubmission(res.submission);
                setTitle(res.submission.submission_title || "");
                setSummary(res.submission.submission_summary || "");
                setGithubUrl(res.submission.github_repo_url || "");
                setLiveUrl(res.submission.live_demo_url || "");
            } else {
                setExistingSubmission(null);
                setTitle("");
                setSummary("");
                setGithubUrl("");
                setLiveUrl("");
                setUploadedFile(null);
            }
        } catch {
            setExistingSubmission(null);
        } finally {
            setLoadingSubmission(false);
        }
    };

    // File upload handler
    const handleFileUpload = async (file: File) => {
        if (!submittingStage) return;
        setIsUploading(true);
        try {
            const ext = file.name.split(".").pop() || "pdf";
            const sig = await eventLifecycleApi.requestUploadSignature(eventId, submittingStage.id, file.name, ext);

            const uploadConfig: UploadSignatureConfig = {
                cloudName: sig.cloudName,
                apiKey: sig.apiKey,
                timestamp: sig.timestamp,
                publicId: sig.publicId,
                folder: sig.folder,
                signature: sig.signature,
                uploadUrl: `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType || "auto"}/upload`,
            };

            const uploadResult = await uploadClubImageToCloudinary(uploadConfig, file);

            setUploadedFile({
                url: uploadResult.secureUrl,
                publicId: uploadResult.publicId,
                filename: file.name,
                bytes: file.size,
            });
            toast.success("Deliverable asset uploaded successfully!", { title: "Asset Uploaded" });
        } catch (err: any) {
            toast.error(err.message || "Failed to upload file. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    // Final deliverable submission
    const handleSubmitDeliverable = async () => {
        if (!submittingStage) return;
        if (!title.trim()) {
            toast.error("Please enter a submission title or project name.");
            return;
        }

        setIsSubmitting(true);
        try {
            const assets: any[] = [];
            if (uploadedFile) {
                assets.push({
                    assetType: "file",
                    cloudinaryPublicId: uploadedFile.publicId,
                    cloudinaryUrl: uploadedFile.url,
                    fileName: uploadedFile.filename,
                    fileSizeBytes: uploadedFile.bytes,
                });
            }

            const payload = {
                title: title.trim(),
                summary: summary.trim(),
                githubUrl: githubUrl.trim() || undefined,
                liveUrl: liveUrl.trim() || undefined,
                assets,
            };

            const submitted = await eventLifecycleApi.submitStageDeliverable(eventId, submittingStage.id, payload);
            setExistingSubmission(submitted);
            toast.success("Deliverable submitted successfully! Submission receipt generated.", { title: "Delivered" });
            setSubmittingStage(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to submit deliverable.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 rounded-2xl bg-white border-2 border-black/20 text-center animate-pulse">
                <span className="text-xs font-black text-neutral-500">Loading Stage Milestones...</span>
            </div>
        );
    }

    if (stages.length === 0) {
        return null; // No multi-stage timeline configured
    }

    return (
        <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-black" />
                        <h3 className="font-black text-base sm:text-lg text-black tracking-tight">
                            Event Timeline & Round Pipeline
                        </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EE] text-black border border-black text-[11px] font-black">
                        {stages.length} {stages.length === 1 ? "Stage" : "Stages"}
                    </span>
                </div>

                {/* Timeline Pipeline */}
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-black/30">
                    {stages.map((stage, idx) => {
                        const now = new Date();
                        const sDate = new Date(stage.startsAt);
                        const eDate = new Date(stage.endsAt);
                        const isActive = now >= sDate && now <= eDate;
                        const isPast = now > eDate;

                        return (
                            <div key={stage.id} className="relative group">
                                {/* Dot Indicator */}
                                <div
                                    className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-black flex items-center justify-center font-black text-[11px] shadow-[1px_1px_0px_#000] ${
                                        isActive
                                            ? "bg-[#A2FF86] text-black ring-4 ring-[#A2FF86]/30 animate-pulse"
                                            : isPast
                                            ? "bg-black text-white"
                                            : "bg-[#FAF6EE] text-black"
                                    }`}
                                >
                                    {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                                </div>

                                {/* Stage Box */}
                                <div
                                    className={`p-4 rounded-2xl border-2 transition-all ${
                                        isActive
                                            ? "bg-white border-black shadow-[3px_3px_0px_#000] ring-2 ring-[#38BDF8]"
                                            : isPast
                                            ? "bg-[#FAF6EE]/60 border-black/40 shadow-[1px_1px_0px_#000]"
                                            : "bg-white border-black/60 shadow-[2px_2px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-sm text-black">{stage.name}</span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                    isActive
                                                        ? "bg-[#A2FF86] text-black border-black shadow-[1px_1px_0px_#000]"
                                                        : isPast
                                                        ? "bg-neutral-200 text-neutral-800 border-neutral-400"
                                                        : "bg-amber-100 text-amber-900 border-amber-300"
                                                }`}
                                            >
                                                {isActive ? "Live Now" : isPast ? "Concluded" : "Upcoming"}
                                            </span>
                                            {stage.requirements?.isElimination && (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black uppercase">
                                                    Elimination
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>
                                                {sDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
                                                {eDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                            </span>
                                        </div>
                                    </div>

                                    {stage.description && (
                                        <p className="text-xs text-neutral-700 font-medium mt-1.5 leading-relaxed">
                                            {stage.description}
                                        </p>
                                    )}

                                    {/* Action button if active and requires submission */}
                                    {isActive && (stage.requirements?.requiresSubmission || stage.actionType !== "none") && (
                                        <div className="mt-3 pt-3 border-t border-black/10 flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Deadline: {eDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                                            </span>

                                            {isRegistered || registrationStatus === "registered" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenSubmission(stage)}
                                                    className="px-3.5 py-1.5 rounded-xl bg-[#38BDF8] hover:bg-[#0ea5e9] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                >
                                                    <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Submit Deliverables</span>
                                                </button>
                                            ) : (
                                                <span className="text-[11px] font-bold text-neutral-500 italic">
                                                    Apply above to submit deliverables
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Submission Modal */}
            {submittingStage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg bg-white rounded-3xl border-3 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500">
                                    Round Deliverable
                                </span>
                                <h3 className="text-base font-black text-black">{submittingStage.name}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSubmittingStage(null)}
                                className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {loadingSubmission ? (
                            <div className="py-8 text-center text-xs font-bold text-neutral-600">
                                Checking previous submission receipts...
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs font-bold">
                                {existingSubmission && (
                                    <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-600 text-emerald-950 space-y-1">
                                        <div className="flex items-center gap-1.5 font-black">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                            <span>Previous Submission Recorded</span>
                                        </div>
                                        <p className="text-[11px] font-medium text-emerald-800">
                                            Version {existingSubmission.submission_version} submitted on{" "}
                                            {new Date(existingSubmission.submitted_at).toLocaleString()}. You can update your submission below.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        Submission Title / Project Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Orbix Protocol Architecture & Client"
                                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        Summary & Approach
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        placeholder="Brief summary of your implementation, architecture, and tech stack..."
                                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        GitHub Repository URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                            <GithubIcon className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            value={githubUrl}
                                            onChange={(e) => setGithubUrl(e.target.value)}
                                            placeholder="https://github.com/org/repo"
                                            className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        Live Demo / Preview URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            value={liveUrl}
                                            onChange={(e) => setLiveUrl(e.target.value)}
                                            placeholder="https://demo.orbix.dev"
                                            className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        Deliverable File (PDF, PPT, ZIP)
                                    </label>
                                    <div className="p-4 rounded-xl border-2 border-dashed border-black/40 text-center bg-[#FAF6EE]/40 space-y-2">
                                        {uploadedFile ? (
                                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                                                    <span className="truncate font-bold text-black">{uploadedFile.filename}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setUploadedFile(null)}
                                                    className="text-rose-600 hover:text-rose-800 text-[10px] font-black cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer">
                                                    <UploadCloud className="w-3.5 h-3.5" />
                                                    <span>{isUploading ? "Uploading..." : "Upload Deliverable Asset"}</span>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.ppt,.pptx,.zip"
                                                        disabled={isUploading}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(file);
                                                        }}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-neutral-500 font-medium mt-1">
                                                    PDF, PPTX, or ZIP up to 25MB. Directly synced to Cloudinary vault.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setSubmittingStage(null)}
                                        className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSubmitting || isUploading}
                                        onClick={handleSubmitDeliverable}
                                        className="px-6 py-2 rounded-xl bg-[#A2FF86] hover:bg-[#86ef6b] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>{isSubmitting ? "Submitting..." : "Submit Deliverable"}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
