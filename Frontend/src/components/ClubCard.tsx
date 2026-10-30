import React from "react";
import { Link } from "react-router-dom";
import {
    ShieldCheck,
    Users,
    Calendar,
    ArrowUpRight,
    Sparkles,
    Radio,
    ExternalLink,
    Trophy,
} from "lucide-react";
import type { CollegeClubItem } from "../utils/clubProfileApi";

interface ClubCardProps {
    club: CollegeClubItem;
    onSelect?: (club: CollegeClubItem) => void;
    isCurrentClub?: boolean;
    showCampusName?: boolean;
    className?: string;
}

export const ClubCard: React.FC<ClubCardProps> = ({
    club,
    onSelect,
    isCurrentClub = false,
    showCampusName = true,
    className = "",
}) => {
    const isSelf = isCurrentClub || club.isCurrentClub;

    // Smart narrative snippet selection to prevent empty or cluttered areas
    const narrativeSnippet =
        club.shortDescription?.trim() ||
        (club.about ? club.about.replace(/[*#_`>]/g, "").trim().slice(0, 130) + "..." : null) ||
        club.mission?.trim() ||
        `Official collegiate student chapter at ${club.collegeName || "campus"}.`;

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent trigger if clicking on an explicit link
        if ((e.target as HTMLElement).closest("a")) return;
        if (onSelect) {
            onSelect(club);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (onSelect) onSelect(club);
                }
            }}
            className={`group bg-white rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[7px_7px_0px_#000] transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer relative text-left select-none ${
                isSelf ? "ring-2 ring-black bg-[#FAF6EE]/50" : ""
            } ${className}`}
        >
            {/* Top Cover / Header Visual Area */}
            <div>
                <div className="relative h-28 sm:h-32 w-full bg-neutral-900 border-b-2 border-black overflow-hidden flex-shrink-0">
                    {club.coverImageUrl ? (
                        <img
                            src={club.coverImageUrl}
                            alt={`${club.name} banner`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-black relative flex items-center justify-center">
                            {/* Generative micro-dot neo-pattern */}
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{
                                    backgroundImage:
                                        "radial-gradient(#a2ff86 1px, transparent 1px), radial-gradient(#FFE566 1px, transparent 1px)",
                                    backgroundSize: "16px 16px",
                                    backgroundPosition: "0 0, 8px 8px",
                                }}
                            />
                            <span className="text-white/20 text-xl font-black uppercase tracking-wider line-clamp-1 px-4 select-none">
                                {club.name}
                            </span>
                        </div>
                    )}

                    {/* Gradient Overlay for high-contrast badge legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                    {/* Top Badges Bar */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 z-10">
                        {/* Category badge */}
                        <span className="px-2 py-0.5 rounded-md bg-white/95 text-black border border-black font-black text-[10px] shadow-[1px_1px_0px_#000] truncate max-w-[130px]">
                            {club.category || "Organization"}
                        </span>

                        <div className="flex items-center gap-1.5">
                            {/* Self Club Badge */}
                            {isSelf && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black font-black text-[10px] shadow-[1.5px_1.5px_0px_#000]">
                                    <Sparkles className="w-2.5 h-2.5 fill-black stroke-none" />
                                    <span>YOUR CLUB</span>
                                </span>
                            )}

                            {/* Recruitment Status Pill */}
                            {club.recruitmentStatus === "open" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black font-black text-[10px] shadow-[1.5px_1.5px_0px_#000]">
                                    <Radio className="w-2.5 h-2.5 text-black stroke-[3] animate-pulse" />
                                    <span>Recruiting</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Overlapping Avatar Logo and Identity */}
                <div className="px-4 pt-0">
                    <div className="flex items-end justify-between -mt-7 mb-2.5 relative z-10">
                        <div className="w-14 h-14 rounded-xl border-2 border-black bg-white shadow-[2.5px_2.5px_0px_#000] overflow-hidden flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform bg-[#FAF6EE]">
                            {club.logoUrl ? (
                                <img
                                    src={club.logoUrl}
                                    alt={club.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="font-black text-sm tracking-tight text-black">
                                    {club.name.slice(0, 2).toUpperCase()}
                                </span>
                            )}
                        </div>

                        {/* Verified badge pill */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                            <ShieldCheck className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                            <span>Verified</span>
                        </span>
                    </div>

                    {/* Club Name & Handle */}
                    <div className="space-y-0.5">
                        <h3 className="text-base sm:text-lg font-black text-black tracking-tight leading-snug line-clamp-1 group-hover:text-neutral-800">
                            {club.name}
                        </h3>

                        <p className="text-[11px] font-bold text-neutral-500 truncate flex items-center gap-1">
                            <span>orbix.in/clubs/{club.slug}</span>
                            {showCampusName && club.collegeName && (
                                <>
                                    <span>·</span>
                                    <span className="text-neutral-700 truncate">{club.collegeName}</span>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Short Description */}
                    <p className="text-xs font-medium text-neutral-700 leading-relaxed mt-2.5 line-clamp-2 min-h-[36px]">
                        {narrativeSnippet}
                    </p>

                    {/* Focus Areas Chips */}
                    {Array.isArray(club.focusAreas) && club.focusAreas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-3">
                            {club.focusAreas.slice(0, 2).map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-[#FAF6EE] text-neutral-800 border border-black/30 text-[10px] font-bold truncate max-w-[120px]"
                                >
                                    #{tag}
                                </span>
                            ))}
                            {club.focusAreas.length > 2 && (
                                <span className="text-[10px] font-bold text-neutral-500 pl-0.5">
                                    +{club.focusAreas.length - 2} more
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Metrics and Explore Action */}
            <div className="px-4 pb-4 pt-3.5 mt-2 border-t border-black/10 flex flex-col gap-2.5">
                {/* Micro Metrics Strip */}
                <div className="flex items-center justify-between text-[11px] text-neutral-600 font-bold">
                    <div className="flex items-center gap-3">
                        {club.memberCount > 0 && (
                            <span className="flex items-center gap-1" title={`${club.memberCount} active members`}>
                                <Users className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{club.memberCount}</span>
                            </span>
                        )}

                        {club.eventsCount > 0 && (
                            <span className="flex items-center gap-1" title={`${club.eventsCount} published events`}>
                                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{club.eventsCount} events</span>
                            </span>
                        )}

                        {club.achievementsCount > 0 && (
                            <span className="flex items-center gap-1" title={`${club.achievementsCount} honors`}>
                                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                                <span>{club.achievementsCount}</span>
                            </span>
                        )}
                    </div>

                    {club.foundedYear && (
                        <span className="text-[10px] font-medium text-neutral-500">
                            Est. {club.foundedYear}
                        </span>
                    )}
                </div>

                {/* Card Action Row: Primary View & External Public Link */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onSelect && onSelect(club)}
                        className="flex-1 py-2 px-3 rounded-xl bg-black text-[#a2ff86] group-hover:bg-[#a2ff86] group-hover:text-black border-2 border-black font-black text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000] group-hover:shadow-[2.5px_2.5px_0px_#000] transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <span>Explore Chapter</span>
                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <Link
                        to={`/clubs/${encodeURIComponent(club.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center transition-all cursor-pointer"
                        title="Open Public Showcase"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
};
