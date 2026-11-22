import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, Users, Award, Sparkles, X } from "lucide-react";
import { OrbixLogo } from "../../../../components/OrbixLogo";
import { useVisibleMotion } from "../../../../hooks/useVisibleMotion";

export interface ClubEcosystemItem {
    id: string;
    name: string;
    category: string;
    brandColor: string;
    ring: "inner" | "outer";
    angleDeg: number;
    description: string;
    renderIcon: (className?: string) => React.ReactNode;
}

// Complete set of 20 Club Ecosystem Modules
export const CLUB_ECOSYSTEM_MODULES: ClubEcosystemItem[] = [
    // -------------------------------------------------------------
    // INNER ORBIT RING (6 Core Pillars - 60° apart)
    // -------------------------------------------------------------
    {
        id: "events",
        name: "Events & Hackathons",
        category: "Campus Events & Meetups",
        brandColor: "#FF5722",
        ring: "inner",
        angleDeg: 270, // Top center (12 o'clock)
        description: "Host workshops, hackathons, and orientations with RSVP tracking, attendee limits, and automated calendar reminders.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <polygon points="12 13 13.5 16 16.5 16.5 14.25 18.75 14.75 22 12 20.25 9.25 22 9.75 18.75 7.5 16.5 10.5 16 12 13" fill="#FF5722" stroke="none" />
            </svg>
        ),
    },
    {
        id: "certificates",
        name: "Verifiable Certificates",
        category: "Digital Credential Studio",
        brandColor: "#10B981",
        ring: "inner",
        angleDeg: 330, // Top right (2 o'clock)
        description: "Issue cryptographically verifiable certificates with custom designs, batch PDF generation, and permanent QR verification.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                <path d="m9 8 2 2 4-4" />
            </svg>
        ),
    },
    {
        id: "community",
        name: "Campus Community",
        category: "Student Member Hub",
        brandColor: "#6366F1",
        ring: "inner",
        angleDeg: 30, // Bottom right (4 o'clock)
        description: "Unite active students across departments. Build your member directory, track contributions, and spark peer collaborations.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        id: "colleges",
        name: "College Chapters",
        category: "University Affiliation",
        brandColor: "#3B82F6",
        ring: "inner",
        angleDeg: 90, // Bottom center (6 o'clock)
        description: "Directly affiliate with your campus institution, verify student status, and organize multi-college inter-campus fests.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
        ),
    },
    {
        id: "emails",
        name: "Email Outreach",
        category: "Broadcast & Newsletters",
        brandColor: "#EC4899",
        ring: "inner",
        angleDeg: 150, // Bottom left (8 o'clock)
        description: "Deliver newsletters, event reminders, and emergency venue updates straight to member inboxes with zero spam folder risk.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
        ),
    },
    {
        id: "notifications",
        name: "Live Notifications",
        category: "Push & Real-time Alerts",
        brandColor: "#F59E0B",
        ring: "inner",
        angleDeg: 210, // Top left (10 o'clock)
        description: "Instant push alerts for ticket release dates, round deadlines, certificate availability, and team announcements.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                <circle cx="18" cy="4" r="2.5" fill="#F59E0B" stroke="#000" strokeWidth="1" />
            </svg>
        ),
    },

    // -------------------------------------------------------------
    // OUTER ORBIT RING (14 Campus Features - Evenly Spaced around 360°)
    // -------------------------------------------------------------
    {
        id: "qr-passes",
        name: "QR Entry Passes",
        category: "Check-in & Scanning",
        brandColor: "#06B6D4",
        ring: "outer",
        angleDeg: 270, // Top center (12 o'clock)
        description: "Frictionless event check-in: scan attendee QR tickets on mobile cameras in under 2 seconds with live capacity counts.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1" />
                <rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" />
                <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" />
                <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                <path d="M3 12h.01" />
                <path d="M12 3h.01" />
                <path d="M12 16v.01" />
                <path d="M16 12h1" />
                <path d="M21 12v.01" />
                <path d="M12 21v-1" />
            </svg>
        ),
    },
    {
        id: "team-leads",
        name: "Executive Roles",
        category: "Team & Permissions",
        brandColor: "#8B5CF6",
        ring: "outer",
        angleDeg: 295.7,
        description: "Granular roles for presidents, tech leads, PR managers, and volunteers with controlled workspace permissions.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
        ),
    },
    {
        id: "announcements",
        name: "Campus Feed",
        category: "Official Updates",
        brandColor: "#E11D48",
        ring: "outer",
        angleDeg: 321.4,
        description: "Publish rich-media club announcements, recap articles, and project showcases on a distraction-free campus feed.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 11 18-5v12L3 14v-3z" />
                <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
        ),
    },
    {
        id: "recruitment",
        name: "Core Recruitment",
        category: "Applications & Forms",
        brandColor: "#14B8A6",
        ring: "outer",
        angleDeg: 347.1,
        description: "Ditch unstructured Google Sheets: run recruitment cycles, collect portfolios, review candidates, and assign roles seamlessly.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M12 11h4" />
                <path d="M12 16h4" />
                <path d="m8 11 .01 0" />
                <path d="m8 16 .01 0" />
            </svg>
        ),
    },
    {
        id: "sponsors",
        name: "Sponsor Hub",
        category: "Brand Partnerships",
        brandColor: "#D97706",
        ring: "outer",
        angleDeg: 12.9,
        description: "Showcase partners on event pages and digital passes with click-through tracking and branded sponsor booths.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12l4 6-10 13L2 9Z" />
                <path d="M11 3 8 9l4 13 4-13-3-6" />
                <path d="M2 9h20" />
            </svg>
        ),
    },
    {
        id: "analytics",
        name: "Turnout Analytics",
        category: "Club Intelligence",
        brandColor: "#2563EB",
        ring: "outer",
        angleDeg: 38.6,
        description: "Monitor registration spikes, drop-off rates, attendee retention, and year-over-year club growth at a glance.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
                <path d="m3 12 6-6 4 4 8-8" />
            </svg>
        ),
    },
    {
        id: "workshops",
        name: "Hands-on Workshops",
        category: "Technical Bootcamps",
        brandColor: "#7C3AED",
        ring: "outer",
        angleDeg: 64.3,
        description: "Host hands-on bootcamps, code walkthroughs, and technical tracks with shared repo links and slides.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="12" x="3" y="4" rx="2" />
                <line x1="2" y1="20" x2="22" y2="20" />
                <path d="m9 10-2 2 2 2" />
                <path d="m15 10 2 2-2 2" />
            </svg>
        ),
    },
    {
        id: "badges",
        name: "Merit Badges",
        category: "Member Recognition",
        brandColor: "#F97316",
        ring: "outer",
        angleDeg: 90.0,
        description: "Award collectible digital badges to hackathon winners, workshop leads, and top contributors to display on their Orbix profiles.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15l-3 6 4-2 4 2-3-6" />
                <circle cx="12" cy="8" r="6" />
                <polygon points="12 5 13 7.5 15.5 7.5 13.5 9 14.5 11.5 12 10 9.5 11.5 10.5 9 8.5 7.5 11 7.5 12 5" fill="#F97316" stroke="none" />
            </svg>
        ),
    },
    {
        id: "feedback",
        name: "Automated Feedback",
        category: "Post-Event Surveys",
        brandColor: "#059669",
        ring: "outer",
        angleDeg: 115.7,
        description: "Gather NPS scores, session ratings, and speaker feedback automatically right after events conclude.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M12 7v6" />
                <path d="M12 17h.01" />
            </svg>
        ),
    },
    {
        id: "leaderboards",
        name: "Club Leaderboard",
        category: "Campus Ranking",
        brandColor: "#EA580C",
        ring: "outer",
        angleDeg: 141.4,
        description: "Showcase top student contributors, hackathon stars, and active organizers on transparent university leaderboards.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
        ),
    },
    {
        id: "discussions",
        name: "Topic Channels",
        category: "Campus Collaborations",
        brandColor: "#0284C7",
        ring: "outer",
        angleDeg: 167.1,
        description: "Focused technical channels for hackathon teaming, dev discussion, AMA sessions, and project brainstorming.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
            </svg>
        ),
    },
    {
        id: "ticketing",
        name: "RSVP & Ticketing",
        category: "Access & Registrations",
        brandColor: "#9333EA",
        ring: "outer",
        angleDeg: 192.9,
        description: "Configure multi-tier ticket registration, team registrations, waitlists, and instant confirmation passes.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#9333EA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v2" />
                <path d="M13 17v2" />
                <path d="M13 11v2" />
            </svg>
        ),
    },
    {
        id: "finances",
        name: "Budget & Invoicing",
        category: "Club Operations",
        brandColor: "#16A34A",
        ring: "outer",
        angleDeg: 218.6,
        description: "Organize prize budgets, merchandise receipts, and sponsorship grants in one structured audit trail.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <circle cx="7" cy="15" r="1" fill="#16A34A" />
            </svg>
        ),
    },
    {
        id: "verified-org",
        name: "Verified Club Badge",
        category: "Official Status",
        brandColor: "#000000",
        ring: "outer",
        angleDeg: 244.3,
        description: "Gain the official Orbix verified club crest to assure students, sponsors, and faculty of authentic leadership.",
        renderIcon: (className = "w-8 h-8") => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
            </svg>
        ),
    },
];

