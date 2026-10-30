import React from "react";
import { Link } from "react-router-dom";
import {
    Lock,
    Globe,
    Check,
    X,
    Eye,
    ExternalLink,
    Building2,
    Users,
    Calendar,
    Loader2,
    ArrowLeft,
    Shield,
} from "lucide-react";
import { NeoToggle } from "../../../components/NeoToggle";

interface ClubAccountPrivacyViewProps {
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        recruitment_status?: string;
        profile_visibility?: string;
    };
    user: any;
    isPublic: boolean;
    isUpdating: boolean;
    onTogglePrivacy: (newIsPublic: boolean) => Promise<void>;
    onBack?: () => void;
}

export const ClubAccountPrivacyView: React.FC<ClubAccountPrivacyViewProps> = ({
    club,
    isPublic,
    isUpdating,
    onTogglePrivacy,
    onBack,
}) => {
    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header / Subview Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                            aria-label="Back to Settings Hub"
                            title="Back to Settings"
                        >
                            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Account Center
                            </span>
                            <span className="text-neutral-400">•</span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-black">
                                Club Privacy Controls
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Account & Privacy
                        </h2>
                    </div>
                </div>

                {club?.slug && (
                    <Link
                        to={`/clubs/${encodeURIComponent(club.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black font-black text-xs shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer self-start sm:self-auto shrink-0"
                    >
                        <Eye className="w-4 h-4 stroke-[2.5]" />
                        <span>Preview Public Club Showcase</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 1: PUBLIC CLUB SHOWCASE (CORE TOGGLE)                             */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-black/10">
                    <div className="flex items-start gap-4">
                        <div
                            className={`p-3.5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] shrink-0 transition-colors ${
                                isPublic ? "bg-[#a2ff86]" : "bg-[#FFE566]"
                            }`}
                        >
                            {isPublic ? (
                                <Globe className="w-6 h-6 text-black stroke-[2.5]" />
                            ) : (
                                <Lock className="w-6 h-6 text-black stroke-[2.5]" />
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                    Public Club Showcase
                                </h3>
                                <span
                                    className={`px-3 py-0.5 rounded-full text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] uppercase tracking-wider ${
                                        isPublic
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-black text-white"
                                    }`}
                                >
                                    {isPublic ? "Public Mode" : "Private Mode"}
                                </span>
                                {isUpdating && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-500">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Syncing...
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed max-w-2xl">
                                {isPublic
                                    ? "Your club showcase is fully public. Students, faculty members, and campus organizers can browse your events, view your team coordinators, submit registration forms, and discover your organization in the collegiate directory."
                                    : "Your club showcase is private. Visitors cannot view your team roster, events, or achievements from the public explore page. Only members with an explicit invitation link can access your space."}
                            </p>
                        </div>
                    </div>

                    {/* Neo-brutalist Interactive Toggle Switch */}
                    <NeoToggle
                        checked={isPublic}
                        disabled={isUpdating}
                        onChange={onTogglePrivacy}
                        onIcon={<Globe className="w-3.5 h-3.5 text-black stroke-[3]" />}
                        offIcon={<Lock className="w-3.5 h-3.5 text-neutral-700 stroke-[3]" />}
                        onStatusText="Status: Public"
                        offStatusText="Status: Private"
                        ariaLabel="Toggle club public or private visibility"
                    />
                </div>

                {/* Privacy Field Access Matrix for Clubs */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600">
                        Club Showcase Visibility Matrix
                    </h4>
                    <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]">
                        <div className="grid grid-cols-3 bg-[#FAF6EE] p-3 text-xs font-black text-black border-b-2 border-black">
                            <span>Club Profile Component</span>
                            <span className="text-center">Public Mode</span>
                            <span className="text-center">Private Mode</span>
                        </div>
                        <div className="divide-y-2 divide-black/10 text-xs font-bold text-neutral-800 bg-white">
                            <div className="grid grid-cols-3 p-3 items-center">
                                <span className="flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Club Identity & College</span>
                                </span>
                                <span className="text-center text-emerald-600 font-black flex items-center justify-center gap-1">
                                    <Check className="w-4 h-4 stroke-[3]" /> Visible
                                </span>
                                <span className="text-center text-emerald-600 font-black flex items-center justify-center gap-1">
                                    <Check className="w-4 h-4 stroke-[3]" /> Visible
                                </span>
                            </div>
                            <div className="grid grid-cols-3 p-3 items-center">
                                <span className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Events & Workshops</span>
                                </span>
                                <span className="text-center text-emerald-600 font-black flex items-center justify-center gap-1">
                                    <Check className="w-4 h-4 stroke-[3]" /> Public Registration
                                </span>
                                <span className="text-center text-rose-600 font-black flex items-center justify-center gap-1">
                                    <X className="w-4 h-4 stroke-[3]" /> Hidden
                                </span>
                            </div>
                            <div className="grid grid-cols-3 p-3 items-center">
                                <span className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Team & Coordinators</span>
                                </span>
                                <span className="text-center text-emerald-600 font-black flex items-center justify-center gap-1">
                                    <Check className="w-4 h-4 stroke-[3]" /> Public Directory
                                </span>
                                <span className="text-center text-rose-600 font-black flex items-center justify-center gap-1">
                                    <X className="w-4 h-4 stroke-[3]" /> Hidden
                                </span>
                            </div>
                            <div className="grid grid-cols-3 p-3 items-center">
                                <span className="flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Campus Ranking & Explore</span>
                                </span>
                                <span className="text-center text-emerald-600 font-black flex items-center justify-center gap-1">
                                    <Check className="w-4 h-4 stroke-[3]" /> Discoverable
                                </span>
                                <span className="text-center text-rose-600 font-black flex items-center justify-center gap-1">
                                    <X className="w-4 h-4 stroke-[3]" /> Unlisted
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
