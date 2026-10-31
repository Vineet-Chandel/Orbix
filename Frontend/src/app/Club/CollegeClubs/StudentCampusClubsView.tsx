import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Building2,
    GraduationCap,
    Search,
    X,
    RefreshCw,
    Radio,
    AlertCircle,
    Rocket,
    Check,
    Copy,
    MapPin,
    ArrowUpRight,
    SlidersHorizontal,
} from "lucide-react";
import { fetchCollegeClubs, type CollegeClubItem, type CollegeClubsResponse } from "../../../utils/clubProfileApi";
import { ClubCard } from "../../../components/ClubCard";
import { ClubDetailModal } from "../../../components/ClubDetailModal";
import { NeoSelect } from "../../../components/NeoSelect";
import { useToast } from "../../../context/ToastContext";
import { useAppSelector } from "../../../store";
import { SectionBottomIllustration } from "../../common/SectionBottomIllustration";

interface StudentCampusClubsViewProps {
    onOpenMobileSidebar?: () => void;
}

export const StudentCampusClubsView: React.FC<StudentCampusClubsViewProps> = ({
    onOpenMobileSidebar,
}) => {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [clubs, setClubs] = useState<CollegeClubItem[]>([]);
    const [collegeData, setCollegeData] = useState<{
        collegeName: string;
        collegeId: string | null;
        collegeCity?: string | null;
        collegeState?: string | null;
        collegeAisheCode?: string | null;
    }>({
        collegeName: user?.college?.officialName || (typeof user?.college === "string" ? user.college : "") || "",
        collegeId: user?.collegeId || user?.college?.id || null,
        collegeCity: user?.college?.city || null,
        collegeState: user?.college?.state || null,
        collegeAisheCode: user?.college?.aisheCode || null,
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedInvite, setCopiedInvite] = useState(false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [onlyRecruiting, setOnlyRecruiting] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<"name" | "members" | "events" | "recent">("name");

    // Modal state for viewing expanded club details
    const [selectedClubForModal, setSelectedClubForModal] = useState<CollegeClubItem | null>(null);

    const loadClubs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data: CollegeClubsResponse = await fetchCollegeClubs({
                collegeId: user?.collegeId || user?.college?.id || undefined,
                collegeName: user?.college?.officialName || (typeof user?.college === "string" ? user.college : undefined) || undefined,
            });

            const fetchedClubs: CollegeClubItem[] = Array.isArray(data.clubs) ? data.clubs : [];
            setClubs(fetchedClubs);

            setCollegeData({
                collegeName: data.collegeName || user?.college?.officialName || "Your College",
                collegeId: data.collegeId || user?.collegeId || null,
                collegeCity: data.collegeCity || user?.college?.city || null,
                collegeState: data.collegeState || user?.college?.state || null,
                collegeAisheCode: data.collegeAisheCode || user?.college?.aisheCode || null,
            });
        } catch (err: any) {
            console.error("Failed to load campus clubs:", err);
            setError(err.message || "Failed to load clubs in your college.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClubs();
    }, [user?.collegeId, user?.college]);

    // Unique categories extracted from available clubs
    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        clubs.forEach((c) => {
            if (c.category && c.category.trim()) {
                set.add(c.category.trim());
            }
        });
        return Array.from(set);
    }, [clubs]);

    // Filtered and Sorted Clubs
    const filteredClubs = useMemo(() => {
        let result = clubs.filter((c) => {
            // Search query matching
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = c.name?.toLowerCase().includes(q);
                const matchSlug = c.slug?.toLowerCase().includes(q);
                const matchCategory = c.category?.toLowerCase().includes(q);
                const matchShort = c.shortDescription?.toLowerCase().includes(q);
                const matchAbout = c.about?.toLowerCase().includes(q);
                const matchTags = Array.isArray(c.focusAreas) && c.focusAreas.some((t) => t.toLowerCase().includes(q));

                if (!matchName && !matchSlug && !matchCategory && !matchShort && !matchAbout && !matchTags) {
                    return false;
                }
            }

            // Category filter
            if (selectedCategory !== "all") {
                if (c.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
                    return false;
                }
            }

            // Only recruiting filter
            if (onlyRecruiting) {
                if (c.recruitmentStatus !== "open") {
                    return false;
                }
            }

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "name") {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === "members") {
                return (b.memberCount || 0) - (a.memberCount || 0);
            }
            if (sortBy === "events") {
                return (b.eventsCount || 0) - (a.eventsCount || 0);
            }
            if (sortBy === "recent") {
                const dateA = a.verifiedAt ? new Date(a.verifiedAt).getTime() : 0;
                const dateB = b.verifiedAt ? new Date(b.verifiedAt).getTime() : 0;
                return dateB - dateA;
            }
            return 0;
        });

        return result;
    }, [clubs, searchQuery, selectedCategory, onlyRecruiting, sortBy]);

    const recruitingCount = useMemo(() => {
        return clubs.filter((c) => c.recruitmentStatus === "open").length;
    }, [clubs]);

    const displayCollegeName = collegeData.collegeName || "Your College Campus";

    const handleCopyCampusInvite = () => {
        const inviteUrl = `${window.location.origin}/auth/signup?ref=campus-invite&college=${encodeURIComponent(displayCollegeName)}`;
        navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        toast.success("Campus invitation link copied! Share with presidents and leads of other clubs.", {
            title: "Invite Link Copied",
        });
        setTimeout(() => setCopiedInvite(false), 2500);
    };

    const hasNoCollege = !user?.collegeId && !user?.college && (!collegeData.collegeName || collegeData.collegeName === "Your College");

    return (
        <section
            aria-label="Campus Clubs and Chapters"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* Header Bar */}
                <header className="pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                    aria-label="Open sidebar"
                                >
                                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                </button>
                            )}
                            <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                Campus Clubs & Chapters
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-neutral-700">
                            Explore verified student organizations, technical chapters, and developer societies at your college.
                        </p>
                    </div>

                    {/* Right Summary Badges & Refresh */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                Campus Clubs
                            </span>
                            <span className="text-sm font-black text-black bg-[#FAF6EE] px-2 py-0.5 rounded-md border border-black">
                                {clubs.length}
                            </span>
                        </div>

                        {recruitingCount > 0 && (
                            <div className="px-3 py-1.5 rounded-xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-black stroke-[3] animate-pulse" />
                                <span className="text-xs font-black text-black">
                                    {recruitingCount} Recruiting
                                </span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={loadClubs}
                            disabled={loading}
                            className="p-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
                            title="Refresh Clubs List"
                        >
                            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                {/* College Affiliation Highlight Card */}
                {!hasNoCollege && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="w-6 h-6 text-black stroke-[2.2]" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
                                        {displayCollegeName}
                                    </h2>
                                    {collegeData.collegeAisheCode && (
                                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                                            AISHE: {collegeData.collegeAisheCode}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 mt-0.5">
                                    {(collegeData.collegeCity || collegeData.collegeState) && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                            <span>
                                                {[collegeData.collegeCity, collegeData.collegeState].filter(Boolean).join(", ")}
                                            </span>
                                        </span>
                                    )}
                                    <span>·</span>
                                    <span>Official College Hub</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-auto">
                            <Link
                                to="/profile"
                                className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-200 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <span>Change College</span>
                            </Link>
                        </div>
                    </div>
                )}

                {/* State: No College Affiliation Linked */}
                {hasNoCollege && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                                <GraduationCap className="w-6 h-6 text-black stroke-[2.5]" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">
                                    Link Your College to Discover Campus Clubs
                                </h3>
                                <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                    You haven't set your college affiliation yet. Once you connect your college, you'll be able to see all verified chapters, technical communities, and developer societies at your campus.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-3">
                            <Link
                                to="/profile"
                                className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <span>Set College in Profile</span>
                                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* State: Error */}
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

                {/* State: Loading Skeletons */}
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

                {/* Search & Filter Toolbar (when not loading and has clubs or searching) */}
                {!loading && clubs.length > 0 && (
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Search Box */}
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by club name, category, or focus area (e.g. AI, Web, Coding)..."
                                    className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                )}
                            </div>

                            {/* Sort & Recruitment Filter */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setOnlyRecruiting(!onlyRecruiting)}
                                    className={`px-3 py-2 rounded-xl border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-all cursor-pointer ${
                                        onlyRecruiting
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100 text-neutral-800"
                                    }`}
                                >
                                    <Radio className={`w-3 h-3 ${onlyRecruiting ? "stroke-[3] text-black animate-pulse" : "text-neutral-600"}`} />
                                    <span>Recruiting Only</span>
                                </button>

                                <div className="w-40">
                                    <NeoSelect
                                        value={sortBy}
                                        onChange={(v) => setSortBy(v as any)}
                                        options={[
                                            { value: "name", label: "Sort: Name (A-Z)" },
                                            { value: "members", label: "Sort: Most Members" },
                                            { value: "events", label: "Sort: Most Events" },
                                            { value: "recent", label: "Sort: Recently Verified" },
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Category Filter Pills */}
                        {availableCategories.length > 0 && (
                            <div className="pt-2 border-t border-black/10 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mr-1 flex items-center gap-1">
                                    <SlidersHorizontal className="w-3 h-3" />
                                    Category:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                        selectedCategory === "all"
                                            ? "bg-black text-[#a2ff86] border-black font-black shadow-[1.5px_1.5px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 border-black/30 hover:border-black"
                                    }`}
                                >
                                    All ({clubs.length})
                                </button>
                                {availableCategories.map((cat) => {
                                    const count = clubs.filter((c) => c.category?.toLowerCase() === cat.toLowerCase()).length;
                                    const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCategory(isSelected ? "all" : cat)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer capitalize ${
                                                isSelected
                                                    ? "bg-black text-[#a2ff86] border-black font-black shadow-[1.5px_1.5px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 border-black/30 hover:border-black"
                                            }`}
                                        >
                                            {cat} ({count})
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* State: When 0 clubs are registered in this college */}
                {!loading && !hasNoCollege && clubs.length === 0 && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] relative overflow-hidden space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 max-w-2xl">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] border border-black text-xs font-black text-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000]">
                                    <Rocket className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Pioneer Campus</span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                    No Student Organizations on Campus Yet!
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                    Currently, no student clubs or developer chapters from <strong className="text-black">{displayCollegeName}</strong> have registered on Orbix yet. Are you a club lead, technical head, or community organizer? Register your student organization to launch your official campus presence on Orbix!
                                </p>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCopyCampusInvite}
                                    className="px-4 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    <span>{copiedInvite ? "Link Copied!" : "Invite Campus Leads"}</span>
                                </button>

                                <Link
                                    to="/auth/signup"
                                    className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Register a Club</span>
                                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* State: Filter Results Empty */}
                {!loading && clubs.length > 0 && filteredClubs.length === 0 && (
                    <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mx-auto text-neutral-500">
                            <Search className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <h4 className="text-base font-black text-black">No clubs match your filters</h4>
                        <p className="text-xs text-neutral-600 font-medium max-w-sm mx-auto">
                            We couldn't find any student organizations matching "{searchQuery}". Try searching with different keywords or clear the category filters.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("all");
                                setOnlyRecruiting(false);
                            }}
                            className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}

                {/* Clubs Grid Listing */}
                {!loading && filteredClubs.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-neutral-600">
                                Showing <strong>{filteredClubs.length}</strong> of <strong>{clubs.length}</strong> student organization{clubs.length === 1 ? "" : "s"} at <strong className="text-black">{displayCollegeName}</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredClubs.map((clubItem) => (
                                <ClubCard
                                    key={clubItem.id}
                                    club={clubItem}
                                    onSelect={(selected) => setSelectedClubForModal(selected)}
                                    showCampusName={false}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Expanded Club Detail Modal */}
            <ClubDetailModal
                club={selectedClubForModal}
                isOpen={!!selectedClubForModal}
                onClose={() => setSelectedClubForModal(null)}
            />

            {/* Bottom Neo-Brutalist Illustration */}
            <SectionBottomIllustration alt="Clubs illustration" />
        </section>
    );
};

export default StudentCampusClubsView;
