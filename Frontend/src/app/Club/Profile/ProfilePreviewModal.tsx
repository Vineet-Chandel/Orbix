import React, { useState } from "react";
import {
    X,
    Smartphone,
    Monitor,
    ShieldCheck,
    Building2,
    Globe,
    Mail,
    Phone,
    Sparkles,
    Trophy,
    UserCheck,
    FileText,
} from "lucide-react";
import { ClubMarkdownRenderer } from "./ClubMarkdownRenderer";
import { getPlatformIcon } from "../../../utils/platformLinks";
import type { ClubProfileData, ClubCoordinator, ClubAchievement } from "../../../utils/clubProfileApi";

interface ProfilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    club: ClubProfileData;
    coordinators?: ClubCoordinator[];
    achievements?: ClubAchievement[];
}

export const ProfilePreviewModal: React.FC<ProfilePreviewModalProps> = ({
    isOpen,
    onClose,
    club,
    coordinators = [],
    achievements = [],
}) => {
    const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
    const [activeTab, setActiveTab] = useState<"about" | "coordinators" | "achievements">("about");

    if (!isOpen) return null;

    const publicCoordinators = (coordinators || []).filter((c) => c.isPublic !== false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-[#FAF6EE] rounded-2xl border-2 border-black shadow-[8px_8px_0px_#000] w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
                {/* Header Bar */}
                <div className="px-4 py-3 bg-white border-b-2 border-black flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase text-black">
                            Draft Preview
                        </span>
                        <h3 className="text-xs sm:text-sm font-black text-black truncate">
                            Previewing: {club.name || "Untitled Club"}
                        </h3>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Device Toggle */}
                        <div className="hidden sm:flex items-center bg-[#FAF6EE] p-0.5 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setViewMode("desktop")}
                                className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    viewMode === "desktop" ? "bg-[#a2ff86] text-black" : "text-black hover:bg-neutral-100"
                                }`}
                            >
                                <Monitor className="w-3.5 h-3.5" />
                                <span>Desktop</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("mobile")}
                                className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    viewMode === "mobile" ? "bg-[#a2ff86] text-black" : "text-black hover:bg-neutral-100"
                                }`}
                            >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>Mobile</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-lg border border-black bg-white hover:bg-neutral-100 cursor-pointer"
                        >
                            <X className="w-4 h-4 text-black" />
                        </button>
                    </div>
                </div>

                {/* Body Canvas */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF6EE]">
                    <div
                        className={`mx-auto transition-all ${
                            viewMode === "mobile"
                                ? "max-w-sm rounded-3xl border-4 border-black shadow-[6px_6px_0px_#000] overflow-hidden bg-white p-0"
                                : "max-w-4xl"
                        }`}
                    >
                        {/* Hero Card */}
                        <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden mb-6">
                            {/* Banner */}
                            <div className="w-full h-36 sm:h-52 bg-neutral-900 border-b-2 border-black relative overflow-hidden">
                                {club.coverImageUrl ? (
                                    <img
                                        src={club.coverImageUrl}
                                        alt={club.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[#FFE566] bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:16px_16px] flex items-center justify-center">
                                        <span className="font-mono text-xs font-black uppercase tracking-widest text-black/50">
                                            Official Collegiate Chapter
                                        </span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                                        <span>Verified on Orbix</span>
                                    </span>
                                </div>
                            </div>

                            {/* Identity Info */}
                            <div className="p-5 sm:p-6 relative">
                                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
                                    <div className="flex items-end gap-3.5">
                                        <div className="w-20 h-20 rounded-xl bg-white border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000] shrink-0 flex items-center justify-center font-black text-xl text-black">
                                            {club.logoUrl ? (
                                                <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{(club.name || "CB").slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h1 className="text-xl sm:text-2xl font-black text-black">
                                                    {club.name || "Club Official Name"}
                                                </h1>
                                                <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black">
                                                    {club.category}
                                                </span>
                                                {club.foundedYear && (
                                                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black text-[10px] font-black text-neutral-700">
                                                        Est. {club.foundedYear}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3 text-black" />
                                                    {club.collegeName || "Institution"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {club.recruitmentStatus === "open" && club.recruitmentUrl && (
                                        <span className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 shrink-0">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Apply for Team</span>
                                        </span>
                                    )}
                                </div>

                                {club.shortDescription && (
                                    <p className="text-xs sm:text-sm font-bold text-neutral-800 italic mt-2">
                                        "{club.shortDescription}"
                                    </p>
                                )}

                                {/* Focus Areas */}
                                {Array.isArray(club.focusAreas) && club.focusAreas.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-3">
                                        {club.focusAreas.map((tag) => (
                                            <span
                                                key={tag}
                                                className="px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-black text-[10px] font-black text-black"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Links bar */}
                                <div className="pt-4 mt-4 border-t border-black/10 flex items-center gap-2 flex-wrap">
                                    {Array.isArray(club.links) && club.links.length > 0
                                        ? club.links.map((lnk) => (
                                              <span
                                                  key={lnk.id || lnk.platform}
                                                  className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-black text-[11px] font-black text-black flex items-center gap-1.5"
                                              >
                                                  {getPlatformIcon(lnk.platform, "w-3 h-3")}
                                                  <span>{lnk.label || lnk.platform}</span>
                                              </span>
                                          ))
                                        : club.websiteUrl && (
                                              <span className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-black text-[11px] font-black text-black flex items-center gap-1.5">
                                                  <Globe className="w-3 h-3" />
                                                  <span>Website</span>
                                              </span>
                                          )}
                                    {club.publicEmail && (
                                        <span className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-black text-[11px] font-black text-black flex items-center gap-1.5">
                                            <Mail className="w-3 h-3" />
                                            <span>{club.publicEmail}</span>
                                        </span>
                                    )}
                                    {club.contactPhone && (
                                        <span className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-black text-[11px] font-black text-black flex items-center gap-1.5">
                                            <Phone className="w-3 h-3" />
                                            <span>{club.contactPhone}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Internal Navigation */}
                        <div className="flex items-center gap-2 border-b-2 border-black pb-2 mb-4">
                            {[
                                { id: "about" as const, label: "About & Story", icon: FileText },
                                { id: "coordinators" as const, label: "Coordinators", icon: UserCheck, count: publicCoordinators.length },
                                { id: "achievements" as const, label: "Achievements", icon: Trophy, count: achievements.length },
                            ].map((tab) => {
                                const Icon = tab.icon;
                                const isTabActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[1px_1px_0px_#000] flex items-center gap-1.5 cursor-pointer ${
                                            isTabActive ? "bg-[#a2ff86] text-black" : "bg-white text-black hover:bg-neutral-100"
                                        }`}
                                    >
                                        <Icon className="w-3 h-3" />
                                        <span>{tab.label}</span>
                                        {tab.count !== undefined && tab.count > 0 && (
                                            <span
                                                className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                                                    isTabActive ? "bg-white text-black border-black" : "bg-[#a2ff86] text-black border-black"
                                                }`}
                                            >
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* TAB 1: ABOUT STORY */}
                        {activeTab === "about" && (
                            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                <h3 className="text-sm font-black text-black pb-2 border-b border-black/10 mb-3">
                                    About {club.name || "the Club"}
                                </h3>
                                {club.about ? (
                                    <ClubMarkdownRenderer content={club.about} />
                                ) : (
                                    <p className="text-xs font-medium text-neutral-500 italic">
                                        No detailed description written yet.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* TAB 2: COORDINATORS */}
                        {activeTab === "coordinators" && (
                            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <h3 className="text-sm font-black text-black">Coordinators & Student Leads</h3>
                                {publicCoordinators.length === 0 ? (
                                    <p className="text-xs text-neutral-500 italic">No public coordinators added yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {publicCoordinators.map((c) => (
                                            <div
                                                key={c.id}
                                                className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-white border border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-xs">
                                                    {c.imageUrl ? (
                                                        <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{c.name.slice(0, 2).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-black text-black truncate">{c.name}</span>
                                                        {c.isPrimary && (
                                                            <span className="px-1.5 py-0.2 rounded bg-[#a2ff86] border border-black text-[9px] font-black">
                                                                Lead
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-bold text-neutral-700">{c.role}</p>
                                                    {c.department && (
                                                        <p className="text-[10px] text-neutral-500">{c.department}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: ACHIEVEMENTS */}
                        {activeTab === "achievements" && (
                            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <h3 className="text-sm font-black text-black">Club Achievements & Highlights</h3>
                                {(achievements || []).length === 0 ? (
                                    <p className="text-xs text-neutral-500 italic">No achievements listed yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {(achievements || []).map((ach) => (
                                            <div
                                                key={ach.id}
                                                className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                                    <Trophy className="w-5 h-5 text-black" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-black block truncate">
                                                        {ach.title}
                                                    </span>
                                                    {(ach.type || ach.achievementType) && (
                                                        <span className="text-[10px] font-bold text-neutral-600 block">
                                                            {ach.type || ach.achievementType}
                                                        </span>
                                                    )}
                                                    {ach.description && (
                                                        <p className="text-[11px] text-neutral-600 line-clamp-2 mt-0.5">
                                                            {ach.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
