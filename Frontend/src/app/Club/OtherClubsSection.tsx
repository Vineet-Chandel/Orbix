import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Search,
    Building2,
    Radio,
    X,
    AlertCircle,
    ExternalLink,
    Share2,
} from "lucide-react";
import { fetchCollegeClubs, type CollegeClubItem } from "../../utils/clubProfileApi";
import { ClubCard } from "../../components/ClubCard";
import { ClubDetailModal } from "../../components/ClubDetailModal";
import { InviteCampusLeadsModal } from "../../components/InviteCampusLeadsModal";
import { NeoSelect } from "../../components/NeoSelect";

interface OtherClubsSectionProps {
    currentClubId: string;
    currentClubSlug?: string;
    collegeId?: string;
    collegeName?: string;
    currentClubData?: any;
    onNavigateToEditProfile?: () => void;
}

export const OtherClubsSection: React.FC<OtherClubsSectionProps> = ({
    currentClubId,
    currentClubSlug,
    collegeId,
    collegeName,
    currentClubData,
    onNavigateToEditProfile,
}) => {
    const [clubs, setClubs] = useState<CollegeClubItem[]>([]);
    const [resolvedCollegeName, setResolvedCollegeName] = useState<string>(
        collegeName || currentClubData?.college_name || ""
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Filters state for peer clubs
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [onlyRecruiting, setOnlyRecruiting] = useState<boolean>(false);

    // Modal state for full expanded details
    const [selectedClubForModal, setSelectedClubForModal] = useState<CollegeClubItem | null>(null);

    // Helper to synthesize a CollegeClubItem for the current club if missing from backend response
    const buildSynthesizedSelf = (): CollegeClubItem | null => {
        if (!currentClubData && !currentClubId) return null;
        const d = currentClubData || {};
        return {
            id: currentClubId,
            name: d.name || "Your Chapter",
            slug: d.slug || currentClubSlug || "chapter",
            clubUsername: d.clubUsername || d.slug || currentClubSlug,
            category: d.category || "Organization",
            collegeId: d.college_id || d.collegeId || collegeId,
            collegeName: d.college_name || d.collegeName || resolvedCollegeName || collegeName || "Your College",
            collegeCity: d.college_city || d.collegeCity || "",
            collegeState: d.college_state || d.collegeState || "",
            collegeCountry: d.college_country || d.collegeCountry || "India",
            shortDescription: d.short_description || d.shortDescription || null,
            about: d.about || null,
            mission: d.mission || null,
            vision: d.vision || null,
            logoUrl: d.logo_url || d.logoUrl || null,
            coverImageUrl: d.cover_image_url || d.coverImageUrl || null,
            websiteUrl: d.website_url || d.websiteUrl || null,
            publicEmail: d.public_email || d.publicEmail || null,
            contactPhone: d.contact_phone || d.contactPhone || null,
            socialLinks: d.social_links || d.socialLinks || {},
            links: d.links || [],
            visibility: d.visibility || "public",
            foundedYear: d.founded_year || d.foundedYear || null,
            operatingStatus: "active",
            focusAreas: d.focus_areas || d.focusAreas || [],
            publicationStatus: "published",
            profileVisibility: "public",
            recruitmentStatus: d.recruitment_status || d.recruitmentStatus || "closed",
            recruitmentAnnouncement: d.recruitment_announcement || d.recruitmentAnnouncement || null,
            recruitmentUrl: d.recruitment_url || d.recruitmentUrl || null,
            isActive: true,
            verifiedAt: d.verified_at || d.verifiedAt || new Date().toISOString(),
            createdAt: d.created_at || d.createdAt || new Date().toISOString(),
            updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
            memberCount: d.member_count || d.memberCount || 0,
            eventsCount: d.events_count || d.eventsCount || 0,
            achievementsCount: Array.isArray(d.achievements) ? d.achievements.length : (d.achievements_count || d.achievementsCount || 0),
            coordinatorsCount: Array.isArray(d.coordinators) ? d.coordinators.length : (d.coordinators_count || d.coordinatorsCount || 0),
            isCurrentClub: true,
            coordinators: d.coordinators || [],
            achievements: d.achievements || [],
        };
    };

    const loadClubs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCollegeClubs({
                collegeId,
                collegeName: collegeName || resolvedCollegeName || currentClubData?.college_name,
                clubId: currentClubId,
            });

            const fetchedClubs: CollegeClubItem[] = Array.isArray(data.clubs) ? data.clubs : [];
            const collegeFound = data.collegeName || collegeName || currentClubData?.college_name || "";
            if (collegeFound) {
                setResolvedCollegeName(collegeFound);
            }

            // Guarantee that the current club is ALWAYS part of the listing
            const hasSelf = fetchedClubs.some(
                (c) => c.id === currentClubId || c.isCurrentClub || (currentClubSlug && c.slug === currentClubSlug)
            );

            if (!hasSelf) {
                const selfClubFallback = buildSynthesizedSelf();
                if (selfClubFallback) {
                    setClubs([selfClubFallback, ...fetchedClubs]);
                } else {
                    setClubs(fetchedClubs);
                }
            } else {
                // Ensure isCurrentClub is explicitly true on the user's club item
                const markedClubs = fetchedClubs.map((c) => {
                    if (c.id === currentClubId || (currentClubSlug && c.slug === currentClubSlug)) {
                        return { ...c, isCurrentClub: true };
                    }
                    return c;
                });
                setClubs(markedClubs);
            }
        } catch (err: any) {
            console.error("Failed to load college clubs:", err);
            setError(err.message || "Failed to load campus clubs.");

            // Even on error, fallback to showing self so page is NEVER blank
            const selfClubFallback = buildSynthesizedSelf();
            if (selfClubFallback) {
                setClubs([selfClubFallback]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClubs();
    }, [currentClubId, collegeId, collegeName]);

    // Split clubs into self and peers
    const selfClub = useMemo(() => {
        return (
            clubs.find(
                (c) => c.id === currentClubId || c.isCurrentClub || (currentClubSlug && c.slug === currentClubSlug)
            ) || buildSynthesizedSelf()
        );
    }, [clubs, currentClubId, currentClubSlug, currentClubData]);

    const peerClubs = useMemo(() => {
        return clubs.filter(
            (c) => c.id !== currentClubId && !c.isCurrentClub && (!currentClubSlug || c.slug !== currentClubSlug)
        );
    }, [clubs, currentClubId, currentClubSlug]);

    // Unique categories extracted from available peer clubs
    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        clubs.forEach((c) => {
            if (c.category && c.category.trim()) {
                set.add(c.category.trim());
            }
        });
        return Array.from(set);
    }, [clubs]);

    // Filtered peer clubs
    const filteredPeerClubs = useMemo(() => {
        return peerClubs.filter((c) => {
            // Search query matching
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = c.name?.toLowerCase().includes(q);
                const matchSlug = c.slug?.toLowerCase().includes(q);
                const matchCategory = c.category?.toLowerCase().includes(q);
                const matchShort = c.shortDescription?.toLowerCase().includes(q);
                const matchTags = Array.isArray(c.focusAreas) && c.focusAreas.some((t) => t.toLowerCase().includes(q));

                if (!matchName && !matchSlug && !matchCategory && !matchShort && !matchTags) {
                    return false;
                }
            }

            // Category filter
            if (selectedCategory !== "all") {
                if (c.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
                    return false;
                }
            }

            // Recruiting only filter
            if (onlyRecruiting) {
                if (c.recruitmentStatus !== "open") {
                    return false;
                }
            }

            return true;
        });
    }, [peerClubs, searchQuery, selectedCategory, onlyRecruiting]);

    const displayCollegeName = resolvedCollegeName || collegeName || currentClubData?.college_name || "Your College Campus";

    return (
        <div className="space-y-6">
            <header className="space-y-2 border-b-2 border-black/55 pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <h1 className="text-xl font-black tracking-tight text-black sm:text-3xl">
                            Campus Chapters &amp; Directory
                        </h1>
                    </div>
                    {!loading && (
                        <span className="shrink-0 rounded-lg border-2 border-black bg-[#a2ff86] px-2 py-1 text-[11px] font-black text-black sm:px-3 sm:text-sm">
                            Campus Clubs {clubs.length}
                        </span>
                    )}
                </div>
                <p className="text-xs font-bold leading-relaxed text-neutral-700 sm:text-sm">
                    Discover verified student clubs at {displayCollegeName} and find peers to collaborate with.
                </p>
            </header>

            {/* Error Message if fetch fails */}
            {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3 text-rose-900 text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={loadClubs}
                        className="px-3 py-1 rounded-lg bg-rose-200 text-black border border-black font-black hover:bg-rose-300 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
                <div className="grid grid-cols-1 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3 gap-5">
                    {[1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className="bg-white rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden animate-pulse h-80 flex flex-col justify-between"
                        >
                            <div className="h-28 bg-neutral-200" />
                            <div className="p-4 space-y-3 flex-1">
                                <div className="w-14 h-14 rounded-xl bg-neutral-300 -mt-10" />
                                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                                <div className="h-3 bg-neutral-200 rounded w-1/2" />
                                <div className="h-10 bg-neutral-100 rounded w-full mt-2" />
                            </div>
                            <div className="p-4 border-t border-neutral-100">
                                <div className="h-8 bg-neutral-200 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Section 2: PEER CAMPUS CLUBS */}
            {!loading && (
                <div className="space-y-4 pt-2">
                    {/* Filter & Search Bar - only show if peer clubs exist */}
                    {peerClubs.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Search input */}
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="Search peer clubs"
                                    placeholder="Search clubs by name, category, or keyword..."
                                    className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Category NeoSelect & Recruiting Toggle */}
                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                                <div className="w-full sm:w-56">
                                    <NeoSelect
                                        value={selectedCategory}
                                        onChange={(val) => setSelectedCategory(val)}
                                        options={[
                                            { value: "all", label: "All Categories" },
                                            ...availableCategories.map((cat) => ({
                                                value: cat,
                                                label: cat,
                                            })),
                                        ]}
                                        size="sm"
                                        className="w-full"
                                        triggerClassName="h-9 font-bold bg-[#FAF6EE] text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                    />
                                </div>

                                <button
                                    type="button"
                                    aria-pressed={onlyRecruiting}
                                    onClick={() => setOnlyRecruiting((prev) => !prev)}
                                    className={`px-3 py-2 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                        onlyRecruiting
                                            ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 hover:text-black shadow-[1.5px_1.5px_0px_#000]"
                                    }`}
                                >
                                    <Radio className={`w-3 h-3 ${onlyRecruiting ? "text-black stroke-[3]" : "text-neutral-400"}`} />
                                    <span>Recruiting Only</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {peerClubs.length > 0 && (searchQuery || selectedCategory !== "all" || onlyRecruiting) && (
                        <div className="flex justify-end px-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedCategory("all");
                                    setOnlyRecruiting(false);
                                }}
                                className="cursor-pointer text-xs font-black text-black underline hover:no-underline"
                            >
                                Reset all filters
                            </button>
                        </div>
                    )}

                    {/* One shared grid, with the current club pinned first. */}
                    {(selfClub || filteredPeerClubs.length > 0) && (
                        <div className="grid grid-cols-1 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3 gap-5 sm:gap-6">
                            {selfClub && (
                                <ClubCard club={selfClub} isCurrentClub={true} onSelect={setSelectedClubForModal} />
                            )}
                            {filteredPeerClubs.map((clubItem) => (
                                <ClubCard
                                    key={clubItem.id}
                                    club={clubItem}
                                    isCurrentClub={false}
                                    onSelect={(selected) => setSelectedClubForModal(selected)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Empty Filter State (When peer clubs exist but search returned 0) */}
                    {peerClubs.length > 0 && filteredPeerClubs.length === 0 && (
                        <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-3 max-w-md mx-auto my-6">
                            <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                <Search className="w-6 h-6 text-black stroke-[2.2]" />
                            </div>
                            <h4 className="text-base font-black text-black">
                                No peer clubs match your search
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium">
                                We couldn't find any peer clubs matching &ldquo;{searchQuery}&rdquo;. Try checking your spelling or clearing filters.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedCategory("all");
                                    setOnlyRecruiting(false);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Clear Search Filters
                            </button>
                        </div>
                    )}

                    {!error && peerClubs.length === 0 && (
                        <div className="mx-auto max-w-lg space-y-3 rounded-2xl border-2 border-black bg-[#FFF4CF] p-5 text-center shadow-[3px_3px_0px_#000] sm:p-7">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black bg-[#FFE566] shadow-[2px_2px_0px_#000]">
                                <Building2 aria-hidden="true" className="h-6 w-6 stroke-[2]" />
                            </div>
                            <h2 className="text-base font-black text-black sm:text-lg">
                                No other clubs from {displayCollegeName} yet
                            </h2>
                            <p className="text-xs font-medium leading-relaxed text-neutral-700 sm:text-sm">
                                Invite other student clubs to join Orbix and collaborate on campus events. Their profiles and events will appear here once they join.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsInviteModalOpen(true)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-black bg-[#FFE566] px-4 py-2 text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e]"
                                >
                                    <Share2 aria-hidden="true" className="h-3.5 w-3.5 stroke-[2.5]" />
                                    Share Campus Invite
                                </button>
                                {selfClub && (
                                    <Link
                                        to={`/clubs/${selfClub.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-black bg-white px-4 py-2 text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100"
                                    >
                                        Preview Public Page
                                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Reusable Expanded Full-Screen Club Detail Modal */}
            <ClubDetailModal
                club={selectedClubForModal}
                isOpen={Boolean(selectedClubForModal)}
                onClose={() => setSelectedClubForModal(null)}
                onNavigateToEdit={onNavigateToEditProfile}
            />

            {/* Invite Campus Leads Modal */}
            <InviteCampusLeadsModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                collegeName={displayCollegeName}
                collegeId={collegeId || currentClubData?.college_id}
            />
        </div>
    );
};
