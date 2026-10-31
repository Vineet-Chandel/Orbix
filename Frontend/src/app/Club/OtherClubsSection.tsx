import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Search,
    Building2,
    Radio,
    RefreshCw,
    X,
    AlertCircle,
    Sparkles,
    ExternalLink,
    Edit3,
    GraduationCap,
    Check,
    Copy,
    Rocket,
} from "lucide-react";
import { fetchCollegeClubs, type CollegeClubItem } from "../../utils/clubProfileApi";
import { ClubCard } from "../../components/ClubCard";
import { ClubDetailModal } from "../../components/ClubDetailModal";
import { NeoSelect } from "../../components/NeoSelect";
import { useToast } from "../../context/ToastContext";

interface OtherClubsSectionProps {
    currentClubId: string;
    currentClubSlug?: string;
    collegeId?: string;
    collegeName?: string;
    currentClubData?: any;
    onNavigateToEditProfile?: () => void;
    onNavigateToTab?: (tab: "overview" | "team" | "events" | "profile" | "settings") => void;
}

export const OtherClubsSection: React.FC<OtherClubsSectionProps> = ({
    currentClubId,
    currentClubSlug,
    collegeId,
    collegeName,
    currentClubData,
    onNavigateToEditProfile,
}) => {
    const toast = useToast();
    const [clubs, setClubs] = useState<CollegeClubItem[]>([]);
    const [resolvedCollegeName, setResolvedCollegeName] = useState<string>(
        collegeName || currentClubData?.college_name || ""
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedInvite, setCopiedInvite] = useState(false);

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
            memberCount: 0,
            eventsCount: 0,
            achievementsCount: 0,
            coordinatorsCount: 0,
            isCurrentClub: true,
            coordinators: [],
            achievements: [],
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

    const handleCopyCampusInvite = () => {
        const inviteUrl = `${window.location.origin}/auth/signup?ref=campus-invite&college=${encodeURIComponent(displayCollegeName)}`;
        navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        toast.success("Campus invitation link copied! Share with presidents and leads of other clubs.", {
            title: "Invite Link Copied",
        });
        setTimeout(() => setCopiedInvite(false), 2500);
    };

    return (
        <div className="space-y-6">
            {/* Header Showcase Card */}
            <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                            <Building2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            Collegiate Directory
                        </span>
                        {displayCollegeName && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-[#a2ff86] text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                <GraduationCap className="w-3.5 h-3.5 stroke-[2.5]" />
                                {displayCollegeName}
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                        Campus Chapters & Student Organizations
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                        Official directory of verified student organizations at <strong className="text-black">{displayCollegeName}</strong>. Explore peer initiatives, co-host inter-club events, and see how prospective recruits discover campus chapters.
                    </p>
                </div>

                {/* Right Quick Summary Badges */}
                <div className="flex items-center gap-3">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center min-w-[95px] sm:min-w-[110px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Campus Clubs
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-black">
                            {clubs.length}
                        </span>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center min-w-[95px] sm:min-w-[110px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Peer Clubs
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-black">
                            {peerClubs.length}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={loadClubs}
                        disabled={loading}
                        className="p-3 rounded-xl bg-white hover:bg-[#FAF6EE] text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        title="Refresh Clubs List"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Smart Remarkness Banner: When No Other Clubs Are on Campus Yet */}
            {!loading && peerClubs.length === 0 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FFE566]/25 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                        <div className="space-y-1.5 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] sm:text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                <Rocket className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Pioneer Chapter on Campus</span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                Your Chapter is Leading the Way at {displayCollegeName}!
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed">
                                Currently, no other student clubs from <strong className="text-black">{displayCollegeName}</strong> have registered on Orbix yet. Your club has exclusive campus visibility! Invite neighboring technical societies, cultural clubs, or council leads to join Orbix to co-host hackathons and cross-promote events.
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                            <button
                                type="button"
                                onClick={handleCopyCampusInvite}
                                className="px-3.5 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedInvite ? "Link Copied!" : "Invite Peer Clubs"}</span>
                            </button>

                            {selfClub && (
                                <Link
                                    to={`/clubs/${selfClub.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Preview Public Page</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

            {/* Section 1: YOUR CLUB ON CAMPUS (Always Visible & Prominently Displayed) */}
            {!loading && selfClub && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFE566] text-black border border-black text-[11px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                <Sparkles className="w-3 h-3 fill-black stroke-none" />
                                Your Chapter
                            </span>
                            <span className="text-xs sm:text-sm font-black text-black">
                                How your club appears in the campus directory
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {onNavigateToEditProfile && (
                                <button
                                    type="button"
                                    onClick={onNavigateToEditProfile}
                                    className="text-xs font-black text-black hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit Profile</span>
                                </button>
                            )}
                            <Link
                                to={`/clubs/${selfClub.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-black text-neutral-700 hover:text-black hover:underline cursor-pointer flex items-center gap-1"
                            >
                                <span>Public View</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    <div className="max-w-md sm:max-w-lg">
                        <ClubCard
                            club={selfClub}
                            isCurrentClub={true}
                            onSelect={(selected) => setSelectedClubForModal(selected)}
                        />
                    </div>
                </div>
            )}

            {/* Section 2: PEER CAMPUS CLUBS */}
            {!loading && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between px-1">
                        <div className="space-y-0.5">
                            <h3 className="text-lg font-black text-black tracking-tight">
                                Peer Chapters & Organizations ({peerClubs.length})
                            </h3>
                            <p className="text-xs font-medium text-neutral-600">
                                Other active student societies registered at {displayCollegeName}
                            </p>
                        </div>
                    </div>

                    {/* Filter & Search Bar - only show if peer clubs exist */}
                    {peerClubs.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Search input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search peer clubs by name, domain (#AI, #Web3, #Design), or keywords..."
                                    className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
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

                    {/* Filter stats bar */}
                    {peerClubs.length > 0 && (
                        <div className="flex items-center justify-between px-1 text-xs font-bold text-neutral-600">
                            <span>
                                Showing <strong>{filteredPeerClubs.length}</strong> of <strong>{peerClubs.length}</strong> peer chapter{peerClubs.length === 1 ? "" : "s"}
                            </span>
                            {(searchQuery || selectedCategory !== "all" || onlyRecruiting) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSelectedCategory("all");
                                        setOnlyRecruiting(false);
                                    }}
                                    className="text-black font-black underline hover:no-underline cursor-pointer"
                                >
                                    Reset all filters
                                </button>
                            )}
                        </div>
                    )}

                    {/* Peer Clubs Grid */}
                    {filteredPeerClubs.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
                                className="px-3.5 py-1.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Clear Search Filters
                            </button>
                        </div>
                    )}

                    {/* When no other clubs exist on campus yet */}
                    {peerClubs.length === 0 && (
                        <div className="p-8 rounded-2xl bg-white border-2 border-dashed border-black/30 text-center space-y-3 max-w-lg mx-auto my-4">
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                <Building2 className="w-6 h-6 text-neutral-600 stroke-[2]" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm sm:text-base font-black text-black">
                                    No other clubs from {displayCollegeName} yet
                                </h4>
                                <p className="text-xs text-neutral-500 font-medium max-w-md mx-auto">
                                    When other student clubs at your college (IEEE, Coding Club, Cultural Society, Sports Council, etc.) register on Orbix, their profiles and events will show up right here.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyCampusInvite}
                                className="px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedInvite ? "Invite Copied!" : "Share Campus Invite"}</span>
                            </button>
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
        </div>
    );
};
