import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
    X,
    GraduationCap,
    Building2,
    ShieldAlert,
    ArrowRight,
    Lock,
} from "lucide-react";
import { useModalDismiss } from "../hooks/useModalDismiss";

export interface CollegeRestrictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventTitle: string;
    eventCollegeName: string;
    userCollegeName?: string;
    hostClubName?: string;
    onViewMyCollegeEvents?: () => void;
}

export const CollegeRestrictionModal: React.FC<CollegeRestrictionModalProps> = ({
    isOpen,
    onClose,
    eventTitle,
    eventCollegeName,
    userCollegeName,
    hostClubName,
    onViewMyCollegeEvents,
}) => {
    useModalDismiss({ isOpen, onClose });

    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restriction-modal-title"
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-[#FAF6EE] border-3 border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
            >
                {/* Header */}
                <div className="p-4 sm:p-5 bg-white border-b-2 border-black flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 border border-black text-[11px] font-black uppercase tracking-wider text-rose-800 shadow-[1.5px_1.5px_0px_#000]">
                            <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Campus Restricted Event</span>
                        </div>
                        <h2
                            id="restriction-modal-title"
                            className="text-lg sm:text-xl font-black text-black tracking-tight"
                        >
                            You Can't Register for this College Event
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
                    {/* Event Banner Snippet */}
                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Target Event
                        </span>
                        <h3 className="text-sm font-black text-black line-clamp-1">
                            {eventTitle}
                        </h3>
                        {hostClubName && (
                            <p className="text-xs font-bold text-neutral-600">
                                Organized by {hostClubName}
                            </p>
                        )}
                    </div>

                    {/* Side-by-side Institutional Comparison */}
                    <div className="space-y-2">
                        <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                                    Host Institution (Exclusive Access)
                                </span>
                                <p className="text-xs sm:text-sm font-black text-black truncate">
                                    {eventCollegeName || "Host Campus"}
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-200 border-2 border-black flex items-center justify-center shrink-0">
                                <GraduationCap className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                                    Your Profile Affiliation
                                </span>
                                <p className="text-xs sm:text-sm font-black text-black truncate">
                                    {userCollegeName || "Not Affiliated with this Campus"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Explanatory Callout */}
                    <div className="p-3.5 rounded-xl bg-[#FFE566]/25 border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5 text-xs text-neutral-800">
                        <Lock className="w-4 h-4 text-black shrink-0 mt-0.5" />
                        <p className="font-medium leading-relaxed">
                            To ensure fair access to campus resources and verified attendance tracking, this event is strictly reserved for students currently enrolled at{" "}
                            <strong className="text-black font-black">{eventCollegeName}</strong>.
                        </p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 sm:p-5 bg-white border-t-2 border-black flex flex-col sm:flex-row items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Close
                    </button>

                    {onViewMyCollegeEvents && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                onViewMyCollegeEvents();
                            }}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>View My Campus Events</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
