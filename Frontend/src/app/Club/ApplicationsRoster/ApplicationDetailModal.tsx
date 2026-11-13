import React, { useState } from "react";
import {
    X,
    Check,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Paperclip,
    Copy,
    Building2,
    MapPin,
    Mail,
    Phone,
    User,
    Calendar,
    GraduationCap,
    Clock,
} from "lucide-react";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import type { DynamicQuestionMeta } from "./types";

interface ApplicationDetailModalProps {
    applicant: ClubEventApplicantRow | null;
    dynamicQuestions: DynamicQuestionMeta[];
    isOpen: boolean;
    onClose: () => void;
    onStatusChange: (
        applicant: ClubEventApplicantRow,
        status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled"
    ) => Promise<void>;
    isUpdating?: boolean;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
    applicant,
    dynamicQuestions,
    isOpen,
    onClose,
    onStatusChange,
    isUpdating = false,
}) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    if (!isOpen || !applicant) return null;

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const answersObj = { ...(applicant.answers || {}), ...(applicant.formResponse || {}) };
    const fileAttachments = applicant.fileAttachments || [];

    const statusBadge = () => {
        switch (applicant.status) {
            case "registered":
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 border border-emerald-800 shadow-[1px_1px_0px_#000]">
                        Accepted
                    </span>
                );
            case "attended":
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-100 text-sky-950 border border-sky-800 shadow-[1px_1px_0px_#000]">
                        Checked-In
                    </span>
                );
            case "rejected":
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-950 border border-rose-800 shadow-[1px_1px_0px_#000]">
                        Rejected
                    </span>
                );
            case "waitlisted":
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000]">
                        Waitlisted
                    </span>
                );
            default:
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-800 shadow-[1px_1px_0px_#000]">
                        Pending Review
                    </span>
                );
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-3xl my-8 rounded-3xl bg-[#FAF6EE] border-3 border-black shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-6 bg-white border-b-3 border-black flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        {applicant.avatarUrl ? (
                            <img
                                src={applicant.avatarUrl}
                                alt={applicant.applicantName}
                                className="w-14 h-14 rounded-2xl border-2 border-black object-cover shadow-[2px_2px_0px_#000] shrink-0"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-black text-[#a2ff86] flex items-center justify-center font-black text-lg border-2 border-black shadow-[2px_2px_0px_#000] shrink-0">
                                {(applicant.applicantName || "S").slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-xl font-black text-black truncate">
                                    {applicant.applicantName}
                                </h3>
                                {statusBadge()}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-600 font-bold flex-wrap">
                                {applicant.username ? (
                                    <a
                                        href={`/profile/${applicant.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-700 hover:underline flex items-center gap-0.5"
                                    >
                                        <span>@{applicant.username}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : null}
                                {applicant.ticketCode && (
                                    <span className="font-mono text-[11px] bg-neutral-100 px-2 py-0.5 rounded border border-black/30">
                                        ID: {applicant.ticketCode}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>

                {/* Organizer Review Action Toolbar */}
                <div className="px-6 py-3 bg-[#FFE566] border-b-2 border-black flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-black uppercase text-black tracking-wide">
                        Organizer Actions:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        {applicant.status === "pending" && (
                            <>
                                <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => onStatusChange(applicant, "registered")}
                                    className="px-3 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                >
                                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Accept Application</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => onStatusChange(applicant, "rejected")}
                                    className="px-3 py-1.5 rounded-xl bg-rose-200 hover:bg-rose-300 text-rose-950 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                >
                                    <XCircle className="w-4 h-4 stroke-[2.5]" />
                                    <span>Reject Application</span>
                                </button>
                            </>
                        )}

                        {applicant.status === "registered" && (
                            <>
                                <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => onStatusChange(applicant, "attended")}
                                    className="px-3 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                >
                                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Arrived Attendee</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => onStatusChange(applicant, "rejected")}
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1"
                                >
                                    <XCircle className="w-4 h-4" />
                                    <span>Revoke</span>
                                </button>
                            </>
                        )}

                        {applicant.status === "attended" && (
                            <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => onStatusChange(applicant, "registered")}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1"
                            >
                                <span>Undo Arrived</span>
                            </button>
                        )}

                        {applicant.status === "rejected" && (
                            <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => onStatusChange(applicant, "registered")}
                                className="px-3 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Re-Accept Application</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Body - Scrollable content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* SECTION 1: Personal & Academic Information */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                        <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5 border-b-2 border-black/10 pb-2">
                            <User className="w-3.5 h-3.5 text-black" />
                            <span>Student Personal & Academic Profile</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            {/* Email */}
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Email Address
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <a
                                        href={`mailto:${applicant.applicantEmail}`}
                                        className="font-bold text-black hover:underline truncate"
                                    >
                                        {applicant.applicantEmail || "—"}
                                    </a>
                                    {applicant.applicantEmail && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyToClipboard(applicant.applicantEmail, "email")
                                            }
                                            className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-black"
                                            title="Copy email"
                                        >
                                            {copiedField === "email" ? (
                                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Phone Number
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="font-bold text-black">
                                        {applicant.phoneNumber || "—"}
                                    </span>
                                    {applicant.phoneNumber && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyToClipboard(applicant.phoneNumber!, "phone")
                                            }
                                            className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-black"
                                            title="Copy phone"
                                        >
                                            {copiedField === "phone" ? (
                                                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Institution */}
                            <div className="sm:col-span-2">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Institution / College
                                </span>
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="font-black text-black">
                                        {applicant.institutionName ||
                                            applicant.campusName ||
                                            "Host Campus"}
                                    </span>
                                    {applicant.institutionVerificationStatus === "verified" && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-700 font-black">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                            <span>AISHE Verified</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    City & State
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="font-bold text-black">
                                        {[applicant.institutionCity, applicant.institutionState]
                                            .filter(Boolean)
                                            .join(", ") || "—"}
                                    </span>
                                </div>
                            </div>

                            {/* Roll Number & Department */}
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Roll / Student ID & Department
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="font-bold text-black">
                                        {applicant.rollNumber ||
                                            answersObj["q_roll_number"] ||
                                            applicant.department ||
                                            answersObj["q_department"]
                                            ? [
                                                applicant.rollNumber ||
                                                answersObj["q_roll_number"],
                                                applicant.department ||
                                                answersObj["q_department"],
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Complete Registration Form Responses */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                        <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5 border-b-2 border-black/10 pb-2">
                            <span>Complete Registration Form Responses</span>
                        </h4>

                        {dynamicQuestions.length === 0 ? (
                            <p className="text-xs text-neutral-500 font-medium">
                                No custom registration questions configured for this event.
                            </p>
                        ) : (
                            <div className="space-y-3.5">
                                {dynamicQuestions.map((q) => {
                                    // Check file attachments
                                    const matchedFiles = fileAttachments.filter(
                                        (f) => f.questionId === q.id
                                    );
                                    let answerVal = answersObj[q.id];
                                    if (answerVal === undefined && q.id.startsWith("q_")) {
                                        answerVal = answersObj[q.id.replace(/^q_/, "")];
                                    } else if (answerVal === undefined) {
                                        answerVal = answersObj[`q_${q.id}`];
                                    }

                                    return (
                                        <div
                                            key={q.id}
                                            className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black/30 space-y-1.5"
                                        >
                                            <span className="text-[11px] font-black uppercase text-neutral-700 block">
                                                {q.label}
                                            </span>

                                            {matchedFiles.length > 0 ? (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {matchedFiles.map((file, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={file.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-bold text-indigo-700 hover:bg-neutral-50 shadow-[1px_1px_0px_#000]"
                                                        >
                                                            <Paperclip className="w-3.5 h-3.5" />
                                                            <span className="truncate max-w-xs">
                                                                {file.fileName || "Download Attached File"}
                                                            </span>
                                                            <ExternalLink className="w-3 h-3 text-neutral-500" />
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : answerVal === null ||
                                                answerVal === undefined ||
                                                answerVal === "" ? (
                                                <span className="text-neutral-400 font-normal text-xs">
                                                    —
                                                </span>
                                            ) : Array.isArray(answerVal) ? (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {answerVal.map((item, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2.5 py-0.5 rounded-full bg-white border border-black text-xs font-bold text-black shadow-[1px_1px_0px_#000]"
                                                        >
                                                            {String(item)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : String(answerVal).startsWith("http://") ||
                                                String(answerVal).startsWith("https://") ? (
                                                <a
                                                    href={String(answerVal)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline break-all"
                                                >
                                                    <span>{String(answerVal)}</span>
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                </a>
                                            ) : (
                                                <p className="text-xs font-bold text-black whitespace-pre-wrap leading-relaxed">
                                                    {String(answerVal)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: Timestamps & Audit Trail */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Registered At</span>
                            </span>
                            <span className="font-bold text-black">
                                {applicant.registeredAt
                                    ? new Date(applicant.registeredAt).toLocaleString()
                                    : "—"}
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Checked-In At</span>
                            </span>
                            <span className="font-bold text-black">
                                {applicant.checkedInAt
                                    ? new Date(applicant.checkedInAt).toLocaleString()
                                    : "Not yet checked-in"}
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                Pass Code
                            </span>
                            <span className="font-mono text-xs font-black text-black">
                                {applicant.ticketCode || "—"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t-2 border-black flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Close Detail View
                    </button>
                </div>
            </div>
        </div>
    );
};
