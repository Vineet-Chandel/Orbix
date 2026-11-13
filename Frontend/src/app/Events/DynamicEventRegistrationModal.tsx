import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle } from "lucide-react";
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

    const isSubmittedView = isSubmitted || Boolean(formData?.userResponse);

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
                        isClosed={formData.isClosed}
                        closedReason={formData.closedReason}
                        onSuccess={(reg) => {
                            setIsSubmitted(true);
                            onSuccess({
                                ...event,
                                isRegistered: reg.status === "registered" || reg.status === "attended",
                                isPending: reg.status === "pending",
                                registrationStatus: reg.status,
                                ticketCode: reg.ticketCode,
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

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-3">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-neutral-600">
                            Loading event registration form...
                        </span>
                    </div>
                ) : formData?.form ? (
                    <StudentFormRenderer
                        form={formData.form}
                        event={event}
                        club={formData.club || { name: event.clubName }}
                        user={user}
                        studentProfile={formData.studentProfile}
                        userResponse={formData.userResponse}
                        draftResponse={formData.draftResponse}
                        isClosed={formData.isClosed}
                        closedReason={formData.closedReason}
                        onSuccess={(reg) => {
                            setIsSubmitted(true);
                            onSuccess({
                                ...event,
                                isRegistered: reg.status === "registered" || reg.status === "attended",
                                isPending: reg.status === "pending",
                                registrationStatus: reg.status,
                                ticketCode: reg.ticketCode,
                                totalApplicationsCount: (event.totalApplicationsCount || 0) + 1,
                            });
                        }}
                        onCancel={onClose}
                        onEditResponse={() => {
                            setIsSubmitted(false);
                            setFormData((prev) => (prev ? { ...prev, userResponse: undefined } : null));
                        }}
                    />
                ) : (
                    <div className="py-16 text-center space-y-3">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                        <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Form Unavailable</h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            The registration form for this event is currently not accessible.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
