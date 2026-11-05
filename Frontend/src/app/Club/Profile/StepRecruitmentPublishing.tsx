import React, { useState } from "react";
import {
    Sparkles,
    Radio,
    Clock,
    Lock,
    Globe,
    EyeOff,
    Archive,
    FileText,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import type { ClubVisibilityTier } from "../../../utils/clubProfileApi";

interface StepRecruitmentPublishingProps {
    recruitmentStatus: "open" | "upcoming" | "closed";
    onRecruitmentStatusChange: (val: "open" | "upcoming" | "closed") => void;
    recruitmentUrl: string;
    onRecruitmentUrlChange: (val: string) => void;
    recruitmentAnnouncement: string;
    onRecruitmentAnnouncementChange: (val: string) => void;
    visibility: ClubVisibilityTier;
    onVisibilityChange: (val: ClubVisibilityTier) => void;
    canPublish: boolean;
    onTriggerPublishValidation: () => void;
}

export const StepRecruitmentPublishing: React.FC<StepRecruitmentPublishingProps> = ({
    recruitmentStatus,
    onRecruitmentStatusChange,
    recruitmentUrl,
    onRecruitmentUrlChange,
    recruitmentAnnouncement,
    onRecruitmentAnnouncementChange,
    visibility,
    onVisibilityChange,
    canPublish,
    onTriggerPublishValidation,
}) => {
    // Confirmation modal state for sensitive visibility transitions
    const [pendingVisibility, setPendingVisibility] = useState<ClubVisibilityTier | null>(null);
    const [showArchivedDataInClosed, setShowArchivedDataInClosed] = useState(false);

    const recruitmentOptions = [
        {
            value: "open" as const,
            label: "Applications Open",
            badgeColor: "bg-[#a2ff86]",
            desc: "Auditions or membership drive currently active.",
            icon: Sparkles,
        },
        {
            value: "upcoming" as const,
            label: "Opening Soon",
            badgeColor: "bg-[#FFE566]",
            desc: "Announce auditions opening in upcoming weeks.",
            icon: Clock,
        },
        {
            value: "closed" as const,
            label: "Recruitment Closed",
            badgeColor: "bg-neutral-200",
            desc: "No active recruitment drive at this time.",
            icon: Radio,
        },
    ];

    const visibilityOptions: Array<{
        value: ClubVisibilityTier;
        label: string;
        badge: string;
        badgeBg: string;
        description: string;
        icon: any;
    }> = [
        {
            value: "draft",
            label: "Draft",
            badge: "Private Preview",
            badgeBg: "bg-neutral-200",
            description: "Only authorized club managers can preview the profile. Hidden from directory and visitors.",
            icon: FileText,
        },
        {
            value: "public",
            label: "Public",
            badge: "Live & Discoverable",
            badgeBg: "bg-[#a2ff86]",
            description: "Discoverable through the Orbix Club Directory, college campus search, and accessible to everyone.",
            icon: Globe,
        },
        {
            value: "unlisted",
            label: "Unlisted",
            badge: "Direct Link Only",
            badgeBg: "bg-[#FFE566]",
            description: "Accessible through the direct URL link, but excluded from public directories and search engine listings.",
            icon: EyeOff,
        },
        {
            value: "private",
            label: "Private",
            badge: "Members Only",
            badgeBg: "bg-amber-200",
            description: "Protected behind login and accessible only to registered club team members and coordinators.",
            icon: Lock,
        },
        {
            value: "archived",
            label: "Archived",
            badge: "Deactivated",
            badgeBg: "bg-rose-200 text-rose-800",
            description: "Deactivated and unavailable to external visitors. Can be restored anytime by an admin.",
            icon: Archive,
        },
    ];

    const handleSelectVisibility = (target: ClubVisibilityTier) => {
        if (target === visibility) return;

        // If user wants to publish publicly or unlisted, check publishing prerequisites
        if ((target === "public" || target === "unlisted") && !canPublish) {
            onTriggerPublishValidation();
            return;
        }

        // For actions with material impact (publishing, archiving, making private), prompt confirmation
        if (target === "public" || target === "archived" || target === "private") {
            setPendingVisibility(target);
        } else {
            onVisibilityChange(target);
        }
    };

    const confirmPendingVisibility = () => {
        if (pendingVisibility) {
            onVisibilityChange(pendingVisibility);
            setPendingVisibility(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b border-black/10 pb-4">
                <h2 className="text-lg font-black text-black tracking-tight">Recruitment & Publishing</h2>
                <p className="text-xs text-neutral-600 font-medium mt-1">
                    Manage your chapter's active recruitment drives and control profile publishing access.
                </p>
            </div>

            {/* A. RECRUITMENT STATUS */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-wider">
                        Member Recruitment Drive
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Set your recruitment status so interested students can learn about audition cycles and applications.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {recruitmentOptions.map((opt) => {
                        const isSelected = recruitmentStatus === opt.value;
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onRecruitmentStatusChange(opt.value)}
                                className={`p-4 rounded-xl border-2 border-black text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                                    isSelected
                                        ? "bg-[#a2ff86] text-black shadow-[3px_3px_0px_#000]"
                                        : "bg-white text-black hover:bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border border-black text-black ${
                                            isSelected ? "bg-white" : opt.badgeColor
                                        }`}
                                    >
                                        {opt.label}
                                    </span>
                                    {isSelected ? (
                                        <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                                    ) : (
                                        <Icon className="w-4 h-4 text-neutral-400" />
                                    )}
                                </div>
                                <p
                                    className={`text-[11px] leading-relaxed font-bold ${
                                        isSelected ? "text-neutral-900" : "text-neutral-600"
                                    }`}
                                >
                                    {opt.desc}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Conditional Fields based on Recruitment Status */}
                {recruitmentStatus === "open" && (
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-4 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-black" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Application Details for Active Recruitment
                            </h4>
                        </div>

                        {/* Application URL */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Application Form URL <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="url"
                                required
                                value={recruitmentUrl}
                                onChange={(e) => onRecruitmentUrlChange(e.target.value)}
                                placeholder="https://forms.gle/... or https://typeform.com/..."
                                className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500 font-medium">
                                Direct link to your Google Form, Typeform, or audition registration portal.
                            </p>
                        </div>

                        {/* Announcement / Instructions */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Audition Instructions & Guidelines <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                                </label>
                                <span className="text-[10px] font-mono text-neutral-500">
                                    {recruitmentAnnouncement.length}/400
                                </span>
                            </div>
                            <textarea
                                rows={3}
                                value={recruitmentAnnouncement}
                                onChange={(e) => onRecruitmentAnnouncementChange(e.target.value.slice(0, 400))}
                                placeholder="e.g. Open to all branches! Auditions include a coding round and team discussion. Bring your laptop."
                                maxLength={400}
                                className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000] resize-none"
                            />
                        </div>
                    </div>
                )}

                {recruitmentStatus === "upcoming" && (
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-4 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-black" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Upcoming Auditions Announcement
                            </h4>
                        </div>

                        {/* Optional teaser announcement */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Audition Announcement <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                                </label>
                                <span className="text-[10px] font-mono text-neutral-500">
                                    {recruitmentAnnouncement.length}/400
                                </span>
                            </div>
                            <textarea
                                rows={2}
                                value={recruitmentAnnouncement}
                                onChange={(e) => onRecruitmentAnnouncementChange(e.target.value.slice(0, 400))}
                                placeholder="e.g. Fall 2025 auditions kick off next Monday. Stay tuned for registration links!"
                                maxLength={400}
                                className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000] resize-none"
                            />
                        </div>
                    </div>
                )}

                {recruitmentStatus === "closed" && (recruitmentUrl || recruitmentAnnouncement) && (
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setShowArchivedDataInClosed(!showArchivedDataInClosed)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-black cursor-pointer"
                        >
                            <span>Previously saved recruitment information is preserved</span>
                            {showArchivedDataInClosed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showArchivedDataInClosed && (
                            <div className="mt-2 p-3.5 rounded-xl bg-[#FAF6EE] border border-black/20 text-xs text-neutral-600 space-y-1">
                                {recruitmentUrl && (
                                    <p>
                                        <strong>Previous Form:</strong> {recruitmentUrl}
                                    </p>
                                )}
                                {recruitmentAnnouncement && (
                                    <p>
                                        <strong>Previous Notice:</strong> {recruitmentAnnouncement}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* B. PROFILE PUBLISHING & VISIBILITY */}
            <div className="space-y-4 pt-6 border-t-2 border-black/10">
                <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-wider">
                        Who Can See This Club Profile?
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Select a single visibility setting to control public directory discovery and visitor access.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {visibilityOptions.map((opt) => {
                        const isSelected = visibility === opt.value;
                        const Icon = opt.icon;

                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelectVisibility(opt.value)}
                                className={`p-4 sm:p-5 rounded-2xl border-2 border-black text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                                    isSelected
                                        ? "bg-[#a2ff86] text-black shadow-[4px_4px_0px_#000] scale-[1.01]"
                                        : "bg-white text-black hover:bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-7 h-7 rounded-lg border border-black flex items-center justify-center shrink-0 ${
                                                isSelected ? "bg-white text-black" : "bg-[#FAF6EE] text-black"
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-black">{opt.label}</span>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border border-black text-black ${
                                            isSelected ? "bg-white" : opt.badgeBg
                                        }`}
                                    >
                                        {opt.badge}
                                    </span>
                                </div>
                                <p
                                    className={`text-[11px] leading-relaxed font-bold ${
                                        isSelected ? "text-neutral-900" : "text-neutral-600"
                                    }`}
                                >
                                    {opt.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONFIRMATION MODAL FOR SENSITIVE VISIBILITY SHIFTS */}
            <ConfirmationModal
                isOpen={Boolean(pendingVisibility)}
                title={
                    pendingVisibility === "public"
                        ? "Publish Profile to Directory?"
                        : pendingVisibility === "archived"
                        ? "Archive Club Profile?"
                        : "Make Profile Private?"
                }
                description={
                    pendingVisibility === "public"
                        ? "Your club profile will be publicly discoverable through the Orbix Club Directory and accessible to all students."
                        : pendingVisibility === "archived"
                        ? "Archiving will hide your profile from external visitors. You can restore this profile back to active anytime."
                        : "Making the profile private restricts viewing to registered chapter members only."
                }
                confirmLabel={
                    pendingVisibility === "public"
                        ? "Publish Profile"
                        : pendingVisibility === "archived"
                        ? "Archive Profile"
                        : "Confirm Private"
                }
                cancelLabel="Cancel"
                variant={pendingVisibility === "archived" ? "danger" : "primary"}
                onConfirm={confirmPendingVisibility}
                onClose={() => setPendingVisibility(null)}
            />
        </div>
    );
};
