import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    UserPlus,
    ArrowRight,
    ShieldCheck,
    Trophy,
    GraduationCap,
    MapPin,
    Check,
} from "lucide-react";
import { OrbixButton } from "../../components/ui/loader";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import { EnlargeableAvatar } from "../../components/media/EnlargeableAvatar";
import { getPlatformIcon } from "../../utils/platformLinks";
import { fetchExploreProfiles, type ExploreDeveloper } from "../../utils/profileApi";

export const DEFAULT_RECENT_DEVELOPERS: ExploreDeveloper[] = [
    {
        id: "rec-dev-1",
        username: "dev_siddharth",
        displayName: "Siddharth Rao",
        firstName: "Siddharth",
        lastName: "Rao",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        headline: "Full Stack Engineer & Competitive Programmer | IIIT Hyderabad",
        college: "IIIT Hyderabad",
        location: "Hyderabad, India",
        orbixScore: 3049,
        totalSolved: 450,
        totalContests: 26,
        streak: 12,
        isVerifiedCoder: true,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["React", "Node.js", "C++", "PostgreSQL", "Go"],
        connectedPortals: [
            { portal: "codeforces", portalUsername: "dev_sid", verified: true },
            { portal: "leetcode", portalUsername: "dev_sid", verified: true },
            { portal: "github", portalUsername: "sid-rao", verified: true },
        ],
    },
    {
        id: "rec-dev-2",
        username: "marcus_k",
        displayName: "Marcus Krueger",
        firstName: "Marcus",
        lastName: "Krueger",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
        headline: "Systems Engineer & Microservices Architect | TU Munich",
        college: "Technical University of Munich",
        location: "Munich, Germany",
        orbixScore: 2585,
        totalSolved: 405,
        totalContests: 24,
        streak: 10,
        isVerifiedCoder: true,
        isOpenToWork: false,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["Go", "Docker", "Kubernetes", "PostgreSQL", "Rust"],
        connectedPortals: [
            { portal: "leetcode", portalUsername: "marcus_k", verified: true },
            { portal: "codeforces", portalUsername: "marcus_k", verified: true },
            { portal: "github", portalUsername: "marcusk", verified: true },
        ],
    },
    {
        id: "rec-dev-3",
        username: "yuki_t",
        displayName: "Yuki Tanaka",
        firstName: "Yuki",
        lastName: "Tanaka",
        avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
        headline: "Software Engineer & Competitive Coder | Univ of Tokyo",
        college: "University of Tokyo",
        location: "Tokyo, Japan",
        orbixScore: 2050,
        totalSolved: 390,
        totalContests: 22,
        streak: 15,
        isVerifiedCoder: true,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["Python", "Django", "TypeScript", "React", "AWS"],
        connectedPortals: [
            { portal: "atcoder", portalUsername: "yuki_t", verified: true },
            { portal: "leetcode", portalUsername: "yuki_t", verified: true },
            { portal: "github", portalUsername: "yukit", verified: true },
        ],
    },
    {
        id: "rec-dev-4",
        username: "ananya_g",
        displayName: "Ananya Gupta",
        firstName: "Ananya",
        lastName: "Gupta",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
        headline: "Product Developer & UI Engineer | BITS Pilani",
        college: "BITS Pilani",
        location: "Bengaluru, India",
        orbixScore: 1889,
        totalSolved: 365,
        totalContests: 18,
        streak: 8,
        isVerifiedCoder: false,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["React", "TypeScript", "Node.js", "MongoDB", "Tailwind"],
        connectedPortals: [
            { portal: "leetcode", portalUsername: "ananya_g", verified: true },
            { portal: "github", portalUsername: "ananyag", verified: true },
        ],
    },
    {
        id: "rec-dev-5",
        username: "lucas_silva",
        displayName: "Lucas Silva",
        firstName: "Lucas",
        lastName: "Silva",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
        headline: "Backend Engineer & Database Specialist | USP",
        college: "University of São Paulo",
        location: "São Paulo, Brazil",
        orbixScore: 1651,
        totalSolved: 340,
        totalContests: 16,
        streak: 7,
        isVerifiedCoder: true,
        isOpenToWork: false,
        isHireable: false,
        isPublic: true,
        hasResume: false,
        skills: ["Java", "Spring Boot", "PostgreSQL", "Redis", "Kafka"],
        connectedPortals: [
            { portal: "codeforces", portalUsername: "lucas_s", verified: true },
            { portal: "github", portalUsername: "lucassilva", verified: true },
        ],
    },
    {
        id: "rec-dev-6",
        username: "benchmark_user",
        displayName: "Benchmark Master",
        firstName: "Benchmark",
        lastName: "Master",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80",
        headline: "Principal Platform Architect | High Performance Computing",
        college: "National University of Singapore",
        location: "Singapore",
        orbixScore: 1630,
        totalSolved: 330,
        totalContests: 15,
        streak: 6,
        isVerifiedCoder: true,
        isOpenToWork: false,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["C++", "Rust", "HPC", "Distributed Systems", "Linux"],
        connectedPortals: [
            { portal: "codeforces", portalUsername: "bench_m", verified: true },
            { portal: "leetcode", portalUsername: "bench_m", verified: true },
            { portal: "github", portalUsername: "benchmaster", verified: true },
        ],
    },
    {
        id: "rec-dev-7",
        username: "elena_rostova",
        displayName: "Elena Rostova",
        firstName: "Elena",
        lastName: "Rostova",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
        headline: "Machine Learning Researcher & Algorithmist | ETH Zurich",
        college: "ETH Zurich",
        location: "Zurich, Switzerland",
        orbixScore: 1590,
        totalSolved: 310,
        totalContests: 14,
        streak: 11,
        isVerifiedCoder: true,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["Python", "PyTorch", "C++", "CUDA", "Algorithms"],
        connectedPortals: [
            { portal: "codeforces", portalUsername: "elena_r", verified: true },
            { portal: "github", portalUsername: "elenarostova", verified: true },
        ],
    },
    {
        id: "rec-dev-8",
        username: "aravind_k",
        displayName: "Aravind Kumar",
        firstName: "Aravind",
        lastName: "Kumar",
        avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
        headline: "Cloud Native Developer & Kubernetes Contributor | IIT Madras",
        college: "IIT Madras",
        location: "Chennai, India",
        orbixScore: 1540,
        totalSolved: 295,
        totalContests: 13,
        streak: 9,
        isVerifiedCoder: true,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: false,
        skills: ["Go", "Kubernetes", "gRPC", "Terraform", "Prometheus"],
        connectedPortals: [
            { portal: "leetcode", portalUsername: "aravind_k", verified: true },
            { portal: "github", portalUsername: "aravindk", verified: true },
        ],
    },
    {
        id: "rec-dev-9",
        username: "chloe_dupont",
        displayName: "Chloé Dupont",
        firstName: "Chloé",
        lastName: "Dupont",
        avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80",
        headline: "Full Stack Engineer & WebAssembly Tinkerer | Sorbonne",
        college: "Sorbonne University",
        location: "Paris, France",
        orbixScore: 1480,
        totalSolved: 280,
        totalContests: 12,
        streak: 5,
        isVerifiedCoder: false,
        isOpenToWork: true,
        isHireable: true,
        isPublic: true,
        hasResume: true,
        skills: ["TypeScript", "Rust", "WebAssembly", "Next.js", "GraphQL"],
        connectedPortals: [
            { portal: "leetcode", portalUsername: "chloe_d", verified: true },
            { portal: "github", portalUsername: "chloedupont", verified: true },
        ],
    },
    {
        id: "rec-dev-10",
        username: "tariq_almansoor",
        displayName: "Tariq Al-Mansoor",
        firstName: "Tariq",
        lastName: "Al-Mansoor",
        avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80",
        headline: "Security Analyst & Systems Programmer | KAUST",
        college: "KAUST",
        location: "Thuwal, Saudi Arabia",
        orbixScore: 1420,
        totalSolved: 265,
        totalContests: 11,
        streak: 8,
        isVerifiedCoder: true,
        isOpenToWork: false,
        isHireable: true,
        isPublic: true,
        hasResume: false,
        skills: ["C", "Assembly", "Python", "Linux Kernel", "Reverse Eng"],
        connectedPortals: [
            { portal: "codeforces", portalUsername: "tariq_m", verified: true },
            { portal: "github", portalUsername: "tariqalmansoor", verified: true },
        ],
    },
];

