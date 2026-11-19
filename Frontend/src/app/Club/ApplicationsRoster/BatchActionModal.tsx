import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
    X,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Users,
    Sparkles,
} from "lucide-react";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import { OrbixButton } from "../../../components/ui/loader";

interface BatchActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionType: "registered" | "rejected" | null;
    selectedApplicants: ClubEventApplicantRow[];
    onConfirm: (reviewNotes?: string) => Promise<void>;
    isUpdating: boolean;
}

export const BatchActionModal: React.FC<BatchActionModalProps> = ({
    isOpen,
    onClose,
    actionType,
    selectedApplicants,
    onConfirm,
    isUpdating,
}) => {
    const [reviewNotes, setReviewNotes] = useState("");

    if (!isOpen || !actionType || selectedApplicants.length === 0) return null;

    const isAccept = actionType === "registered";
    const count = selectedApplicants.length;

    const handleConfirmSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm(reviewNotes.trim() || undefined);
        setReviewNotes("");
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto flex flex-col max-h-[90vh]">
                {/* Modal Top Bar */}
                <div
                    className={`px-5 py-3.5 border-b-3 border-black flex items-center justify-between gap-3 shrink-0 ${
                        isAccept ? "bg-[#a2ff86]" : "bg-[#ffb4b4]"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {isAccept ? (
                            <CheckCircle2 className="w-5 h-5 text-black stroke-[3]" />
                        ) : (
                            <XCircle className="w-5 h-5 text-black stroke-[3]" />
                        )}
                        <h3 className="font-black text-base sm:text-lg text-black tracking-tight">
                            {isAccept
                                ? `Batch Accept ${count} Applicant${count > 1 ? "s" : ""}`
                                : `Batch Reject ${count} Applicant${count > 1 ? "s" : ""}`}
                        </h3>
                    </div>

                    <button
                        type="button"
                        disabled={isUpdating}
                        onClick={onClose}
                        className="p-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleConfirmSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                    {/* Notice Banner */}
                    <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black text-black">
                            {isAccept ? (
                                <Sparkles className="w-4 h-4 text-emerald-700" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-700" />
                            )}
                            <span>Action Summary & Notifications</span>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            {isAccept
                                ? `You are approving ${count} applicant${count > 1 ? "s" : ""} at once. Their registration tickets will be activated and sent to their verified student notifications.`
                                : `You are rejecting ${count} applicant${count > 1 ? "s" : ""} at once. Their application status will be updated to rejected with notification dispatch.`}
                        </p>
                    </div>

                    {/* Selected Applicants Preview List */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-black uppercase text-neutral-700 px-1">
                            <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                <span>Selected Students ({count})</span>
                            </span>
                        </div>

                        <div className="max-h-48 overflow-y-auto rounded-xl border-2 border-black bg-white divide-y divide-black/10 shadow-[2px_2px_0px_#000]">
                            {selectedApplicants.map((app) => (
                                <div
                                    key={app.id}
                                    className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#FAF6EE]/50"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {app.avatarUrl ? (
                                            <img
                                                src={app.avatarUrl}
                                                alt={app.applicantName}
                                                className="w-7 h-7 rounded-lg border border-black object-cover shrink-0"
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-lg border border-black bg-[#FFE566] text-black font-black flex items-center justify-center text-[10px] shrink-0">
                                                {app.applicantName.slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <span className="font-black text-black block truncate leading-tight">
                                                {app.applicantName}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 font-mono truncate block">
                                                {app.applicantEmail || app.username || "Student"}
                                            </span>
                                        </div>
                                    </div>

                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${
                                            app.status === "registered"
                                                ? "bg-emerald-100 text-emerald-950 border-emerald-800"
                                                : app.status === "pending"
                                                ? "bg-amber-100 text-amber-950 border-amber-800"
                                                : "bg-rose-100 text-rose-950 border-rose-800"
                                        }`}
                                    >
                                        {app.status === "registered"
                                            ? "Accepted"
                                            : app.status === "pending"
                                            ? "Pending"
                                            : app.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Optional Review Notes */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-black block">
                            Review Notes / Remarks <span className="text-neutral-500 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder={
                                isAccept
                                    ? "e.g. Approved in Round 1 screening by club staff"
                                    : "e.g. Did not meet minimum eligibility criteria"
                            }
                            rows={2}
                            maxLength={250}
                            className="w-full px-3 py-2 rounded-xl border-2 border-black bg-white text-xs font-medium focus:outline-none focus:shadow-[2px_2px_0px_#000] resize-none"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-3 border-t-2 border-black/10 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black font-bold text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Cancel
                        </button>

                        <OrbixButton
                            type="submit"
                            disabled={isUpdating}
                            loading={isUpdating}
                            variant={isAccept ? "lime" : "primary"}
                            className={`px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer ${
                                !isAccept ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
                            }`}
                        >
                            {isAccept ? `Confirm Accept (${count})` : `Confirm Reject (${count})`}
                        </OrbixButton>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
