import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Building2,
    GraduationCap,
    Trophy,
    ArrowRight,
    BookOpen,
    Search,
    X,
    Radio,
    Share2,
    MapPin,
    ArrowUpRight,
    Clock,
    Users,
    Heart,
    Globe2,
    SlidersHorizontal,
} from "lucide-react";
import { ClubCard } from "../../../components/ClubCard";
import { ClubDetailModal } from "../../../components/ClubDetailModal";
import { InviteCampusLeadsModal } from "../../../components/InviteCampusLeadsModal";
import { CollegeEventDetailModal } from "../../../app/Events/CollegeEventDetailModal";
import { NeoSelect } from "../../../components/NeoSelect";
import { IndiaMapBackdrop, CampusPillarsBackdrop } from "../../../components/ScopeBackdrops";
import {
    MOCK_COLLEGES,
    MOCK_CLUBS_DATA,
    MOCK_COLLEGE_EVENTS_DATA,
    type MockCollegeOption,
} from "./mockClubs";
import type { CollegeClubItem } from "../../../utils/clubProfileApi";
import type { CollegeEventItem } from "../../../api/collegeEventsApi";

// Helpers for authentic date and time formatting
const formatEventTime = (startsAt: string, endsAt: string | null) => {
    try {
        const start = new Date(startsAt);
        const startTimeStr = start.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        if (endsAt) {
            const end = new Date(endsAt);
            const endTimeStr = end.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
            return `${startTimeStr} - ${endTimeStr}`;
        }
        return startTimeStr;
    } catch {
        return "10:00 - 13:00";
    }
};

const formatEventDate = (startsAt: string) => {
    try {
        const d = new Date(startsAt);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
        return "6 Nov";
    }
};