interface RecentDevelopersCarouselProps {
    currentUsername: string;
    onSelectCandidate: (username: string) => void;
    onConnect: (candidate: ExploreDeveloper) => Promise<void>;
    actionInProgressId: string | null;
    renderCardActionMenu: (
        menuKey: string,
        target: {
            userId: string;
            username: string;
            displayName: string;
            avatarUrl?: string | null;
            headline?: string | null;
        }
    ) => React.ReactNode;
    fallbackDevelopers?: ExploreDeveloper[];
}

export const RecentDevelopersCarousel: React.FC<RecentDevelopersCarouselProps> = ({
    currentUsername,
    onSelectCandidate,
    onConnect,
    actionInProgressId,
    renderCardActionMenu,
    fallbackDevelopers = [],
}) => {
    // Generate guaranteed baseline list from props fallback or DEFAULT_RECENT_DEVELOPERS
    const initialCandidates = useMemo(() => {
        const pool = fallbackDevelopers.length > 0 ? fallbackDevelopers : DEFAULT_RECENT_DEVELOPERS;
        return pool
            .filter((d) => d.username.toLowerCase() !== currentUsername.toLowerCase())
            .slice(0, 10);
    }, [fallbackDevelopers, currentUsername]);

    const [developers, setDevelopers] = useState<ExploreDeveloper[]>(initialCandidates);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [requestedUsernames, setRequestedUsernames] = useState<Set<string>>(new Set());

    // Responsive detection: Desktop (>= 768px / md) shows 2 cards per slide; Mobile (< 768px) shows 1 card per slide
    const [isDesktop, setIsDesktop] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            return window.innerWidth >= 768;
        }
        return true;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(min-width: 768px)");
        const onChange = (e: MediaQueryListEvent) => {
            setIsDesktop(e.matches);
        };
        setIsDesktop(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    // Track previous isDesktop to seamlessly map carousel index across resize
    const prevIsDesktopRef = useRef(isDesktop);
    const cardsPerPage = isDesktop ? 2 : 1;
    const totalPages = Math.max(1, Math.ceil(developers.length / cardsPerPage));
    const activeIndex = Math.min(currentIndex, totalPages - 1);

    useEffect(() => {
        if (prevIsDesktopRef.current !== isDesktop) {
            if (isDesktop) {
                // Mobile -> Desktop: convert single index to pair index
                setCurrentIndex((prev) => Math.floor(prev / 2));
            } else {
                // Desktop -> Mobile: convert pair index to single dev index
                setCurrentIndex((prev) => Math.min(prev * 2, Math.max(0, developers.length - 1)));
            }
            prevIsDesktopRef.current = isDesktop;
        }
    }, [isDesktop, developers.length]);

    // Update candidates if fallback pool or currentUsername changes
    useEffect(() => {
        const pool = fallbackDevelopers.length > 0 ? fallbackDevelopers : DEFAULT_RECENT_DEVELOPERS;
        const filtered = pool
            .filter((d) => d.username.toLowerCase() !== currentUsername.toLowerCase())
            .slice(0, 10);
        if (filtered.length > 0) {
            setDevelopers(filtered);
            setCurrentIndex(0);
        }
    }, [currentUsername, fallbackDevelopers]);

    // Fetch up to 10 recent developers excluding current candidate and authenticated user
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        async function loadRecent() {
            try {
                const res = await fetchExploreProfiles({
                    sortBy: "recent",
                    limit: 10,
                    excludeUsername: currentUsername,
                }, controller.signal);
                if (isMounted && res.success && Array.isArray(res.users) && res.users.length > 0) {
                    setDevelopers(res.users);
                    setCurrentIndex(0);
                }
            } catch (err) {
                if (!controller.signal.aborted) console.error("Failed to fetch recent active developers:", err);
            }
        }
        loadRecent();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [currentUsername]);

    const handleNext = useCallback(() => {
        if (totalPages <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % totalPages);
    }, [totalPages]);

    const handlePrev = useCallback(() => {
        if (totalPages <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
    }, [totalPages]);

    // 4-second auto-advancing carousel
    useEffect(() => {
        if (isPaused || totalPages <= 1) return;

        const interval = setInterval(() => {
            handleNext();
        }, 4000);

        return () => clearInterval(interval);
    }, [isPaused, totalPages, handleNext]);

    // Mobile touch gestures: tap pauses, swipe left/right navigates
    const touchStartX = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsPaused(true);
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setIsPaused(false);
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        const SWIPE_THRESHOLD = 45;
        if (diff > SWIPE_THRESHOLD) {
            handleNext();
        } else if (diff < -SWIPE_THRESHOLD) {
            handlePrev();
        }
        touchStartX.current = null;
    };

    const handleLocalConnect = async (candidate: ExploreDeveloper) => {
        setRequestedUsernames((prev) => new Set(prev).add(candidate.username));
        try {
            await onConnect(candidate);
        } catch {
            setRequestedUsernames((prev) => {
                const updated = new Set(prev);
                updated.delete(candidate.username);
                return updated;
            });
        }
    };

    const handleSelect = (username: string) => {
        onSelectCandidate(username);
        window.scrollTo({ top: 0, behavior: "smooth" });
        const mainEl = document.querySelector("main");
        if (mainEl) {
            mainEl.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    if (developers.length === 0) {
        return null;
    }

    // Visible cards: exactly 1 on mobile, 2 confronting cards on desktop
    const startIndex = activeIndex * cardsPerPage;
    const currentCards = developers.slice(startIndex, startIndex + cardsPerPage);

    return (
        <section
            aria-label="Recently Active Developers Carousel"
            className="space-y-3.5 sm:space-y-4 transition-all"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Carousel Body: Flanked by Side Buttons on Desktop, Full-Width on Mobile */}
            <div className="relative flex items-center gap-2  mt-[50px]gap-4 sm:mt-[100px]">
                {/* Left Moving Button (Desktop md+ only; hidden on mobile to give card 100% width) */}
                <button
                    type="button"
                    onClick={handlePrev}
                    disabled={totalPages <= 1}
                    className="hidden md:flex shrink-0 p-2 sm:p-3 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FFE566] hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10 items-center justify-center"
                    title="Previous Developers"
                    aria-label="Previous Developers"
                >
                    <ChevronLeft className="w-5 h-5 stroke-[3] text-black" />
                </button>

                {/* Cards Container: 1 full-width card on mobile (< md), 2 confronting cards on desktop (md+) */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                    {currentCards.map((candidate) => {
                        const avatar =
                            candidate.photoUrl && candidate.photoUrl !== DEFAULT_AVATAR_URL
                                ? candidate.photoUrl
                                : candidate.avatarUrl || candidate.photoUrl || DEFAULT_AVATAR_URL;

                        const isConnecting = actionInProgressId === (candidate.id || candidate.username);
                        const isRequested =
                            requestedUsernames.has(candidate.username) ||
                            candidate.relationshipState === "outgoing_pending";

                        return (
                            <article
                                key={candidate.id || candidate.username}
                                className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between overflow-hidden group animate-in fade-in duration-300 w-full min-w-0"
                            >
                                <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4">
                                    {/* Top Row: Enlarged Avatar + Name + Verification + Score */}
                                    <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
                                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                            <div className="relative shrink-0">
                                                <EnlargeableAvatar
                                                    src={avatar}
                                                    alt={candidate.displayName}
                                                    displayName={candidate.displayName}
                                                    username={candidate.username}
                                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-black shadow-[2.5px_2.5px_0px_#000]"
                                                />
                                                {candidate.isOpenToWork && (
                                                    <span
                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400 rounded-full border-2 border-black"
                                                        title="Open to Work"
                                                    />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <h3 className="font-black text-sm sm:text-base text-black tracking-tight truncate group-hover:text-emerald-700 transition-colors">
                                                        {candidate.displayName}
                                                    </h3>
                                                    {Boolean(candidate.isVerifiedCoder) && (
                                                        <span title="Verified Developer (Email OTP Verified)" className="shrink-0">
                                                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                                                    @{candidate.username}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Score Pill & 3-Dot Menu */}
                                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
                                                <Trophy className="w-3 h-3 shrink-0" />
                                                <span>{candidate.orbixScore.toLocaleString()}</span>
                                            </span>
                                            {renderCardActionMenu(`recent-${candidate.id || candidate.username}`, {
                                                userId: candidate.id || candidate.username,
                                                username: candidate.username,
                                                displayName: candidate.displayName,
                                                avatarUrl: candidate.avatarUrl || candidate.photoUrl || null,
                                                headline: candidate.headline || null,
                                            })}
                                        </div>
                                    </div>

                                    {/* Headline */}
                                    {candidate.headline ? (
                                        <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed break-words">
                                            {candidate.headline}
                                        </p>
                                    ) : (
                                        <p className="text-xs font-medium text-neutral-500 italic">
                                            Verified Orbix Engineer
                                        </p>
                                    )}

                                    {/* Meta: College & Location */}
                                    <div className="space-y-1 text-[11px] font-bold text-neutral-600">
                                        {candidate.college && (
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <GraduationCap className="w-3.5 h-3.5 text-black shrink-0" />
                                                <span className="truncate">{candidate.college}</span>
                                            </div>
                                        )}
                                        {candidate.location && (
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                                                <span className="truncate">{candidate.location}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Skills Badges */}
                                    {candidate.skills && candidate.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {candidate.skills.slice(0, 3).map((skill, sIdx) => (
                                                <span
                                                    key={sIdx}
                                                    className="px-2 py-0.5 rounded-lg bg-[#FAF6EE] border border-black text-[11px] font-mono font-bold text-black"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {candidate.skills.length > 3 && (
                                                <span className="px-1.5 py-0.5 rounded-lg bg-neutral-100 border border-black/30 text-[10px] font-mono font-bold text-neutral-500">
                                                    +{candidate.skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Connected Portals Icons */}
                                    {candidate.connectedPortals.length > 0 && (
                                        <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-mono font-bold text-neutral-600 flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {candidate.connectedPortals.map((p, pIdx) => {
                                                    const icon = getPlatformIcon(p.portal, "w-4 h-4");
                                                    return (
                                                        <span
                                                            key={pIdx}
                                                            title={`${p.portal}: @${p.portalUsername} (${p.verified ? "Verified" : "Unverified"})`}
                                                            className="p-1 rounded bg-[#FAF6EE] border border-black shrink-0"
                                                        >
                                                            {icon}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {candidate.totalSolved > 0 && (
                                                <span className="text-black font-black shrink-0">
                                                    {candidate.totalSolved} Solved
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action Footer: Connect & In-Place Inspection */}
                                <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex items-center gap-2">
                                    {isRequested ? (
                                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black text-xs text-neutral-600 shadow-[1.5px_1.5px_0px_#000] shrink-0 min-h-[34px]">
                                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                            <span>Requested</span>
                                        </span>
                                    ) : (
                                        <div className="shrink-0">
                                            <OrbixButton
                                                size="sm"
                                                variant="yellow"
                                                icon={<UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />}
                                                loading={isConnecting}
                                                loadingLabel="Connecting..."
                                                onClick={() => handleLocalConnect(candidate)}
                                                title={`Send connection request to ${candidate.displayName}`}
                                            >
                                                Connect
                                            </OrbixButton>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleSelect(candidate.username)}
                                        className="flex-1 min-w-0 py-2 px-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform hover:translate-x-[1px] whitespace-nowrap min-h-[34px]"
                                    >
                                        <span className="truncate">View Profile</span>
                                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {/* Right Moving Button (Desktop md+ only; hidden on mobile to give card 100% width) */}
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={totalPages <= 1}
                    className="hidden md:flex shrink-0 p-2 sm:p-3 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FFE566] hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10 items-center justify-center"
                    title="Next Developers"
                    aria-label="Next Developers"
                >
                    <ChevronRight className="w-5 h-5 stroke-[3] text-black" />
                </button>
            </div>

            {/* Centered Pagination Blocks at the very bottom */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3 pt-2">
                {/* Mobile Previous Developer Button (visible on mobile where side arrows are hidden) */}
                <button
                    type="button"
                    onClick={handlePrev}
                    disabled={totalPages <= 1}
                    className="flex md:hidden shrink-0 p-2 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFE566] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed items-center justify-center"
                    title="Previous Developer"
                    aria-label="Previous Developer"
                >
                    <ChevronLeft className="w-4 h-4 stroke-[3] text-black" />
                </button>

                {/* Slide indicator dots */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalPages }).map((_, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setCurrentIndex(idx)}
                                className={`h-2 transition-all rounded-full border border-black cursor-pointer ${idx === activeIndex
                                    ? "w-6 bg-black"
                                    : "w-2 bg-neutral-300 hover:bg-neutral-400"
                                    }`}
                                title={`Go to slide ${idx + 1}`}
                                aria-label={`Slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}

                {/* Position Counter Pill */}
                <span className="text-xs font-mono font-black text-neutral-700 bg-white px-2.5 py-1 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                    {activeIndex + 1} / {totalPages}
                </span>

                {/* Mobile Next Developer Button (visible on mobile where side arrows are hidden) */}
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={totalPages <= 1}
                    className="flex md:hidden shrink-0 p-2 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFE566] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed items-center justify-center"
                    title="Next Developer"
                    aria-label="Next Developer"
                >
                    <ChevronRight className="w-4 h-4 stroke-[3] text-black" />
                </button>
            </div>
        </section>
    );
};
