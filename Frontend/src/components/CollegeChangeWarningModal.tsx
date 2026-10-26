import { useEffect } from "react";
import { AlertTriangle, Lock, GraduationCap, X, Clock, ShieldAlert } from "lucide-react";

export interface CollegeChangeWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    currentCollegeName?: string | null;
    isLocked?: boolean;
    remainingMs?: number;
    nextAllowedDate?: string | null;
}

export function CollegeChangeWarningModal({
    isOpen,
    onClose,
    onConfirm,
    currentCollegeName,
    isLocked = false,
    remainingMs = 0,
    nextAllowedDate,
}: CollegeChangeWarningModalProps) {
    // ESC key closes modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Calculate human-friendly remaining time text
    const formatRemainingTime = () => {
        if (!remainingMs || remainingMs <= 0) {
            if (nextAllowedDate) {
                const diff = new Date(nextAllowedDate).getTime() - Date.now();
                if (diff > 0) {
                    const hours = Math.ceil(diff / (1000 * 60 * 60));
                    if (hours > 24) {
                        const days = Math.floor(hours / 24);
                        const remHours = hours % 24;
                        return `${days}d ${remHours}h remaining`;
                    }
                    return `${hours} hour${hours === 1 ? "" : "s"} remaining`;
                }
            }
            return "Less than an hour remaining";
        }

        const totalHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        if (totalHours > 24) {
            const days = Math.floor(totalHours / 24);
            const hours = totalHours % 24;
            return `${days} day${days === 1 ? "" : "s"} ${hours > 0 ? `${hours} hr ` : ""}remaining`;
        }
        return `${totalHours} hour${totalHours === 1 ? "" : "s"} remaining`;
    };

    const formatUnlockDate = () => {
        if (!nextAllowedDate) return null;
        try {
            const d = new Date(nextAllowedDate);
            return d.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return nextAllowedDate;
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="collegeModalTitle"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0 ${
                                isLocked ? "bg-[#FFE566]" : "bg-[#FFE566]"
                            }`}
                        >
                            {isLocked ? (
                                <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-black stroke-[2.5]" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3
                                id="collegeModalTitle"
                                className="text-base sm:text-lg font-black tracking-tight text-black truncate"
                            >
                                {isLocked ? "College Identity Locked" : "Change College Identity?"}
                            </h3>
                            <p className="text-xs text-neutral-600 font-semibold truncate">
                                {isLocked
                                    ? "3-day cooldown is currently in effect"
                                    : "Please review before unlinking institution"}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Body Content */}
                {isLocked ? (
                    /* Locked View */
                    <div className="space-y-3.5">
                        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 stroke-[2.5]" />
                            <div className="space-y-1">
                                <p className="font-black text-amber-900">
                                    Cooldown Active: {formatRemainingTime()}
                                </p>
                                <p className="text-amber-800 text-[11px]">
                                    You recently updated your college affiliation. To preserve verified student leaderboard authenticity and institution rankings, college changes can only be made once every 3 days.
                                </p>
                            </div>
                        </div>

                        {currentCollegeName && (
                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                    <GraduationCap className="w-4 h-4 text-black stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Current Affiliation
                                    </span>
                                    <h4 className="text-xs font-black text-black truncate">
                                        {currentCollegeName}
                                    </h4>
                                </div>
                            </div>
                        )}

                        {nextAllowedDate && (
                            <div className="text-[11px] text-neutral-600 font-semibold px-1">
                                <span>Next available change: </span>
                                <span className="font-black text-black">
                                    {formatUnlockDate()}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Warning View */
                    <div className="space-y-3.5">
                        {/* Mandatory Cooldown Warning */}
                        <div className="p-3.5 rounded-xl bg-[#FFE566]/25 border-2 border-black shadow-[2px_2px_0px_#000] text-black text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-black shrink-0 mt-0.5 stroke-[2.5]" />
                            <div className="space-y-1">
                                <p className="font-black text-black text-xs uppercase tracking-wide">
                                    3-Day Cooldown Policy
                                </p>
                                <p className="text-neutral-800 text-xs font-medium">
                                    If you change or delete your college identity, you will be able to change it again{" "}
                                    <span className="font-black underline decoration-2 decoration-black">
                                        only after 3 days (72 hours)
                                    </span>
                                    .
                                </p>
                            </div>
                        </div>

                        {currentCollegeName && (
                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                    <GraduationCap className="w-4 h-4 text-black stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Currently Linked
                                    </span>
                                    <h4 className="text-xs font-black text-black truncate">
                                        {currentCollegeName}
                                    </h4>
                                </div>
                            </div>
                        )}

                        <p className="text-[11px] text-neutral-600 font-medium leading-relaxed px-1">
                            Proceeding will allow you to select another verified institution or remove your college. Once saved, your institution profile will be locked for 3 days.
                        </p>
                    </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                    {isLocked ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] cursor-pointer transition-all"
                        >
                            Understood
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] cursor-pointer transition-all"
                            >
                                Keep Current College
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    if (onConfirm) onConfirm();
                                }}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition-all"
                            >
                                Proceed & Change
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
