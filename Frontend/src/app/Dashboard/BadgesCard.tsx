import React, { useState, useEffect, useMemo } from "react";
import { Award, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUnifiedBadges, type UnifiedBadgeRecord } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import { isDemoProfileUsername, demoBadgesData } from "../../data/demoProfileData";

interface BadgesCardProps {
    connectedPortals?: Record<string, any>;
    username?: string;
    embedded?: boolean;
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

const BadgeIconWithFallback: React.FC<{ badge: UnifiedBadgeRecord }> = ({ badge }) => {
    const [failed, setFailed] = useState(false);

    if (failed || !badge.icon) {
        return (
            <div className="w-full h-full rounded-2xl bg-neutral-100 border border-neutral-200/90 flex flex-col items-center justify-center p-2 text-neutral-600 shadow-2xs group-hover:border-neutral-400 group-hover:shadow-xs transition-all">
                <span className="w-6 h-6 flex items-center justify-center mb-1">
                    {getPortalIcon(badge.platform, "w-full h-full object-contain")}
                </span>
                <Award className="w-4 h-4 text-amber-500" />
            </div>
        );
    }

    return (
        <img
            src={badge.icon}
            alt={badge.displayName || badge.name}
            className="w-full h-full object-contain drop-shadow-xs"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
        />
    );
};

export const BadgesCard: React.FC<BadgesCardProps> = ({
    connectedPortals: _connectedPortals,
    username,
    embedded = false,
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const dispatch = useAppDispatch();

    const remoteData = useAppSelector((state) => (effectiveUser ? state.badges.dataByUser[effectiveUser] : undefined));
    const isLoading = useAppSelector((state) => (effectiveUser ? state.badges.loadingByUser[effectiveUser] || false : false));
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
    const [hoveredBadge, setHoveredBadge] = useState<UnifiedBadgeRecord | null>(null);

    useEffect(() => {
        if (!effectiveUser) return;
        if (!remoteData && !isLoading) {
            dispatch(fetchUnifiedBadges({ username: effectiveUser }));
        }
    }, [effectiveUser, remoteData, isLoading, dispatch]);

    const isDemo = isDemoProfileUsername(effectiveUser) || effectiveUser.toLowerCase() === "vineet_chandel";

    const badges = useMemo(() => {
        if (remoteData?.badges && remoteData.badges.length > 0) {
            return remoteData.badges;
        }
        if (isDemo) {
            return demoBadgesData.badges;
        }
        return [];
    }, [remoteData, isDemo]);

    const platformsList = useMemo(() => {
        const map = (remoteData?.platformCounts && Object.keys(remoteData.platformCounts).length > 0)
            ? remoteData.platformCounts
            : isDemo
                ? demoBadgesData.platformCounts
                : {};
        return Object.keys(map).filter((k) => (map[k] || 0) > 0);
    }, [remoteData, isDemo]);

    const filteredBadges = useMemo(() => {
        if (selectedPlatform === "all") return badges;
        return badges.filter((b) => b.platform.toLowerCase() === selectedPlatform.toLowerCase());
    }, [badges, selectedPlatform]);

    // Initial visible slice: 32 badges unless expanded
    const INITIAL_LIMIT = 32;
    const displayedBadges = useMemo(() => {
        if (isExpanded || filteredBadges.length <= INITIAL_LIMIT) {
            return filteredBadges;
        }
        return filteredBadges.slice(0, INITIAL_LIMIT);
    }, [filteredBadges, isExpanded]);

    const totalCount = remoteData?.totalEarned ?? (isDemo ? demoBadgesData.totalEarned : badges.length);

    return (
        <section
            aria-labelledby="badges-section-title"
            className={
                embedded
                    ? "w-full text-neutral-900 select-none flex flex-col justify-between"
                    : "w-full rounded-2xl bg-white text-neutral-900 p-6 sm:p-7 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none flex flex-col justify-between"
            }
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <Award className="w-5 h-5 text-black" />
                        </div>
                        <h3 id="badges-section-title" className="text-xl sm:text-2xl font-black text-black tracking-tight">
                            Badges
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black font-black text-xs text-black shadow-[1px_1px_0px_#000]">
                            {totalCount > 0 ? `${totalCount.toLocaleString()} earned` : "0 earned"}
                        </span>
                    </div>
                </div>

                {/* Optional platform filter chips if badges from multiple platforms exist */}
                {platformsList.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-3 border-b-2 border-black/15 relative z-10 scrollbar-none text-sm">
                        <button
                            type="button"
                            onClick={() => setSelectedPlatform("all")}
                            className={`px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] ${
                                selectedPlatform === "all"
                                    ? "bg-black text-[#a2ff86]"
                                    : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                            }`}
                        >
                            All ({badges.length})
                        </button>
                        {platformsList.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setSelectedPlatform(p)}
                                className={`px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm capitalize transition-all cursor-pointer flex items-center gap-2 border-2 border-black shadow-[2px_2px_0px_#000] ${
                                    selectedPlatform === p
                                        ? "bg-black text-[#a2ff86]"
                                        : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                }`}
                            >
                                <span className="w-4 h-4 flex items-center justify-center">
                                    {getPortalIcon(p, "w-full h-full object-contain")}
                                </span>
                                <span>{p}</span>
                                <span className="text-xs font-mono font-bold">({remoteData?.platformCounts[p] || 0})</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Area */}
                <div className="pt-5 relative z-10 min-h-[460px]">
                    {isLoading && badges.length === 0 ? (
                        /* Skeleton Loading Grid */
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6">
                            {Array.from({ length: 16 }).map((_, idx) => (
                                <div key={idx} className="flex flex-col items-center space-y-2 animate-pulse">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-200 border-2 border-black/20" />
                                    <div className="w-16 h-3 bg-neutral-200 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : filteredBadges.length === 0 ? (
                        /* Empty State */
                        <div className="py-16 text-center max-w-xs mx-auto space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto text-black shadow-[2px_2px_0px_#000]">
                                <Award className="w-7 h-7 text-black" />
                            </div>
                            <h4 className="text-base font-black text-black">No badges earned yet</h4>
                            <p className="text-sm text-neutral-600 font-bold leading-relaxed">
                                Your platform achievements, daily challenges, and contest medals will appear here as you earn them.
                            </p>
                        </div>
                    ) : (
                        /* Responsive Multi-Column Badge Grid */
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-7">
                            {displayedBadges.map((badge) => (
                                <div
                                    key={badge.id}
                                    onMouseEnter={() => setHoveredBadge(badge)}
                                    onMouseLeave={() => setHoveredBadge(null)}
                                    className="group relative flex flex-col items-center text-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-black rounded-xl p-1.5"
                                    tabIndex={0}
                                    aria-label={`${badge.displayName || badge.name} from ${badge.platformName}`}
                                >
                                    {/* Badge Artwork Container */}
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center p-1 transition-transform duration-200 group-hover:scale-110">
                                        <BadgeIconWithFallback badge={badge} />
                                    </div>

                                    {/* Badge Title beneath artwork */}
                                    <span className="text-xs sm:text-sm font-black text-black group-hover:underline transition-colors text-center line-clamp-2 leading-tight max-w-[105px] mt-2">
                                        {badge.name}
                                    </span>

                                    {/* Accessible Hover / Focus Tooltip */}
                                    {hoveredBadge?.id === badge.id && (
                                        <div className="absolute bottom-full mb-3 z-50 pointer-events-none w-56 sm:w-64 p-3.5 rounded-2xl bg-black border-2 border-black text-white shadow-[4px_4px_0px_#a2ff86] text-left animate-fadeIn">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="w-4 h-4 flex items-center justify-center">
                                                    {getPortalIcon(badge.platform, "w-full h-full object-contain")}
                                                </span>
                                                <span className="text-xs uppercase font-black text-[#a2ff86] tracking-wider">
                                                    {badge.platformName}
                                                </span>
                                            </div>
                                            <h5 className="text-sm sm:text-base font-black text-white leading-tight">
                                                {badge.displayName || badge.name}
                                            </h5>
                                            {badge.hoverText && (
                                                <p className="text-xs sm:text-sm text-neutral-300 mt-1.5 leading-snug font-medium">
                                                    {badge.hoverText}
                                                </p>
                                            )}
                                            {badge.creationDate && (
                                                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-2 pt-2 border-t border-white/20 font-bold font-mono">
                                                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
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
                <div className="pt-5 mt-3 border-t-2 border-black/15 text-center relative z-10">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-[1px] active:translate-y-[1px] text-xs sm:text-sm font-black text-black border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer"
                    >
                        <span>
                            {isExpanded
                                ? `Show less (${INITIAL_LIMIT} badges)`
                                : `View all ${filteredBadges.length} badges`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            )}
        </section>
    );
};

export default BadgesCard;
