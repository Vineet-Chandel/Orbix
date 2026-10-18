import React, { useState, useEffect, useMemo } from "react";
import { Award, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUnifiedBadges, type UnifiedBadgeRecord } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";

interface BadgesCardProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

function formatBadgeDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return dateStr;
    }
}

export const BadgesCard: React.FC<BadgesCardProps> = ({
    connectedPortals: _connectedPortals,
    username = "vineet_chandel",
}) => {
    const effectiveUser = (username || "vineet_chandel").trim();
    const dispatch = useAppDispatch();

    const remoteData = useAppSelector((state) => state.badges.dataByUser[effectiveUser]);
    const isLoading = useAppSelector((state) => state.badges.loadingByUser[effectiveUser] || false);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
    const [hoveredBadge, setHoveredBadge] = useState<UnifiedBadgeRecord | null>(null);

    useEffect(() => {
        if (!remoteData && !isLoading) {
            dispatch(fetchUnifiedBadges({ username: effectiveUser }));
        }
    }, [effectiveUser, remoteData, isLoading, dispatch]);

    const badges = useMemo(() => {
        return remoteData?.badges || [];
    }, [remoteData]);

    const platformsList = useMemo(() => {
        const map = remoteData?.platformCounts || {};
        return Object.keys(map).filter((k) => (map[k] || 0) > 0);
    }, [remoteData]);

    const filteredBadges = useMemo(() => {
        if (selectedPlatform === "all") return badges;
        return badges.filter((b) => b.platform.toLowerCase() === selectedPlatform.toLowerCase());
    }, [badges, selectedPlatform]);

    // Initial visible slice: 28 badges (7 rows of 4) unless expanded
    const INITIAL_LIMIT = 28;
    const displayedBadges = useMemo(() => {
        if (isExpanded || filteredBadges.length <= INITIAL_LIMIT) {
            return filteredBadges;
        }
        return filteredBadges.slice(0, INITIAL_LIMIT);
    }, [filteredBadges, isExpanded]);

    const totalCount = remoteData?.totalEarned ?? badges.length;

    return (
        <section
            aria-labelledby="badges-section-title"
            className="w-full rounded-3xl bg-[#0c1017] text-white p-6 sm:p-7 border border-neutral-800 shadow-2xl relative overflow-hidden select-none flex flex-col justify-between"
        >
            {/* Subtle ambient glow */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-400 shadow-sm">
                            <Award className="w-4 h-4 text-amber-400" />
                        </div>
                        <h3 id="badges-section-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
                            Badges
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-400">
                            {totalCount > 0 ? `${totalCount.toLocaleString()} earned` : "0 earned"}
                        </span>
                    </div>
                </div>

                {/* Optional platform filter chips if badges from multiple platforms exist */}
                {platformsList.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-white/[0.05] relative z-10 scrollbar-none text-[11px]">
                        <button
                            type="button"
                            onClick={() => setSelectedPlatform("all")}
                            className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                                selectedPlatform === "all"
                                    ? "bg-white text-black"
                                    : "bg-white/[0.05] text-neutral-400 hover:text-white"
                            }`}
                        >
                            All ({badges.length})
                        </button>
                        {platformsList.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setSelectedPlatform(p)}
                                className={`px-2.5 py-1 rounded-full font-bold capitalize transition-all cursor-pointer flex items-center gap-1 ${
                                    selectedPlatform === p
                                        ? "bg-white text-black"
                                        : "bg-white/[0.05] text-neutral-400 hover:text-white"
                                }`}
                            >
                                <span className="w-3 h-3 flex items-center justify-center">
                                    {getPortalIcon(p, "w-full h-full object-contain")}
                                </span>
                                <span>{p}</span>
                                <span className="opacity-60 text-[10px]">({remoteData?.platformCounts[p] || 0})</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Area */}
                <div className="pt-4 relative z-10 min-h-[460px]">
                    {isLoading && badges.length === 0 ? (
                        /* Skeleton Loading Grid */
                        <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:gap-x-4 sm:gap-y-6">
                            {Array.from({ length: 16 }).map((_, idx) => (
                                <div key={idx} className="flex flex-col items-center space-y-2 animate-pulse">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.05] border border-white/[0.05]" />
                                    <div className="w-12 h-2.5 bg-white/[0.05] rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : filteredBadges.length === 0 ? (
                        /* Empty State */
                        <div className="py-16 text-center max-w-xs mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                                <Award className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-white">No badges earned yet</h4>
                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Your platform achievements, daily challenges, and contest medals will appear here as you earn them.
                            </p>
                        </div>
                    ) : (
                        /* Responsive 4-Column Badge Grid */
                        <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5">
                            {displayedBadges.map((badge) => (
                                <div
                                    key={badge.id}
                                    onMouseEnter={() => setHoveredBadge(badge)}
                                    onMouseLeave={() => setHoveredBadge(null)}
                                    className="group relative flex flex-col items-center text-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl p-1"
                                    tabIndex={0}
                                    aria-label={`${badge.displayName || badge.name} from ${badge.platformName}`}
                                >
                                    {/* Badge Artwork Container */}
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center p-1 transition-transform duration-200 group-hover:scale-110">
                                        <img
                                            src={badge.icon}
                                            alt={badge.name}
                                            className="w-full h-full object-contain drop-shadow"
                                            loading="lazy"
                                            onError={(e) => {
                                                // Fallback if image link fails
                                                (e.target as HTMLElement).style.display = "none";
                                            }}
                                        />
                                    </div>

                                    {/* Badge Title beneath artwork */}
                                    <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-300 group-hover:text-white transition-colors text-center line-clamp-2 leading-tight max-w-[76px] mt-1">
                                        {badge.name}
                                    </span>

                                    {/* Accessible Hover / Focus Tooltip */}
                                    {hoveredBadge?.id === badge.id && (
                                        <div className="absolute bottom-full mb-2 z-50 pointer-events-none w-48 sm:w-56 p-3 rounded-2xl bg-[#141b25] border border-white/20 text-white shadow-2xl backdrop-blur-md text-left animate-fadeIn">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="w-3.5 h-3.5 flex items-center justify-center">
                                                    {getPortalIcon(badge.platform, "w-full h-full object-contain")}
                                                </span>
                                                <span className="text-[10px] uppercase font-bold text-neutral-400">
                                                    {badge.platformName}
                                                </span>
                                            </div>
                                            <h5 className="text-xs font-bold text-white leading-tight">
                                                {badge.displayName || badge.name}
                                            </h5>
                                            {badge.hoverText && (
                                                <p className="text-[11px] text-neutral-300 mt-1 leading-snug">
                                                    {badge.hoverText}
                                                </p>
                                            )}
                                            {badge.creationDate && (
                                                <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-1.5 pt-1.5 border-t border-white/10">
                                                    <Calendar className="w-3 h-3 text-neutral-500" />
                                                    <span>Earned {formatBadgeDate(badge.creationDate)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions: View all toggle */}
            {filteredBadges.length > INITIAL_LIMIT && (
                <div className="pt-4 mt-2 border-t border-white/[0.06] text-center relative z-10">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-xs font-bold text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                    >
                        <span>
                            {isExpanded
                                ? `Show less (${INITIAL_LIMIT} badges)`
                                : `View all ${filteredBadges.length} badges`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                </div>
            )}
        </section>
    );
};

export default BadgesCard;