export interface ClubEcosystemShowcaseProps {
    title?: string;
    subtitle?: string;
    showHeading?: boolean;
    className?: string;
    onItemClick?: (itemId: string) => void;
}

interface CanvasConfig {
    canvasSize: number;
    outerRadius: number;
    innerRadius: number;
    centerSize: number;
    centerLogoSize: number;
    outerBadgeSize: number;
    innerBadgeSize: number;
    outerIconClass: string;
    innerIconClass: string;
    badgeRadius: string;
    trackStrokeWidth: number;
    dashStrokeWidth: number;
    dashArray: string;
    trackOpacity: number;
    dashOpacity: number;
    isMobile: boolean;
}

const getCanvasConfig = (width: number): CanvasConfig => {
    if (width < 380) {
        const canvasSize = Math.max(296, Math.min(340, width - 20));
        return {
            canvasSize,
            outerRadius: 132,
            innerRadius: 76,
            centerSize: 66,
            centerLogoSize: 34,
            outerBadgeSize: 36,
            innerBadgeSize: 40,
            outerIconClass: "w-5 h-5 flex-shrink-0",
            innerIconClass: "w-5 h-5 flex-shrink-0",
            badgeRadius: "12px",
            trackStrokeWidth: 1.6,
            dashStrokeWidth: 2.4,
            dashArray: "5 7",
            trackOpacity: 0.22,
            dashOpacity: 0.85,
            isMobile: true,
        };
    }
    if (width < 480) {
        const canvasSize = Math.min(390, width - 24);
        return {
            canvasSize,
            outerRadius: 154,
            innerRadius: 88,
            centerSize: 76,
            centerLogoSize: 38,
            outerBadgeSize: 40,
            innerBadgeSize: 44,
            outerIconClass: "w-5 h-5 flex-shrink-0",
            innerIconClass: "w-6 h-6 flex-shrink-0",
            badgeRadius: "14px",
            trackStrokeWidth: 1.8,
            dashStrokeWidth: 2.5,
            dashArray: "5 7",
            trackOpacity: 0.22,
            dashOpacity: 0.85,
            isMobile: true,
        };
    }
    if (width < 640) {
        const canvasSize = Math.min(480, width - 32);
        return {
            canvasSize,
            outerRadius: 195,
            innerRadius: 110,
            centerSize: 88,
            centerLogoSize: 44,
            outerBadgeSize: 46,
            innerBadgeSize: 50,
            outerIconClass: "w-6 h-6 flex-shrink-0",
            innerIconClass: "w-6 h-6 flex-shrink-0",
            badgeRadius: "16px",
            trackStrokeWidth: 1.8,
            dashStrokeWidth: 2.5,
            dashArray: "6 8",
            trackOpacity: 0.20,
            dashOpacity: 0.80,
            isMobile: true,
        };
    }
    if (width < 768) {
        const canvasSize = Math.min(580, width - 40);
        return {
            canvasSize,
            outerRadius: 235,
            innerRadius: 130,
            centerSize: 100,
            centerLogoSize: 52,
            outerBadgeSize: 50,
            innerBadgeSize: 54,
            outerIconClass: "w-6 h-6 flex-shrink-0",
            innerIconClass: "w-7 h-7 flex-shrink-0",
            badgeRadius: "18px",
            trackStrokeWidth: 2.0,
            dashStrokeWidth: 2.6,
            dashArray: "6 8",
            trackOpacity: 0.18,
            dashOpacity: 0.75,
            isMobile: false,
        };
    }
    if (width < 1024) {
        const canvasSize = Math.min(740, width - 48);
        return {
            canvasSize,
            outerRadius: 300,
            innerRadius: 165,
            centerSize: 116,
            centerLogoSize: 62,
            outerBadgeSize: 58,
            innerBadgeSize: 62,
            outerIconClass: "w-7 h-7 flex-shrink-0",
            innerIconClass: "w-8 h-8 flex-shrink-0",
            badgeRadius: "20px",
            trackStrokeWidth: 2.0,
            dashStrokeWidth: 2.6,
            dashArray: "6 8",
            trackOpacity: 0.18,
            dashOpacity: 0.70,
            isMobile: false,
        };
    }
    if (width < 1280) {
        const canvasSize = Math.min(880, width - 64);
        return {
            canvasSize,
            outerRadius: 360,
            innerRadius: 195,
            centerSize: 130,
            centerLogoSize: 70,
            outerBadgeSize: 64,
            innerBadgeSize: 68,
            outerIconClass: "w-8 h-8 flex-shrink-0",
            innerIconClass: "w-8 h-8 flex-shrink-0",
            badgeRadius: "22px",
            trackStrokeWidth: 2.0,
            dashStrokeWidth: 2.6,
            dashArray: "6 8",
            trackOpacity: 0.18,
            dashOpacity: 0.70,
            isMobile: false,
        };
    }
    return {
        canvasSize: 980,
        outerRadius: 405,
        innerRadius: 220,
        centerSize: 144,
        centerLogoSize: 78,
        outerBadgeSize: 70,
        innerBadgeSize: 74,
        outerIconClass: "w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0",
        innerIconClass: "w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0",
        badgeRadius: "24px",
        trackStrokeWidth: 2.2,
        dashStrokeWidth: 2.8,
        dashArray: "6 8",
        trackOpacity: 0.18,
        dashOpacity: 0.70,
        isMobile: false,
    };
};

