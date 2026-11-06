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

    useEffect(() => {
        if (isOpen && event) {
            setLoading(true);
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

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
            <div className="relative w-full max-w-4xl xl:max-w-5xl bg-white dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 sm:p-8 max-h-[92vh] overflow-y-auto text-neutral-900 dark:text-neutral-100">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 cursor-pointer transition-colors z-20"
                    title="Close"
                >
                    <X className="w-4 h-4" />
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
