import React, { useEffect, useState, useMemo } from "react";
import {
    Search,
    Building2,
    Radio,
    RefreshCw,
    X,
    AlertCircle,
} from "lucide-react";
import { fetchCollegeClubs, type CollegeClubItem } from "../../utils/clubProfileApi";
import { ClubCard } from "../../components/ClubCard";
import { ClubDetailModal } from "../../components/ClubDetailModal";
import { NeoSelect } from "../../components/NeoSelect";

interface OtherClubsSectionProps {
    currentClubId: string;
    currentClubSlug?: string;
    collegeId?: string;
    collegeName?: string;
    onNavigateToEditProfile?: () => void;
}

export const OtherClubsSection: React.FC<OtherClubsSectionProps> = ({
    currentClubId,
    collegeId,
    collegeName,
    onNavigateToEditProfile,
}) => {
    const [clubs, setClubs] = useState<CollegeClubItem[]>([]);
    const [resolvedCollegeName, setResolvedCollegeName] = useState<string>(collegeName || "");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [onlyRecruiting, setOnlyRecruiting] = useState<boolean>(false);

    // Modal state for full expanded details
    const [selectedClubForModal, setSelectedClubForModal] = useState<CollegeClubItem | null>(null);

    const loadClubs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCollegeClubs({
                collegeId,
                collegeName,
                clubId: currentClubId,
            });
            setClubs(data.clubs || []);
            if (data.collegeName) {
                setResolvedCollegeName(data.collegeName);
            }
        } catch (err: any) {
            console.error("Failed to load college clubs:", err);
            setError(err.message || "Failed to load campus clubs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClubs();
    }, [currentClubId, collegeId, collegeName]);

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

    // Filtered clubs
    const filteredClubs = useMemo(() => {
        return clubs.filter((c) => {
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
    }, [clubs, searchQuery, selectedCategory, onlyRecruiting]);

    return (
        <div className="space-y-6">
            {/* Header Showcase Card */}
            <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                            <Building2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            Collegiate Directory
                        </span>
                        {resolvedCollegeName && (
                            <span className="text-xs sm:text-sm font-black text-black">
                                {resolvedCollegeName}
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                        Explore Campus Chapters & Peer Clubs
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                        Discover official student chapters across your college. Review peer initiatives, cross-collaborate on upcoming hackathons or workshops, and see how prospective recruits perceive your own chapter.
                    </p>
                </div>

                {/* Right Quick Summary Badge */}
                <div className="flex items-center gap-3">
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center min-w-[120px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Campus Clubs
                        </span>
                        <span className="text-2xl font-black text-black">
                            {clubs.length}
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

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search clubs by name, domain (#AI, #Web3, #Design), or keywords..."
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

            {/* Clubs Grid Showcase */}
            {!loading && filteredClubs.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-neutral-600">
                        <span>
                            Showing <strong>{filteredClubs.length}</strong> of <strong>{clubs.length}</strong> campus chapter{clubs.length === 1 ? "" : "s"}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                        {filteredClubs.map((clubItem) => (
                            <ClubCard
                                key={clubItem.id}
                                club={clubItem}
                                isCurrentClub={clubItem.id === currentClubId || clubItem.isCurrentClub}
                                onSelect={(selected) => setSelectedClubForModal(selected)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State when no clubs match */}
            {!loading && filteredClubs.length === 0 && (
                <div className="p-10 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4 max-w-xl mx-auto my-8">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                        <Building2 className="w-7 h-7 text-black stroke-[2.2]" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-black">
                            No campus clubs found
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                            {searchQuery || selectedCategory !== "all" || onlyRecruiting
                                ? "No clubs match your current search query or active filters. Try adjusting your search keywords."
                                : `No other verified student organizations have registered for ${resolvedCollegeName || "this institution"} yet.`}
                        </p>
                    </div>

                    {(searchQuery || selectedCategory !== "all" || onlyRecruiting) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("all");
                                setOnlyRecruiting(false);
                            }}
                            className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Clear All Filters
                        </button>
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