const getItemLaserColor = (brandColor: string | undefined): string => {
    if (!brandColor) return "#000000";
    const normalized = brandColor.trim().toLowerCase();
    if (
        normalized === "#ffffff" ||
        normalized === "#fff" ||
        normalized === "white" ||
        normalized === "#faf6ee" ||
        normalized === "transparent"
    ) {
        return "#000000";
    }
    return brandColor;
};

export const ClubEcosystemShowcase: React.FC<ClubEcosystemShowcaseProps> = ({
    title = "Run your entire club. All in one place.",
    subtitle = "Events, team, and certificates in one place — free to start. No more Google Forms, WhatsApp chaos, and Canva certificates.",
    showHeading = true,
    className = "",
    onItemClick,
}) => {
    const sectionRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const motionActive = useVisibleMotion(sectionRef);

    const [hoveredItem, setHoveredItem] = useState<ClubEcosystemItem | null>(null);
    const [selectedItem, setSelectedItem] = useState<ClubEcosystemItem | null>(null);
    const [isCenterHovered, setIsCenterHovered] = useState(false);

    const activeItem = hoveredItem || selectedItem;

    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1440
    );

    useEffect(() => {
        let resizeTimer: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                setViewportWidth(window.innerWidth);
            }, 60);
        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            clearTimeout(resizeTimer);
        };
    }, []);

    const canvasConfig = useMemo(() => getCanvasConfig(viewportWidth), [viewportWidth]);

    const innerModules = useMemo(() => CLUB_ECOSYSTEM_MODULES.filter((p) => p.ring === "inner"), []);
    const outerModules = useMemo(() => CLUB_ECOSYSTEM_MODULES.filter((p) => p.ring === "outer"), []);

    const outerAngleRef = useRef(0);
    const innerAngleRef = useRef(0);
    const momentumRef = useRef(0);
    const isDraggingRef = useRef(false);
    const lastTouchAngleRef = useRef(0);
    const touchStartPosRef = useRef({ x: 0, y: 0, time: 0 });
    const hasDraggedRef = useRef(false);

    useEffect(() => {
        if (!motionActive) return;
        let animId: number;
        let previousTime = 0;
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        canvasEl.style.setProperty("--outer-rot", `${outerAngleRef.current}deg`);
        canvasEl.style.setProperty("--outer-counter-rot", `${-outerAngleRef.current}deg`);
        canvasEl.style.setProperty("--inner-rot", `${innerAngleRef.current}deg`);
        canvasEl.style.setProperty("--inner-counter-rot", `${-innerAngleRef.current}deg`);

        const update = (time: number) => {
            const step = previousTime ? Math.min((time - previousTime) / (1000 / 60), 3) : 1;
            previousTime = time;

            if (!isDraggingRef.current) {
                outerAngleRef.current += (0.032 + momentumRef.current * 0.55) * step;
                innerAngleRef.current -= (0.048 + momentumRef.current * 0.82) * step;
                momentumRef.current *= Math.pow(0.93, step);

                if (Math.abs(momentumRef.current) < 0.001) {
                    momentumRef.current = 0;
                }
            }

            canvasEl.style.setProperty("--outer-rot", `${outerAngleRef.current}deg`);
            canvasEl.style.setProperty("--outer-counter-rot", `${-outerAngleRef.current}deg`);
            canvasEl.style.setProperty("--inner-rot", `${innerAngleRef.current}deg`);
            canvasEl.style.setProperty("--inner-counter-rot", `${-innerAngleRef.current}deg`);

            animId = requestAnimationFrame(update);
        };

        animId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animId);
    }, [motionActive]);

    useEffect(() => {
        if (!motionActive) return;
        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            const currentY = window.scrollY;
            const delta = currentY - lastScrollY;
            lastScrollY = currentY;

            const clampedDelta = Math.max(-35, Math.min(35, delta));
            momentumRef.current += clampedDelta * 0.04;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [motionActive]);

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY || e.deltaX;
        const clampedDelta = Math.max(-45, Math.min(45, delta));
        momentumRef.current += clampedDelta * 0.038;
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const rect = canvasEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI);

        lastTouchAngleRef.current = currentAngle;
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        hasDraggedRef.current = false;
        isDraggingRef.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const distMoved = Math.hypot(
            touch.clientX - touchStartPosRef.current.x,
            touch.clientY - touchStartPosRef.current.y
        );
        if (distMoved > 8) {
            hasDraggedRef.current = true;
        }

        const rect = canvasEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI);

        let delta = currentAngle - lastTouchAngleRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        lastTouchAngleRef.current = currentAngle;
        outerAngleRef.current += delta;
        innerAngleRef.current -= delta * 1.35;
        momentumRef.current = delta * 0.72;
    };

    const handleTouchEnd = () => {
        isDraggingRef.current = false;
    };

    const handleItemSelect = useCallback(
        (item: ClubEcosystemItem) => {
            if (hasDraggedRef.current) return;
            setSelectedItem((prev) => (prev?.id === item.id ? null : item));
            onItemClick?.(item.id);
        },
        [onItemClick]
    );

    return (
        <section
            ref={sectionRef}
            onWheel={handleWheel}
            className={`relative w-full py-16 sm:py-20 px-3 sm:px-6 lg:px-8 bg-[#FAF6EE] text-neutral-900 overflow-hidden select-none flex flex-col items-center justify-center ${className}`}
        >
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Section Header */}
            {showHeading && (
                <div className="w-full max-w-7xl mx-auto mb-10 sm:mb-16 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                        {/* Left Column: Headline, Subtitle & Redirections */}
                        <div className="lg:col-span-6 space-y-5 sm:space-y-6">
                            <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-black tracking-tight leading-[1.08]">
                                {title.includes("All in one place") || title.includes("entire club") ? (
                                    <>
                                        Run your entire club.
                                        <br />
                                        <span className="inline-block mt-2 sm:mt-3 bg-[#FFE566] text-black px-4 sm:px-8 py-1 sm:py-2.5 rounded-2xl font-black -rotate-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                                            All in one place.
                                        </span>
                                    </>
                                ) : (
                                    title
                                )}
                            </h2>

                            <p className="text-neutral-700 font-medium text-sm sm:text-lg md:text-xl max-w-xl leading-relaxed">
                                {subtitle}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
                                <Link
                                    to="/club/register"
                                    className="inline-flex items-center gap-2 text-sm sm:text-lg font-black text-black hover:text-neutral-800 transition-colors group cursor-pointer"
                                    title="Register your campus club"
                                >
                                    <span className="underline decoration-4 underline-offset-4 decoration-[#FFE566] group-hover:decoration-black">
                                        Register your club
                                    </span>
                                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-black group-hover:translate-x-1.5 transition-transform stroke-[2.5]" />
                                </Link>

                                <span className="text-black/30 hidden sm:inline">•</span>

                                <Link
                                    to="/docs"
                                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-black transition-colors"
                                    title="Club Documentation"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Club Workspace Docs →</span>
                                </Link>
                            </div>
                        </div>

                        {/* Right Column: 3 Feature Cards solving user's pain points */}
                        <div className="lg:col-span-6 space-y-3 sm:space-y-4">
                            {/* Card 1: Google Forms replacement */}
                            <div className="p-3.5 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] sm:shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] transition-all">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                        <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                                        <h3 className="text-sm sm:text-lg font-black text-black tracking-tight">
                                            No More Google Forms
                                        </h3>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                            Host workshops, hackathons, and orientations with RSVP tracking, attendee limits, and instant QR entry passes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: WhatsApp chaos replacement */}
                            <div className="p-3.5 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] sm:shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] transition-all">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                                        <h3 className="text-sm sm:text-lg font-black text-black tracking-tight">
                                            No More WhatsApp Chaos
                                        </h3>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                            Manage your core executive team, assign permissions, broadcast official updates, and deliver batch email reminders directly to members.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Canva certificates replacement */}
                            <div className="p-3.5 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] sm:shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] transition-all">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                        <Award className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                                        <h3 className="text-sm sm:text-lg font-black text-black tracking-tight">
                                            No More Canva Certificates
                                        </h3>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                            Generate and issue cryptographically verifiable certificates in seconds with instant PDF rendering, dynamic student details, and fraud-proof verification links.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RESPONSIVE CELESTIAL ORBIT CANVAS */}
            <div className="w-full flex items-center justify-center overflow-visible my-2 sm:my-6">
                <div
                    ref={canvasRef}
                    className="relative flex items-center justify-center select-none"
                    style={{
                        width: canvasConfig.canvasSize,
                        height: canvasConfig.canvasSize,
                        touchAction: "pan-y",
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                >
                    {/* SVG Guide Tracks & Dashed Orbits */}
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`-${canvasConfig.canvasSize / 2} -${canvasConfig.canvasSize / 2} ${canvasConfig.canvasSize} ${canvasConfig.canvasSize}`}
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle
                            cx="0"
                            cy="0"
                            r={canvasConfig.outerRadius}
                            stroke="#000000"
                            strokeOpacity={canvasConfig.trackOpacity}
                            strokeWidth={canvasConfig.trackStrokeWidth}
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle
                            cx="0"
                            cy="0"
                            r={canvasConfig.outerRadius}
                            stroke="#000000"
                            strokeOpacity={canvasConfig.dashOpacity}
                            strokeWidth={canvasConfig.dashStrokeWidth}
                            strokeDasharray={canvasConfig.dashArray}
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle
                            cx="0"
                            cy="0"
                            r={canvasConfig.innerRadius}
                            stroke="#000000"
                            strokeOpacity={canvasConfig.trackOpacity}
                            strokeWidth={canvasConfig.trackStrokeWidth}
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle
                            cx="0"
                            cy="0"
                            r={canvasConfig.innerRadius}
                            stroke="#000000"
                            strokeOpacity={canvasConfig.dashOpacity}
                            strokeWidth={canvasConfig.dashStrokeWidth}
                            strokeDasharray={canvasConfig.dashArray}
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                        />

                        {[-canvasConfig.outerRadius, canvasConfig.outerRadius].map((coord, i) => (
                            <React.Fragment key={`outer-dot-${i}`}>
                                <circle cx={coord} cy="0" r={canvasConfig.isMobile ? "2.5" : "3.5"} fill="#000000" fillOpacity="0.45" />
                                <circle cx="0" cy={coord} r={canvasConfig.isMobile ? "2.5" : "3.5"} fill="#000000" fillOpacity="0.45" />
                            </React.Fragment>
                        ))}
                    </svg>

                    {/* LAYER 1: OUTER ORBIT LAYER */}
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                            transform: "rotate(var(--outer-rot, 0deg)) translateZ(0)",
                            willChange: "transform",
                            backfaceVisibility: "hidden",
                        }}
                    >
                        {activeItem && activeItem.ring === "outer" && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox={`-${canvasConfig.canvasSize / 2} -${canvasConfig.canvasSize / 2} ${canvasConfig.canvasSize} ${canvasConfig.canvasSize}`}
                                fill="none"
                            >
                                <line
                                    x1="0"
                                    y1="0"
                                    x2={Math.round(Math.cos((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.outerRadius)}
                                    y2={Math.round(Math.sin((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.outerRadius)}
                                    stroke={getItemLaserColor(activeItem.brandColor)}
                                    strokeWidth="2.5"
                                    strokeDasharray="4 4"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={Math.round(Math.cos((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.outerRadius)}
                                    cy={Math.round(Math.sin((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.outerRadius)}
                                    r="4.5"
                                    fill={getItemLaserColor(activeItem.brandColor)}
                                />
                            </svg>
                        )}

                        {outerModules.map((item) => {
                            const rad = (item.angleDeg * Math.PI) / 180;
                            const x = Math.round(Math.cos(rad) * canvasConfig.outerRadius);
                            const y = Math.round(Math.sin(rad) * canvasConfig.outerRadius);
                            const isActive = activeItem?.id === item.id;

                            return (
                                <div
                                    key={item.id}
                                    className="absolute pointer-events-auto"
                                    style={{
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                    }}
                                    onMouseEnter={() => setHoveredItem(item)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemSelect(item);
                                    }}
                                >
                                    <div
                                        style={{
                                            transform: "rotate(var(--outer-counter-rot, 0deg)) translateZ(0)",
                                            willChange: "transform",
                                            backfaceVisibility: "hidden",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className={`relative bg-white flex items-center justify-center cursor-pointer transition-all duration-200 border-2 border-black ${isActive
                                                ? "shadow-[4px_4px_0px_#000] scale-110 z-30"
                                                : "shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:scale-95"
                                                }`}
                                            style={{
                                                width: canvasConfig.outerBadgeSize,
                                                height: canvasConfig.outerBadgeSize,
                                                borderRadius: canvasConfig.badgeRadius,
                                                outline: isActive ? `3px solid ${getItemLaserColor(item.brandColor)}` : "none",
                                                outlineOffset: "2px",
                                            }}
                                            aria-label={`${item.name} module`}
                                        >
                                            <div className="relative z-10 flex items-center justify-center">
                                                {item.renderIcon(canvasConfig.outerIconClass)}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* LAYER 2: INNER ORBIT LAYER */}
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                            transform: "rotate(var(--inner-rot, 0deg)) translateZ(0)",
                            willChange: "transform",
                            backfaceVisibility: "hidden",
                        }}
                    >
                        {activeItem && activeItem.ring === "inner" && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox={`-${canvasConfig.canvasSize / 2} -${canvasConfig.canvasSize / 2} ${canvasConfig.canvasSize} ${canvasConfig.canvasSize}`}
                                fill="none"
                            >
                                <line
                                    x1="0"
                                    y1="0"
                                    x2={Math.round(Math.cos((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.innerRadius)}
                                    y2={Math.round(Math.sin((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.innerRadius)}
                                    stroke={getItemLaserColor(activeItem.brandColor)}
                                    strokeWidth="2.5"
                                    strokeDasharray="4 4"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={Math.round(Math.cos((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.innerRadius)}
                                    cy={Math.round(Math.sin((activeItem.angleDeg * Math.PI) / 180) * canvasConfig.innerRadius)}
                                    r="4.5"
                                    fill={getItemLaserColor(activeItem.brandColor)}
                                />
                            </svg>
                        )}

                        {innerModules.map((item) => {
                            const rad = (item.angleDeg * Math.PI) / 180;
                            const x = Math.round(Math.cos(rad) * canvasConfig.innerRadius);
                            const y = Math.round(Math.sin(rad) * canvasConfig.innerRadius);
                            const isActive = activeItem?.id === item.id;

                            return (
                                <div
                                    key={item.id}
                                    className="absolute pointer-events-auto"
                                    style={{
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                    }}
                                    onMouseEnter={() => setHoveredItem(item)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemSelect(item);
                                    }}
                                >
                                    <div
                                        style={{
                                            transform: "rotate(var(--inner-counter-rot, 0deg)) translateZ(0)",
                                            willChange: "transform",
                                            backfaceVisibility: "hidden",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className={`relative bg-white flex items-center justify-center cursor-pointer transition-all duration-200 border-2 border-black ${isActive
                                                ? "shadow-[4px_4px_0px_#000] scale-110 z-30"
                                                : "shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:scale-95"
                                                }`}
                                            style={{
                                                width: canvasConfig.innerBadgeSize,
                                                height: canvasConfig.innerBadgeSize,
                                                borderRadius: canvasConfig.badgeRadius,
                                                outline: isActive ? `3px solid ${getItemLaserColor(item.brandColor)}` : "none",
                                                outlineOffset: "2px",
                                            }}
                                            aria-label={`${item.name} module`}
                                        >
                                            <div className="relative z-10 flex items-center justify-center">
                                                {item.renderIcon(canvasConfig.innerIconClass)}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* CENTER HUB: STATIONARY ORBIX AUTONOMOUS CORE */}
                    <div
                        className="relative z-30 flex flex-col items-center justify-center cursor-pointer pointer-events-auto"
                        onMouseEnter={() => setIsCenterHovered(true)}
                        onMouseLeave={() => setIsCenterHovered(false)}
                        onClick={() => setSelectedItem(null)}
                        title="Orbix Campus Club Integration Hub"
                    >
                        <div
                            className={`relative rounded-full bg-[#0c101d] border-2 border-black flex items-center justify-center transition-all duration-300 ${isCenterHovered
                                ? "shadow-[6px_6px_0px_#000] -translate-y-1 scale-105"
                                : "shadow-[4px_4px_0px_#000]"
                                }`}
                            style={{
                                width: canvasConfig.centerSize,
                                height: canvasConfig.centerSize,
                            }}
                        >
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: canvasConfig.centerLogoSize,
                                    height: canvasConfig.centerLogoSize,
                                }}
                            >
                                <OrbixLogo className="w-full h-full text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTIVE ITEM DETAIL CARD */}
            <div className="w-full max-w-xl mx-auto mt-6 sm:mt-10 px-2 min-h-[90px] flex items-center justify-center relative z-20">
                {activeItem ? (
                    <div className="w-full bg-white rounded-2xl border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_#000] animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    {activeItem.renderIcon("w-5 h-5 sm:w-6 sm:h-6 shrink-0")}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-sm sm:text-base md:text-lg font-black text-black tracking-tight truncate">
                                            {activeItem.name}
                                        </h4>
                                        <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-black">
                                            {activeItem.ring === "inner" ? "Core Pillar" : "Club Feature"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-500 font-bold truncate">
                                        {activeItem.category}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    to="/club/register"
                                    className="px-3 py-1.5 rounded-xl bg-black text-white text-xs sm:text-sm font-bold border-2 border-black hover:bg-neutral-800 transition-colors shadow-[2px_2px_0px_#FFE566] cursor-pointer"
                                >
                                    Get Started
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setSelectedItem(null)}
                                    className="p-1.5 rounded-lg border border-black/20 text-neutral-400 hover:text-black hover:border-black transition-colors cursor-pointer"
                                    aria-label="Dismiss module info"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <p className="mt-2.5 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            {activeItem.description}
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-2.5 px-4 rounded-xl border-2 border-dashed border-black/20 bg-black/[0.02]">
                        <p className="text-xs sm:text-sm text-neutral-500 font-bold flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#FFB94D] shrink-0" />
                            <span>
                                {canvasConfig.isMobile
                                    ? "Tap any module or swipe to spin the campus orbit"
                                    : "Hover or click any module to explore club capabilities"}
                            </span>
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ClubEcosystemShowcase;
