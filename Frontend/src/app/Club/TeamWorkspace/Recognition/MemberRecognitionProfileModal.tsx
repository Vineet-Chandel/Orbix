// Frontend/src/app/Club/TeamWorkspace/Recognition/MemberRecognitionProfileModal.tsx
import React, { useState, useEffect } from "react";
import {
    X,
    Sparkles,
    Trophy,
    Award,
    Shield,
    CheckCircle2,
    RotateCcw,
    Lock,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { MemberRecognitionProfile } from "../../../../types/workspace";

interface MemberRecognitionProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    clubId: string;
}

export const MemberRecognitionProfileModal: React.FC<MemberRecognitionProfileModalProps> = ({
    isOpen,
    onClose,
    userId,
    clubId,
}) => {
    const [profile, setProfile] = useState<MemberRecognitionProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !userId) {
            setProfile(null);
            setError(null);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await workspaceApi.getMemberRecognitionProfile(userId, clubId);
                if (res.success && res.profile) {
                    setProfile(res.profile);
                } else {
                    setError("Could not load recognition profile.");
                }
            } catch (err: any) {
                console.error("[MemberRecognitionProfileModal] Error:", err);
                setError(err.message || "Failed to load member profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [isOpen, userId, clubId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#FAF6EE] border-2 border-black rounded-3xl shadow-[8px_8px_0px_#000] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-white border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-4 h-4 fill-black text-black" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-black uppercase tracking-wider">
                                Workspace Recognition Profile
                            </h2>
                            <p className="text-[11px] font-bold text-neutral-500">
                                Campus Club Performance & Orbits Record
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl border-2 border-black bg-neutral-100 hover:bg-neutral-200 transition shadow-[2px_2px_0px_#000]"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {loading && (
                        <div className="py-12 text-center text-xs font-bold text-neutral-500">
                            Loading member recognition record...
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl text-xs font-bold text-red-700">
                            {error}
                        </div>
                    )}

                    {!loading && !error && profile && (
                        <>
                            {/* Member Identity Hero Card */}
                            <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full border-2 border-black bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center font-black text-lg">
                                    {profile.avatarUrl ? (
                                        <img
                                            src={profile.avatarUrl}
                                            alt={profile.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        profile.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base font-black text-black truncate">
                                            {profile.name}
                                        </h3>
                                        <span className="px-2 py-0.5 text-[10px] font-black border border-black rounded-md bg-neutral-100 shadow-neo-xxs">
                                            {profile.roleTitle}
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono text-neutral-500">
                                        @{profile.username}
                                    </p>
                                    {profile.department && (
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600">
                                            <span
                                                className="w-2 h-2 rounded-full border border-black"
                                                style={{ backgroundColor: profile.department.color || "#000" }}
                                            />
                                            <span>{profile.department.name} Department</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recognition Statistics Grid */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Total Orbits */}
                                <div className="p-3 bg-[#FFE566] border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] text-center space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-black block">
                                        Total Orbits
                                    </span>
                                    <div className="text-2xl font-black text-black flex items-center justify-center gap-1">
                                        <Sparkles className="w-4 h-4 fill-black" />
                                        <span>{profile.totalOrbitsEarned}</span>
                                    </div>
                                </div>

                                {/* Contributor Rank */}
                                <div className="p-3 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] text-center space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Workspace Rank
                                    </span>
                                    <div className="text-2xl font-black text-black flex items-center justify-center gap-1">
                                        <Trophy className="w-4 h-4 text-amber-500" />
                                        <span>
                                            {profile.contributorRank ? `#${profile.contributorRank}` : "—"}
                                        </span>
                                    </div>
                                </div>

                                {/* Awards Received */}
                                <div className="p-3 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] text-center space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Awards
                                    </span>
                                    <div className="text-2xl font-black text-black flex items-center justify-center gap-1">
                                        <Award className="w-4 h-4 text-blue-600" />
                                        <span>{profile.awardsReceivedCount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scoped Boundary Notice */}
                            <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-xl text-[11px] font-medium text-amber-900 flex items-start gap-2">
                                <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-black">Club Workspace Isolation: </span>
                                    Orbits reflect internal teamwork and contribution within this club workspace. They do not alter or expose the member's public developer profile or global Orbix Score.
                                </div>
                            </div>

                            {/* Recent Appreciation Feed */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-black uppercase tracking-wider">
                                    Recent Recognition History
                                </h4>

                                {(!profile.recentAwards || profile.recentAwards.length === 0) ? (
                                    <div className="p-6 bg-white border-2 border-black rounded-2xl text-center text-xs font-bold text-neutral-400">
                                        No public recognition entries recorded yet for this member.
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {profile.recentAwards.map((award) => (
                                            <div
                                                key={award.id}
                                                className={`p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-2 ${
                                                    award.isReversed ? "opacity-75 bg-neutral-50" : ""
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`px-2 py-0.5 text-xs font-black rounded-lg border border-black shadow-neo-xxs flex items-center gap-1 ${
                                                                award.isReversed
                                                                    ? "bg-neutral-200 text-neutral-700 line-through"
                                                                    : "bg-[#FFE566] text-black"
                                                            }`}
                                                        >
                                                            <Sparkles className="w-3 h-3 fill-black" />
                                                            +{award.pointsDelta} Orbits
                                                        </span>
                                                        <span className="text-[11px] font-black text-black px-2 py-0.5 bg-neutral-100 border border-black rounded-md">
                                                            {award.category?.name || "Recognition"}
                                                        </span>
                                                        {award.visibility === "recipient_only" && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-300">
                                                                <Lock className="w-2.5 h-2.5" />
                                                                Private
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className="text-[10px] font-bold text-neutral-500">
                                                        {new Date(award.createdAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>

                                                <p className="text-xs font-bold text-neutral-800 italic bg-amber-50/50 p-2.5 rounded-xl border border-neutral-200">
                                                    "{award.appreciationReason}"
                                                </p>

                                                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 pt-1 border-t border-neutral-100 flex-wrap gap-2">
                                                    <div>
                                                        Given by:{" "}
                                                        <span className="text-black font-black">
                                                            {award.issuer?.name ||
                                                             `${award.issuer?.firstName || ""} ${award.issuer?.lastName || ""}`.trim() ||
                                                             award.issuer?.username ||
                                                             "Manager"}
                                                        </span>
                                                    </div>

                                                    {award.linkedTask && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Task: {award.linkedTask.title}
                                                        </span>
                                                    )}
                                                </div>

                                                {award.isReversed && (
                                                    <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded-xl text-[10px] font-bold text-red-800 flex items-center gap-1.5">
                                                        <RotateCcw className="w-3 h-3 text-red-600" />
                                                        <span>
                                                            Award reversed ({award.reversalReason || "Administrative correction"})
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 bg-neutral-100 border-t-2 border-black flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white hover:bg-neutral-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