export const ClubsShowcase: React.FC = () => {
    // Selected College Hub (defaults to PSIT Kanpur matching user provided screenshots)
    const [selectedCollegeId, setSelectedCollegeId] = useState<string>("psit-kanpur");

    const currentCollege: MockCollegeOption = useMemo(() => {
        return (
            MOCK_COLLEGES.find((c) => c.id === selectedCollegeId) ||
            MOCK_COLLEGES[0]
        );
    }, [selectedCollegeId]);

    // =========================================================================
    // CLUBS SECTION STATE & FILTERS (Matches StudentCampusClubsView)
    // =========================================================================
    const [clubsList] = useState<CollegeClubItem[]>(MOCK_CLUBS_DATA);
    const [clubSearchQuery, setClubSearchQuery] = useState("");
    const [selectedClubCategory, setSelectedClubCategory] = useState<string>("all");
    const [onlyRecruiting, setOnlyRecruiting] = useState<boolean>(false);
    const [clubSortBy, setClubSortBy] = useState<"name" | "members" | "events" | "recent">("name");
    const [selectedClubForModal, setSelectedClubForModal] = useState<CollegeClubItem | null>(null);

    // =========================================================================
    // EVENTS SECTION STATE & FILTERS (Matches CollegeEventsView)
    // =========================================================================
    const [eventsList, setEventsList] = useState<CollegeEventItem[]>(MOCK_COLLEGE_EVENTS_DATA);
    const [eventSearchQuery, setEventSearchQuery] = useState("");
    const [eventTimeFilter, setEventTimeFilter] = useState<"live" | "today" | "completed" | "passes" | "all">("live");
    const [selectedEventClubId, setSelectedEventClubId] = useState<string>("all");
    const [selectedEventForModal, setSelectedEventForModal] = useState<CollegeEventItem | null>(null);

    // Modals
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteModalTab, setInviteModalTab] = useState<"wakeUpCall" | "official" | "panIndiaChallenge">("wakeUpCall");

    // Filtered Clubs based on search & filters
    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        clubsList.forEach((c) => {
            if (c.category && c.category.trim()) {
                set.add(c.category.trim());
            }
        });
        return Array.from(set);
    }, [clubsList]);

    const filteredClubs = useMemo(() => {
        let result = clubsList.filter((c) => {
            // Search query matching
            if (clubSearchQuery.trim()) {
                const q = clubSearchQuery.toLowerCase().trim();
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
            if (selectedClubCategory !== "all") {
                if (c.category?.toLowerCase() !== selectedClubCategory.toLowerCase()) {
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
            if (clubSortBy === "name") {
                return a.name.localeCompare(b.name);
            }
            if (clubSortBy === "members") {
                return (b.memberCount || 0) - (a.memberCount || 0);
            }
            if (clubSortBy === "events") {
                return (b.eventsCount || 0) - (a.eventsCount || 0);
            }
            return 0;
        });

        return result;
    }, [clubsList, clubSearchQuery, selectedClubCategory, onlyRecruiting, clubSortBy]);

    const recruitingCount = useMemo(() => {
        return clubsList.filter((c) => c.recruitmentStatus === "open").length;
    }, [clubsList]);

    // Events Filtering
    const allCampusEvents = useMemo(
        () => eventsList.filter((e) => e.scope !== "PAN_INDIA"),
        [eventsList]
    );
    const allPanIndiaEvents = useMemo(
        () => eventsList.filter((e) => e.scope === "PAN_INDIA"),
        [eventsList]
    );

    const filteredEvents = useMemo(() => {
        let list = [...eventsList];

        if (selectedEventClubId !== "all") {
            list = list.filter((e) => e.clubId === selectedEventClubId);
        }

        if (eventSearchQuery.trim()) {
            const q = eventSearchQuery.toLowerCase();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(q) ||
                    (e.summary && e.summary.toLowerCase().includes(q)) ||
                    (e.venueOrLocation && e.venueOrLocation.toLowerCase().includes(q)) ||
                    e.clubName.toLowerCase().includes(q)
            );
        }

        if (eventTimeFilter === "completed") {
            list = list.filter((e) => e.status === "completed");
        } else if (eventTimeFilter === "today") {
            list = list.filter((e) => {
                const today = new Date().toDateString();
                return new Date(e.startsAt).toDateString() === today;
            });
        } else if (eventTimeFilter === "passes") {
            list = list.filter((e) => e.isRegistered);
        }

        return list;
    }, [eventsList, selectedEventClubId, eventSearchQuery, eventTimeFilter]);

    const filteredCampusEvents = useMemo(
        () => filteredEvents.filter((e) => e.scope !== "PAN_INDIA"),
        [filteredEvents]
    );
    const filteredPanIndiaEvents = useMemo(
        () => filteredEvents.filter((e) => e.scope === "PAN_INDIA"),
        [filteredEvents]
    );

    // Heart Like Toggle Interaction
    const handleToggleHeart = (ev: CollegeEventItem) => {
        setEventsList((prev) =>
            prev.map((item) => {
                if (item.id === ev.id) {
                    const nextLiked = !item.hasLiked;
                    return {
                        ...item,
                        hasLiked: nextLiked,
                        likesCount: nextLiked ? item.likesCount + 1 : Math.max(0, item.likesCount - 1),
                    };
                }
                return item;
            })
        );
    };

    // Quick Apply Interaction
    const handleApplyEvent = (ev: CollegeEventItem) => {
        setSelectedEventForModal(ev);
    };

    return (
        <section className="relative w-full bg-[#FAF6EE] text-neutral-900 py-16 sm:py-24 px-0 overflow-hidden font-sans select-none">
            {/* Warm, eye-friendly dot grid matching Orbix platform canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* =========================================================================
                SECTION HEADER: Exact styling from User Request Image 1 & Neo-Brutalist Theme
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto mb-12 sm:mb-16 px-4 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    {/* Left Column: Bold Headline & Redirections */}
                    <div className="lg:col-span-6 space-y-6">
                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-black tracking-tight leading-[1.08]">
                            Campus clubs &
                            <br />
                            <span className="inline-block mt-3 bg-[#FFE566] text-black px-5 sm:px-8 py-1.5 sm:py-2.5 rounded-2xl font-black -rotate-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                                national events
                            </span>
                        </h2>

                        <p className="text-neutral-700 font-medium text-base sm:text-lg md:text-xl max-w-xl leading-relaxed">
                            Explore verified student chapters, pan-India hackathons, and campus sessions. Connect with leads and never miss a college meetup.
                        </p>

                        {/* Dual Redirections */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <Link
                                to="/clubs"
                                className="inline-flex items-center gap-2 text-base sm:text-lg font-black text-black hover:text-neutral-800 transition-colors group cursor-pointer"
                                title="Explore Verified Campus Chapters"
                            >
                                <span className="underline decoration-4 underline-offset-4 decoration-[#FFE566] group-hover:decoration-black">
                                    Explore campus clubs
                                </span>
                                <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1.5 transition-transform stroke-[2.5]" />
                            </Link>

                            <span className="text-black/30 hidden sm:inline">•</span>

                            <Link
                                to="/docs/college-chapters"
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-black transition-colors"
                                title="Read College Chapter Documentation"
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>College Chapter Docs →</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: 3 Feature Cards matching User Request Image 1 */}
                    <div className="lg:col-span-6 space-y-4">
                        {/* 1. Campus Clubs & Chapters */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <Building2 className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Campus Clubs & Chapters
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Explore verified student organizations, technical chapters, and developer societies at your college.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. College & National Arenas */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <GraduationCap className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Pan-India & Campus Events
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Restricted college workshops or open national hackathon arenas. Direct RSVPs with live pass synchronization.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Host as Club Chapter */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <Trophy className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Host as Club Chapter
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Put your college on the national tech map. Invite leads, publish challenges, and bring thousands of coders to your campus.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                THE CLUBS & EVENTS SHOWCASE CONTAINER (Matches Leaderboard & Hero Width Directly)
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto rounded-[18px] sm:rounded-[24px] lg:rounded-[30px] bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black shadow-[8px_8px_0px_#000] p-4 sm:p-7 md:p-8 relative z-10 space-y-8 text-neutral-900">
                {/* =========================================================================
                    REAL SECTION 1: CLUBS VIEW (From User Request Image 2 - StudentCampusClubsView)
                ========================================================================= */}
                <div className="space-y-6">
                    {/* Section Header Bar (Image 2) */}
                    <div className="pb-5 border-b-2 border-black/35 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                    Campus Clubs & Chapters
                                </h2>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-neutral-700">
                                Explore verified student organizations, technical chapters, and developer societies at your college.
                            </p>
                        </div>

                        {/* Badges & Outreach */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                    CAMPUS CLUBS
                                </span>
                                <span className="text-sm font-black text-black bg-[#FAF6EE] px-2 py-0.5 rounded-md border border-black">
                                    {clubsList.length}
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
                                onClick={() => {
                                    setInviteModalTab("official");
                                    setIsInviteModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                title="Invite Campus Club Leads"
                            >
                                <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Invite Leads</span>
                            </button>
                        </div>
                    </div>

                    {/* College Affiliation Highlight Card (Image 2) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                <GraduationCap className="w-6 h-6 text-black stroke-[2.2]" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
                                        {currentCollege.officialName}
                                    </h3>
                                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                                        AISHE: {currentCollege.aisheCode}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                        <span>
                                            {currentCollege.city}, {currentCollege.state}
                                        </span>
                                    </span>
                                    <span>·</span>
                                    <span>Official College Hub</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                // Cycle to next mock college for demo interactivity
                                const nextIdx =
                                    (MOCK_COLLEGES.findIndex((c) => c.id === selectedCollegeId) + 1) %
                                    MOCK_COLLEGES.length;
                                setSelectedCollegeId(MOCK_COLLEGES[nextIdx].id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-200 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px] self-start md:self-auto cursor-pointer"
                            title="Click to cycle college campus"
                        >
                            <span>Change College</span>
                        </button>
                    </div>

                    {/* Search & Filter Toolbar (Image 2) */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Search Box */}
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                <input
                                    type="text"
                                    value={clubSearchQuery}
                                    onChange={(e) => setClubSearchQuery(e.target.value)}
                                    placeholder="Search by club name, category, or focus area (e.g. AI, Web, Coding)..."
                                    className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                {clubSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setClubSearchQuery("")}
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
                                    <Radio
                                        className={`w-3 h-3 ${
                                            onlyRecruiting ? "stroke-[3] text-black animate-pulse" : "text-neutral-600"
                                        }`}
                                    />
                                    <span>Recruiting Only</span>
                                </button>

                                <div className="w-44">
                                    <NeoSelect
                                        value={clubSortBy}
                                        onChange={(v) => setClubSortBy(v as any)}
                                        size="sm"
                                        triggerClassName="!bg-[#FAF6EE] !rounded-xl !py-2 text-xs !shadow-none border-2 border-black font-bold"
                                    >
                                        <option value="name">Sort: Name (A-Z)</option>
                                        <option value="members">Sort: Most Members</option>
                                        <option value="events">Sort: Most Events</option>
                                        <option value="recent">Sort: Recently Verified</option>
                                    </NeoSelect>
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
                                    onClick={() => setSelectedClubCategory("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                        selectedClubCategory === "all"
                                            ? "bg-[#a2ff86] text-black border-black font-black shadow-[1.5px_1.5px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 border-black/30 hover:border-black"
                                    }`}
                                >
                                    All ({clubsList.length})
                                </button>
                                {availableCategories.map((cat) => {
                                    const count = clubsList.filter(
                                        (c) => c.category?.toLowerCase() === cat.toLowerCase()
                                    ).length;
                                    const isSelected = selectedClubCategory.toLowerCase() === cat.toLowerCase();
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedClubCategory(isSelected ? "all" : cat)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer capitalize ${
                                                isSelected
                                                    ? "bg-[#a2ff86] text-black border-black font-black shadow-[1.5px_1.5px_0px_#000]"
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

                    {/* Clubs Showing Count & Listing Grid (Image 2) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-neutral-600">
                                Showing <strong>{filteredClubs.length}</strong> of <strong>{clubsList.length}</strong> student organization{clubsList.length === 1 ? "" : "s"} at <strong className="text-black">{currentCollege.officialName}</strong>
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
                </div>

                {/* Subtle Neo-Brutalist Separation between Clubs and Events */}
                <div className="my-8 pt-6 border-t-2 border-black/20" />

                {/* =========================================================================
                    REAL SECTION 2: COLLEGE EVENTS VIEW (From User Request Image 3 & 4 - CollegeEventsView)
                ========================================================================= */}
                <div className="space-y-6">
                    {/* Header Banner (Image 3) */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-black tracking-tight">
                                College & National Events Hub
                            </h2>
                            <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-neutral-600">
                                <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-neutral-500 shrink-0" />
                                    <span>
                                        Campus: <strong className="font-black text-black">{currentCollege.officialName}</strong>
                                    </span>
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF9933]/20 border border-[#FF9933] text-black text-[11px] font-black">
                                    <Globe2 className="w-3 h-3 text-[#FF9933]" />
                                    {allPanIndiaEvents.length} Pan India Arenas
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 border border-sky-400 text-sky-950 text-[11px] font-black">
                                    <GraduationCap className="w-3 h-3 text-sky-700" />
                                    {allCampusEvents.length} Campus Sessions
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Bar (Image 3) */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    value={eventSearchQuery}
                                    onChange={(e) => setEventSearchQuery(e.target.value)}
                                    placeholder="Search by title, topics, hackathons, clubs, or location..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-none focus:bg-white"
                                />
                                {eventSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setEventSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Club Dropdown Filter */}
                            <div className="shrink-0 flex items-center gap-2 min-w-[200px]">
                                <SlidersHorizontal className="w-4 h-4 text-neutral-500 shrink-0" />
                                <div className="flex-1">
                                    <NeoSelect
                                        value={selectedEventClubId}
                                        onChange={(val) => setSelectedEventClubId(val)}
                                        size="sm"
                                        triggerClassName="!bg-[#FAF6EE] !rounded-xl !py-2 text-xs !shadow-none border-2 border-black font-bold"
                                    >
                                        <option value="all">All Campus Clubs</option>
                                        {clubsList.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NeoSelect>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Filter Pills (Image 3) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/10">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEventTimeFilter("live")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                        eventTimeFilter === "live" || eventTimeFilter === "all"
                                            ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                >
                                    LIVE & UPCOMING ({eventsList.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventTimeFilter("today")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                        eventTimeFilter === "today"
                                            ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                >
                                    TODAY (0)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventTimeFilter("completed")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                        eventTimeFilter === "completed"
                                            ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                >
                                    COMPLETED (0)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventTimeFilter("passes")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                        eventTimeFilter === "passes"
                                            ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                >
                                    MY PASSES (0)
                                </button>
                            </div>

                            <span className="text-xs font-bold text-neutral-500">
                                Showing {filteredEvents.length} total event{filteredEvents.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>

                    {/* Campus Club Sessions & Workshops Section (Image 3) */}
                    <div className="space-y-4">
                        {/* Section Sub-Header */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-full bg-sky-200 text-sky-950 border border-black text-[11px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] inline-flex items-center gap-1">
                                        <GraduationCap className="w-3 h-3 stroke-[2.5]" />
                                        CAMPUS EXCLUSIVE
                                    </span>
                                    <span className="text-xs font-bold text-neutral-500">
                                        Restricted to students of {currentCollege.officialName}
                                    </span>
                                </div>
                                <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                    Campus Club Sessions & Workshops
                                </h3>
                            </div>

                            <div className="text-xs font-black text-neutral-700 bg-[#FAF6EE] px-3 py-1.5 rounded-xl border border-black shrink-0 self-start sm:self-auto">
                                Showing {filteredCampusEvents.length} campus session{filteredCampusEvents.length === 1 ? "" : "s"}
                            </div>
                        </div>

                        {/* Campus Event Cards Grid (Image 3) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredCampusEvents.map((ev) => (
                                <div
                                    key={ev.id}
                                    onClick={() => setSelectedEventForModal(ev)}
                                    className="relative overflow-hidden p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
                                >
                                    {/* Architectural Pillars Backdrop */}
                                    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                                        <div className="absolute -right-4 -bottom-6 w-40 sm:w-48 h-40 sm:h-48 opacity-[0.06] group-hover:opacity-[0.14] transition-opacity duration-300 text-neutral-900">
                                            <CampusPillarsBackdrop className="w-full h-full object-contain" />
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-col justify-between h-full">
                                        <div>
                                        {/* Cover Banner */}
                                        <div className="relative w-full aspect-[2.4/1] rounded-xl border-2 border-black overflow-hidden mb-3.5 bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                            {ev.coverImageUrl ? (
                                                <img
                                                    src={ev.coverImageUrl}
                                                    alt={ev.title}
                                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-[#FAF6EE] flex items-center justify-center font-black text-neutral-400 text-sm">
                                                    {ev.clubName}
                                                </div>
                                            )}

                                            {/* Heart Button Overlay */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleHeart(ev);
                                                }}
                                                className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1.5 text-xs font-black cursor-pointer transition-transform active:scale-95 ${
                                                    ev.hasLiked
                                                        ? "bg-rose-100 text-rose-700"
                                                        : "bg-white/95 text-neutral-800 hover:bg-white"
                                                }`}
                                                title={ev.hasLiked ? "Remove heart" : "Appreciate event"}
                                            >
                                                <Heart
                                                    className={`w-3.5 h-3.5 ${
                                                        ev.hasLiked
                                                            ? "fill-rose-600 text-rose-600"
                                                            : "text-black"
                                                    }`}
                                                />
                                                <span>{ev.likesCount}</span>
                                            </button>

                                            {/* Timeline Status Badge & Scope Indicator */}
                                            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 bg-emerald-300 text-black animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-ping inline-block" />
                                                    LIVE NOW
                                                </span>

                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 bg-sky-200 text-sky-950">
                                                    <GraduationCap className="w-2.5 h-2.5" />
                                                    CAMPUS
                                                </span>
                                            </div>
                                        </div>

                                        {/* Club Info Ribbon */}
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 group min-w-0">
                                                {ev.clubLogoUrl ? (
                                                    <img
                                                        src={ev.clubLogoUrl}
                                                        alt={ev.clubName}
                                                        className="w-5 h-5 rounded-md border border-black object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-md border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[9px] shrink-0">
                                                        {ev.clubName.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-xs font-black text-black group-hover:underline truncate">
                                                    {ev.clubName}
                                                </span>
                                            </div>

                                            <span className="text-[11px] font-bold text-neutral-500 shrink-0">
                                                {formatEventDate(ev.startsAt)}
                                            </span>
                                        </div>

                                        {/* Title & Summary */}
                                        <h4 className="text-base font-black text-neutral-900 line-clamp-1 group-hover:text-black">
                                            {ev.title}
                                        </h4>
                                        <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                                            {ev.summary || "Join this chapter meetup on campus."}
                                        </p>

                                        {/* Timing and Location */}
                                        <div className="mt-3.5 space-y-1.5 text-xs text-neutral-600 font-medium">
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                <span>{formatEventTime(ev.startsAt, ev.endsAt)}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 font-bold truncate">
                                                <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                <span className="truncate">
                                                    {ev.venueOrLocation || "Campus Hall"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Action Bar */}
                                    <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600">
                                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                                            <span>{ev.registrationsCount} registered</span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleApplyEvent(ev);
                                                }}
                                                className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>

                    {/* Pan-India National Arenas Section (Image 4) */}
                    {filteredPanIndiaEvents.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-0.5 rounded-full bg-[#FF9933] text-black border border-black text-[11px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] inline-flex items-center gap-1">
                                            <Globe2 className="w-3 h-3 stroke-[2.5]" />
                                            PAN-INDIA NATIONAL ARENAS
                                        </span>
                                        <span className="text-xs font-bold text-neutral-500">
                                            Open to verified college students throughout India
                                        </span>
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                        Inter-College Hackathons & Competitions
                                    </h3>
                                </div>

                                <div className="text-xs font-black text-neutral-700 bg-[#FAF6EE] px-3 py-1.5 rounded-xl border border-black shrink-0 self-start sm:self-auto">
                                    Showing {filteredPanIndiaEvents.length} national arena{filteredPanIndiaEvents.length === 1 ? "" : "s"}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredPanIndiaEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        onClick={() => setSelectedEventForModal(ev)}
                                        className="relative overflow-hidden p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:border-[#FF9933] transition-all cursor-pointer group"
                                    >
                                        {/* India Map Backdrop */}
                                        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                                            <div className="absolute -right-6 -bottom-6 w-48 sm:w-56 h-48 sm:h-56 opacity-[0.05] group-hover:opacity-[0.13] transition-opacity duration-300 text-neutral-950">
                                                <IndiaMapBackdrop className="w-full h-full object-contain" />
                                            </div>
                                        </div>

                                        <div className="relative z-10 flex flex-col justify-between h-full">
                                            <div>
                                            <div className="relative w-full aspect-[2.4/1] rounded-xl border-2 border-black overflow-hidden mb-3.5 bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                                {ev.coverImageUrl && (
                                                    <img
                                                        src={ev.coverImageUrl}
                                                        alt={ev.title}
                                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                )}
                                                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] bg-[#FF9933] text-black flex items-center gap-1">
                                                        <Globe2 className="w-2.5 h-2.5" />
                                                        PAN INDIA
                                                    </span>
                                                </div>
                                            </div>

                                            <h4 className="text-base font-black text-neutral-900 line-clamp-1">
                                                {ev.title}
                                            </h4>
                                            <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                                                {ev.summary}
                                            </p>

                                            <div className="mt-3.5 space-y-1.5 text-xs text-neutral-600 font-medium">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                    <span>{formatEventTime(ev.startsAt, ev.endsAt)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 font-bold truncate">
                                                    <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                    <span className="truncate">{ev.venueOrLocation}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600">
                                                <Users className="w-3.5 h-3.5 text-neutral-500" />
                                                <span>{ev.registrationsCount} registered</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleApplyEvent(ev);
                                                }}
                                                className="px-3.5 py-1.5 rounded-xl bg-[#FF9933] hover:bg-[#ff881a] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                            >
                                                <span>Register & Track</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}

                    {/* National Spotlight Callout Banner (Image 4) */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] relative overflow-hidden space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1.5 max-w-2xl">
                                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FF9933] text-black border border-black text-xs font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000]">
                                    <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>NATIONAL SPOTLIGHT • PAN-INDIA ARENAS OPENING SOON</span>
                                </div>
                                <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                    Put {currentCollege.officialName} on the National Tech Map!
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                    Want our campus to host India's next premier hackathon, AI sprint, or design conference? You don't have to wait for faculty. Invite your club coordinators to publish a nationwide challenge on Orbix and bring thousands of student developers to our institution.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInviteModalTab("panIndiaChallenge");
                                        setIsInviteModalOpen(true);
                                    }}
                                    className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Invite Clubs to Host</span>
                                </button>

                                <Link
                                    to={`/auth/signup?tab=club&ref=panindia-spotlight&college=${encodeURIComponent(
                                        currentCollege.officialName
                                    )}`}
                                    className="px-4 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Host as Club Chapter</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                MODALS FOR SEAMLESS INTERACTIVE EXPERIENCE
            ========================================================================= */}
            {/* Club Detail Modal */}
            <ClubDetailModal
                club={selectedClubForModal}
                isOpen={!!selectedClubForModal}
                onClose={() => setSelectedClubForModal(null)}
            />

            {/* College Event Detail Modal */}
            <CollegeEventDetailModal
                event={selectedEventForModal}
                isOpen={!!selectedEventForModal}
                onClose={() => setSelectedEventForModal(null)}
                onApply={() => {
                    setSelectedEventForModal(null);
                }}
                onToggleHeart={handleToggleHeart}
            />

            {/* Invite Campus Leads Modal */}
            <InviteCampusLeadsModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                collegeName={currentCollege.officialName}
                collegeId={currentCollege.id}
                initialTab={inviteModalTab}
            />
        </section>
    );
};

export default ClubsShowcase;
