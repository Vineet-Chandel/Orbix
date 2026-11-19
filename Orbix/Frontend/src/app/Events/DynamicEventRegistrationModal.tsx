import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, AlertCircle, Ban, AlertTriangle, FileText, Lock, Clock } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import type { CollegeEventItem } from "../../api/collegeEventsApi";
import {
    fetchPublicEventForm,
    type PublicFormResponse,
} from "../../api/clubEventFormApi";
import { StudentFormRenderer } from "../Club/FormBuilder/StudentFormRenderer";
import { OrbixLoader } from "../../components/ui/loader";

export interface DynamicEventRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: CollegeEventItem | null;
    onSuccess: (updatedEvent: CollegeEventItem) => void;
}

export const DynamicEventRegistrationModal: React.FC<DynamicEventRegistrationModalProps> = ({
    isOpen,
    onClose,
    event,
    onSuccess,
}) => {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<PublicFormResponse | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (isOpen && event) {
            setLoading(true);
            setIsSubmitted(false);
            fetchPublicEventForm(event.id)
                .then((res) => {
                    setFormData(res);
                })
                .catch((err) => {
                    console.error("Failed to load form:", err);
                    toast.error(err.message || "Failed to load registration form.");
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isOpen, event]);

    if (!isOpen || !event || typeof document === "undefined") return null;

    const isWithdrawn =
        event?.registrationStatus === "cancelled" ||
        formData?.userResponse?.status === "cancelled" ||
        (formData?.isClosed && formData?.closedReason?.includes("withdrawn"));

    if (isWithdrawn) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
                <div className="relative w-full max-w-lg my-auto bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-6 sm:p-7 space-y-5 text-left">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <Ban className="w-5 h-5 text-rose-400 stroke-[2.5]" />
                            </div>
                            <div>
                                <span className="font-black text-sm uppercase tracking-tight text-black block">Application Withdrawn</span>
                                <span className="text-[10px] font-bold text-neutral-500 block">Registration Policy Enforcement</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 border border-black shadow-[1px_1px_0px_#000]">
                            Withdrawn
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 stroke-[2.5]" />
                            <span>Re-Registration Restricted</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-800 leading-relaxed">
                            Our system recorded that your application for{" "}
                            <strong className="text-black font-black">"{event.title}"</strong> was voluntarily withdrawn.
                        </p>
                        <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                            To ensure fairness and seat allocation integrity for all participants, organizers do not permit re-applying or joining new squads after an application has been withdrawn in the same event cycle.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5 text-xs font-bold text-neutral-700">
                        <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                            <span>Event:</span>
                            <span className="text-black font-black">{event.title}</span>
                        </div>
                        <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                            <span>Organized By:</span>
                            <span className="text-black font-black">{event.clubName}</span>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                        <Link
                            to="/activity?tab=applications"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View In Activity</span>
                        </Link>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    const isSubmittedView = isSubmitted || Boolean(formData?.userResponse && formData.userResponse.status !== "cancelled");

    // If application has been submitted, render ONLY the single application card without redundant outer modal box
    if (isSubmittedView && formData?.form) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
                <div className="relative w-full max-w-xl my-auto print:m-0 print:w-full print:max-w-full">
                    {/* Close Button attached to single card */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30 print:hidden"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <StudentFormRenderer
                        form={formData.form}
                        event={event}
                        club={formData.club || { name: event.clubName }}
                        user={user}
                        studentProfile={formData.studentProfile}
                        userResponse={formData.userResponse}
                        draftResponse={formData.draftResponse}
                        isClosed={formData.isClosed || event.isRegistrationClosed}
                        closedReason={formData.closedReason || (event.isRegistrationClosed ? "The registration window for this event has closed. Applications are no longer accepted." : undefined)}
                        onSuccess={(reg) => {
                            setIsSubmitted(true);
                            onSuccess({
                                ...event,
                                isRegistered: reg.status === "registered" || reg.status === "attended",
                                isPending: reg.status === "pending",
                                registrationStatus: reg.status,
                                ticketCode: reg.ticketCode,
                                teamId: reg.teamId || event.teamId,
                                teamRole: reg.teamRole || event.teamRole,
                                totalApplicationsCount: (event.totalApplicationsCount || 0) + 1,
                            });
                        }}
                        onCancel={onClose}
                        onEditResponse={() => {
                            setIsSubmitted(false);
                            setFormData((prev) => (prev ? { ...prev, userResponse: undefined } : null));
                        }}
                    />
                </div>
            </div>,
            document.body
        );
    }

    // 1. Loading State: Single Focused Block (No nested boxes)
    if (loading) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
                <div className="relative w-full max-w-sm bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-8 text-center text-black space-y-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <OrbixLoader size="lg" />
                    <span className="text-xs font-black text-neutral-700 block">
                        Loading event registration form...
                    </span>
                </div>
            </div>,
            document.body
        );
    }

    const isClosed = Boolean(formData?.isClosed || event?.isRegistrationClosed);

    // 2. Closed State: Single Clean Block (No block into block into block)
    if (isClosed) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
                <div className="relative w-full max-w-lg my-auto bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-6 sm:p-7 space-y-5 text-left text-black">
                    {/* Close Button directly attached to single card */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-[#FFE566] flex items-center justify-center text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <div>
                                <span className="font-black text-sm uppercase tracking-tight text-black block">Registration Closed</span>
                                <span className="text-[10px] font-bold text-neutral-500 block uppercase tracking-wider">Event Registration Window</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 border-2 border-black shadow-[1px_1px_0px_#000]">
                            Concluded
                        </span>
                    </div>

                    {/* Notice Block */}
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                            <Clock className="w-4 h-4 text-amber-700 shrink-0 stroke-[2.5]" />
                            <span>Deadline Reached</span>
                        </div>
                        <p className="text-xs font-semibold text-neutral-800 leading-relaxed whitespace-pre-line">
                            {formData?.closedReason || (event.isRegistrationClosed ? "The registration window for this event has closed. Applications are no longer accepted." : "Registrations are currently closed for this event.")}
                        </p>
                    </div>

                    {/* Event Info Snapshot */}
                    <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5 text-xs font-bold text-neutral-700">
                        <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                            <span>Event:</span>
                            <span className="text-black font-black">{event.title}</span>
                        </div>
                        <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                            <span>Organized By:</span>
                            <span className="text-black font-black">{event.clubName}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 3. Form Unavailable State: Single Clean Block
    if (!formData?.form) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
                <div className="relative w-full max-w-md bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 text-center text-black space-y-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-black shadow-[2px_2px_0px_#000] mx-auto flex items-center justify-center text-amber-800">
                        <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-black">Form Unavailable</h4>
                    <p className="text-xs font-semibold text-neutral-600">
                        The registration form for this event is currently not accessible.
                    </p>
                    <div className="pt-2 flex items-center justify-center">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 4. Active Form View: Single Cohesive Container
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
            <div className="relative w-full max-w-4xl xl:max-w-5xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-4 sm:p-6 md:p-8 max-h-[92vh] overflow-y-auto text-black">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-20"
                    title="Close"
                >
                    <X className="w-4 h-4 stroke-[2.5]" />
                </button>

                <StudentFormRenderer
                    form={formData.form}
                    event={event}
                    club={formData.club || { name: event.clubName }}
                    user={user}
                    studentProfile={formData.studentProfile}
                    userResponse={formData.userResponse}
                    draftResponse={formData.draftResponse}
                    isClosed={false}
                    onSuccess={(reg) => {
                        setIsSubmitted(true);
                        onSuccess({
                            ...event,
                            isRegistered: reg.status === "registered" || reg.status === "attended",
                            isPending: reg.status === "pending",
                            registrationStatus: reg.status,
                            ticketCode: reg.ticketCode,
                            teamId: reg.teamId || event.teamId,
                            teamRole: reg.teamRole || event.teamRole,
                            totalApplicationsCount: (event.totalApplicationsCount || 0) + 1,
                        });
                    }}
                    onCancel={onClose}
                    onEditResponse={() => {
                        setIsSubmitted(false);
                        setFormData((prev) => (prev ? { ...prev, userResponse: undefined } : null));
                    }}
                />
            </div>
        </div>,
        document.body
    );
};
