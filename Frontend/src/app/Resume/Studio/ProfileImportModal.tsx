import React, { useState } from "react";
import {
    Sparkles,
    AlertTriangle,
    X,
    ShieldCheck,
    Code2,
    ArrowRight,
    RefreshCw,
} from "lucide-react";
import type { ProfileImportSummary, ResumeContent } from "../../../../../Backend/src/services/resume/resumeTypes";

interface ProfileImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: ProfileImportSummary | null;
    isLoading: boolean;
    onApplyImport: (importedContent: ResumeContent) => void;
    onRefresh: () => void;
}

export const ProfileImportModal: React.FC<ProfileImportModalProps> = ({
    isOpen,
    onClose,
    summary,
    isLoading,
    onApplyImport,
    onRefresh,
}) => {
    const [selectedTab, setSelectedTab] = useState<"overview" | "missing" | "verified">("overview");

    if (!isOpen) return null;

    const completeness = summary?.completenessMap;
    const score = completeness?.score || 0;
    const profile = summary?.profileData;
    const verifiedPlatforms = summary?.verifiedPlatforms || [];
    const missingFields = completeness?.missingFields || [];

    const getScoreBadge = (sc: number) => {
        if (sc >= 80) return { bg: "bg-[#a2ff86]", text: "text-black", label: "Strong Foundation" };
        if (sc >= 60) return { bg: "bg-[#FFE566]", text: "text-black", label: "Good Draft" };
        return { bg: "bg-rose-100", text: "text-rose-900", label: "Needs Key Fields" };
    };

    const badge = getScoreBadge(score);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="importModalTitle"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
        >
            <div className="w-full max-w-2xl bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[8px_8px_0px_#000] text-black flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b-2 border-black shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="importModalTitle" className="text-base sm:text-lg font-black tracking-tight text-black">
                                Build Resume from My Orbix Profile
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Real-time sync of your developer identity, skills, and verified coding stats
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center space-y-3">
                        <div className="w-9 h-9 border-3 border-black border-t-[#a2ff86] rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-wider text-neutral-700">
                            Reading profile & authenticating verified handles...
                        </p>
                    </div>
                ) : !summary ? (
                    <div className="py-12 text-center space-y-3">
                        <p className="text-sm font-bold text-neutral-800">Could not read profile data.</p>
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="px-4 py-2 rounded-lg bg-black text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pt-4 space-y-4">
                        {/* Score Banner */}
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                    Profile Completeness Map
                                </span>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-2xl sm:text-3xl font-black text-black">
                                        {score}%
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase border border-black shadow-[1px_1px_0px_#000] ${badge.bg} ${badge.text}`}>
                                        {badge.label}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-700 font-medium">
                                    Calculated from your verified Orbix profile fields, not an arbitrary percentage.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={onRefresh}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer self-start sm:self-auto"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Sync Fresh</span>
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-2 border-b-2 border-black/20 pb-2">
                            <button
                                type="button"
                                onClick={() => setSelectedTab("overview")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${selectedTab === "overview"
                                    ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:text-black border-2 border-transparent"
                                    }`}
                            >
                                Imported Fields ({completeness?.completedFields.length || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab("missing")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${selectedTab === "missing"
                                    ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:text-black border-2 border-transparent"
                                    }`}
                            >
                                Missing Fields ({missingFields.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab("verified")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${selectedTab === "verified"
                                    ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:text-black border-2 border-transparent"
                                    }`}
                            >
                                Verified Platforms ({verifiedPlatforms.length})
                            </button>
                        </div>

                        {/* Tab Content */}
                        {selectedTab === "overview" && (
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                        <div className="text-[10px] font-black uppercase text-neutral-500">Full Name</div>
                                        <div className="text-sm font-black text-black">{profile?.contact.fullName}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                        <div className="text-[10px] font-black uppercase text-neutral-500">Email Address</div>
                                        <div className="text-sm font-black text-black truncate">{profile?.contact.email}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                        <div className="text-[10px] font-black uppercase text-neutral-500">Headline</div>
                                        <div className="text-xs font-bold text-neutral-800">{profile?.contact.headline || "Not provided"}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                        <div className="text-[10px] font-black uppercase text-neutral-500">Education / College</div>
                                        <div className="text-xs font-bold text-neutral-800">
                                            {profile?.education[0]?.institution || "No college registered"}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">
                                        Imported Skills ({profile?.skills.reduce((acc, c) => acc + c.items.length, 0)} Total)
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {profile?.skills.flatMap((c) => c.items).map((skill, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-0.5 rounded bg-[#FAF6EE] border border-black text-xs font-bold text-black"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedTab === "missing" && (
                            <div className="space-y-2">
                                {missingFields.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5"
                                    >
                                        <AlertTriangle
                                            className={`w-4 h-4 shrink-0 mt-0.5 ${item.severity === "critical"
                                                ? "text-rose-600"
                                                : item.severity === "recommended"
                                                    ? "text-amber-600"
                                                    : "text-blue-600"
                                                }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black text-black uppercase">{item.label}</h4>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-black ${item.severity === "critical"
                                                    ? "bg-rose-100 text-rose-900"
                                                    : item.severity === "recommended"
                                                        ? "bg-[#FFE566] text-black"
                                                        : "bg-blue-100 text-blue-900"
                                                    }`}>
                                                    {item.severity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-700 font-medium mt-0.5">{item.reason}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedTab === "verified" && (
                            <div className="space-y-2.5">
                                {verifiedPlatforms.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-center space-y-2">
                                        <Code2 className="w-6 h-6 mx-auto text-neutral-500" />
                                        <p className="text-xs font-bold text-neutral-800">
                                            No verified coding platforms found.
                                        </p>
                                        <p className="text-[11px] text-neutral-600">
                                            Connect LeetCode or Codeforces in Connect Platforms to authenticate your problem-solving statistics.
                                        </p>
                                    </div>
                                ) : (
                                    verifiedPlatforms.map((plat, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center font-black text-xs uppercase">
                                                    {plat.portal.slice(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-xs font-black text-black capitalize">
                                                            {plat.portal}
                                                        </h4>
                                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-black text-white">
                                                            <ShieldCheck className="w-2.5 h-2.5 text-[#a2ff86]" />
                                                            Verified
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-600 font-medium">
                                                        @{plat.username} {plat.totalSolved ? `· ${plat.totalSolved.toLocaleString()} solved` : ""}
                                                    </p>
                                                </div>
                                            </div>

                                            {plat.contestRating && (
                                                <span className="text-xs font-black px-2 py-1 rounded bg-[#FAF6EE] border border-black">
                                                    Rating: {plat.contestRating}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="pt-4 border-t-2 border-black flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider hover:bg-neutral-100 cursor-pointer"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={isLoading || !profile}
                        onClick={() => {
                            if (profile) {
                                onApplyImport(profile);
                                onClose();
                            }
                        }}
                        className="px-5 py-2.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        <span>Build Resume Now</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
};
