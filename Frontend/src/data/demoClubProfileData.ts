import { MANDALA_BANNER_URL } from "../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/clubs/mockClubs";
import { PRESET_EVENT_BANNERS } from "../components/EventBanners/presetEventBanners";

export const DEMO_CLUB_SLUG = "acm-psit";

/**
 * Normalizes and checks if a given slug corresponds to the demo club profile
 */
export function isDemoClubSlug(slug?: string | null): boolean {
    if (!slug) return false;
    const clean = slug.trim().toLowerCase();
    return (
        clean === "acm-psit" ||
        clean === "demo" ||
        clean === "demo-club" ||
        clean === "demo/club" ||
        clean === "acm" ||
        clean === "acm-student-chapter"
    );
}

export interface DemoClubDataBundle {
    club: any;
    coordinators: any[];
    achievements: any[];
    teams: any[];
    upcomingEvents: any[];
    pastEvents: any[];
}

export const demoClubProfile = {
    id: "demo-club-acm-psit",
    name: "ACM Student Chapter",
    slug: DEMO_CLUB_SLUG,
    category: "Competitive Programming & Systems",
    collegeName: "Pranveer Singh Institute of Technology, Kanpur",
    collegeCity: "Kanpur",
    collegeState: "Uttar Pradesh",
    collegeCountry: "India",
    shortDescription:
        "Official collegiate ACM Chapter advancing algorithmic problem solving, high-performance distributed systems, and ICPC regional mastery across North India.",
    about: `## About ACM Student Chapter • PSIT Kanpur

The **ACM Student Chapter at Pranveer Singh Institute of Technology (PSIT), Kanpur** is an officially chartered, student-led collegiate computing community. Dedicated to advancing computing as both a science and a profession, the chapter acts as an institutional launchpad for competitive programmers, systems architects, and open-source contributors.

### 🏆 Algorithmic Mastery & Contest Culture
We believe intuition for algorithms is built through rigorous practice, deep post-contest analysis, and collective mentorship.
- **Weekly Code Arena:** Every Friday evening, we host curated contest mashups on LeetCode & Codeforces spanning greedy algorithms, dynamic programming, tree traversals, and segment trees.
- **ICPC Intensive Track:** High-intensity problem sets designed specifically to prepare campus teams for ICPC Asia Regionals, Hash Code, and global algorithmic cups.
- **Peer Editorial Pods:** Detailed post-contest breakdowns where students explain alternative $O(N \log N)$ approaches and optimize space-time complexity.

### ⚡ Distributed Systems & Core Engineering
Beyond competitive math puzzles, our members build software that scales to real-world demand:
- **Campus Platforms:** Developing production tools, automated event RSVP scanners, and real-time contest mirrors.
- **Cloud & DevOps Practice:** Hands-on experience with Docker containerization, Redis in-memory caching, Go microservices, and Kubernetes deployments.
- **Systems Hackathons:** 36-hour sprint tracks focusing on systems resilience, offline-first architectures, and AI-assisted workflows.

### 🌐 Inter-College Community & Collaborations
The chapter maintains active partnerships with sister ACM and developer chapters across premier IIT, NIT, and collegiate institutions nationwide. Through Orbix, we facilitate inter-college hackathons, shared speaker sessions with industry leaders, and Pan-India coding leagues.`,
    logoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
    coverImageUrl: MANDALA_BANNER_URL,
    websiteUrl: "https://acm.psit.org",
    publicEmail: "acm.chapter@psit.ac.in",
    contactPhone: "+91 98765 43210",
    links: [
        {
            platform: "website",
            url: "https://acm.psit.org",
            label: "Chapter Portal",
        },
        {
            platform: "github",
            url: "https://github.com/acm-psit",
            label: "Algorithms & Systems Repos",
        },
        {
            platform: "linkedin",
            url: "https://linkedin.com/company/acm-psit",
            label: "LinkedIn Network",
        },
        {
            platform: "discord",
            url: "https://discord.gg/acm-psit",
            label: "Coders Discord Community",
        },
    ],
    socialLinks: {
        github: "https://github.com/acm-psit",
        linkedin: "https://linkedin.com/company/acm-psit",
        x: "https://x.com/acm_psit",
        discord: "https://discord.gg/acm-psit",
        youtube: "https://youtube.com/@acmpsit",
    },
    foundedYear: 2023,
    operatingStatus: "active" as const,
    mission:
        "Demystify competitive programming, empower undergraduates to build rock-solid algorithmic intuition, and lead collegiate teams to international ICPC podiums.",
    vision:
        "To establish our campus as a premier national powerhouse for competitive programming, systems engineering, and open-source innovation.",
    focusAreas: ["ICPC", "Algorithms", "Codeforces", "Systems", "Open Source", "Hackathons", "Distributed Systems"],
    publicationStatus: "published" as const,
    profileVisibility: "public" as const,
    visibility: "public" as const,
    recruitmentStatus: "open" as const,
    recruitmentAnnouncement:
        "Call for Spring '26 CP Mentors, Systems Architecture Leads, and Hackathon Operations Squad! Applications open until November 25.",
    recruitmentUrl: "https://orbix.dev/join/acm-psit",
    verifiedAt: "2025-08-15T00:00:00Z",
    createdAt: "2023-09-01T00:00:00Z",
};

export const demoClubCoordinators = [
    {
        id: "coord-demo-1",
        name: "Vineet Chandel",
        department: "Computer Science & Engineering",
        role: "Lead Coordinator & CP Mentor",
        imageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
        isPrimary: true,
        contactEmail: "vineet@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/vineetchandel",
        linkedUsername: "Vineet-Chandel",
        linkedDisplayName: "Vineet Chandel",
        linkedAvatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
    },
    {
        id: "coord-demo-2",
        name: "Krishna Tripathi",
        department: "Information Technology",
        role: "Competitive Head (Candidate Master)",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "krishna.tripathi@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/krishnatripathi",
        linkedUsername: "krishna_tripathi",
        linkedDisplayName: "Krishna Tripathi",
        linkedAvatarUrl: null,
    },
    {
        id: "coord-demo-3",
        name: "Ananya Sharma",
        department: "Computer Science (AI & ML)",
        role: "Distributed Systems & Cloud Lead",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "ananya.s@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/ananyasharma",
        linkedUsername: "ananya_codes",
        linkedDisplayName: "Ananya Sharma",
        linkedAvatarUrl: null,
    },
    {
        id: "coord-demo-4",
        name: "Devansh Verma",
        department: "Computer Science & Engineering",
        role: "Hackathon Operations & Partnerships",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "devansh@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/devanshverma",
        linkedUsername: "devansh_v",
        linkedDisplayName: "Devansh Verma",
        linkedAvatarUrl: null,
    },
];

export const demoClubAchievements = [
    {
        id: "ach-demo-1",
        title: "ICPC Asia Amritapuri Regional Finalist 2025",
        type: "Competitive Programming",
        description: "Ranked in top 12 collegiate teams across North India in the prestigious ICPC regional championship.",
        achievementDate: "December 2025",
        issuer: "ICPC Global / Amrita Vishwa Vidyapeetham",
        imageUrl: null,
        externalLink: "https://icpc.global",
    },
    {
        id: "ach-demo-2",
        title: "Winner - Smart India Hackathon '24 (Software Edition)",
        type: "National Hackathon",
        description: "Grand prize winners for deploying a low-latency offline-first disaster response mapping engine.",
        achievementDate: "September 2024",
        issuer: "Ministry of Education Innovation Cell (Govt of India)",
        imageUrl: null,
        externalLink: "https://sih.gov.in",
    },
    {
        id: "ach-demo-3",
        title: "Outstanding Student Chapter of the Year (North India)",
        type: "Institutional Honor",
        description: "Recognized for hosting 30+ peer-learning workshops and training 500+ student competitive coders.",
        achievementDate: "February 2025",
        issuer: "ACM India Council",
        imageUrl: null,
        externalLink: "https://india.acm.org",
    },
    {
        id: "ach-demo-4",
        title: "Top 5 CodeChef Campus Chapter Nationwide",
        type: "National Ranking",
        description: "Achieved 99.4th percentile active participation and solved over 14,000+ problems on CodeChef.",
        achievementDate: "October 2025",
        issuer: "CodeChef College League",
        imageUrl: null,
        externalLink: "https://codechef.com",
    },
];

export const demoClubTeams = [
    {
        id: "team-demo-1",
        name: "Competitive Programming Wing",
        slug: "competitive-programming",
        description: "Conducts weekly problem-solving rounds, Codeforces post-contest editorial discussions, and advanced data structure workshops.",
        responsibilities: "ICPC Preparation, Graph Theory, DP & Combinatorics, Weekly Sprints",
        memberCount: 38,
    },
    {
        id: "team-demo-2",
        name: "Systems & Full-Stack Core",
        slug: "systems-fullstack",
        description: "Engineers production-grade campus software, microservice APIs, contest mirrors, and student productivity tools.",
        responsibilities: "Node.js, Go, Docker, Redis, Automated Discord bots & web portals",
        memberCount: 24,
    },
    {
        id: "team-demo-3",
        name: "Hackathons & National Summits",
        slug: "hackathons",
        description: "Curates national hackathon rosters, provides project architecture reviews, and coordinates external college sponsorships.",
        responsibilities: "Hackathon Mentorship, Sponsor Relations, Inter-College Collaborations",
        memberCount: 18,
    },
    {
        id: "team-demo-4",
        name: "Design & Brand Guild",
        slug: "design-media",
        description: "Crafts neo-brutalist event branding, interactive graphics, visual assets, and UI components for all chapter products.",
        responsibilities: "Figma Design Systems, Event Banners, Social Media Content, Stage AV",
        memberCount: 12,
    },
];

export const demoClubUpcomingEvents = [
    {
        id: "ev-demo-pan-india",
        title: "Pan-India Collegiate HackSprint '26",
        slug: "pan-india-collegiate-hacksprint-26",
        summary: "36-hour inter-college national sprint with ₹1,50,000 cash prizes, open to all verified college coders.",
        description: "Build high-concurrency cloud backends, AI applications, and systems software. Mentored by industry engineers from Google, Amazon, and top startups. Verified QR passes, certificates, and Pan-India discovery provided via Orbix.",
        startsAt: "2026-11-28T09:00:00+05:30",
        endsAt: "2026-11-29T21:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "online" as const,
        venueOrLocation: "Virtual National Arena • Pan-India Discord & Orbix Portal",
        registrationUrl: "https://orbix.dev/events/pan-india-collegiate-hacksprint-26/register",
        coverImageUrl: PRESET_EVENT_BANNERS[2]?.dataUrl || MANDALA_BANNER_URL,
        publishedAt: "2026-11-01T00:00:00+05:30",
    },
    {
        id: "ev-demo-algorithm-arena",
        title: "Weekly Algorithm Arena #42: Advanced Graphs & Segment Trees",
        slug: "weekly-algorithm-arena-42",
        summary: "Intensive 2.5-hour algorithmic contest with live editorial breakdown and code walkthrough.",
        description: "Hands-on problem solving covering Heavy-Light Decomposition, 2-SAT, and Lazy Propagation Segment Trees. Top 3 coders receive official chapter swags and Orbix verified contest badges.",
        startsAt: "2026-11-22T17:00:00+05:30",
        endsAt: "2026-11-22T19:30:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Advanced Computing Lab (Lab 4), PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: PRESET_EVENT_BANNERS[0]?.dataUrl || MANDALA_BANNER_URL,
        publishedAt: "2026-11-10T00:00:00+05:30",
    },
];

export const demoClubPastEvents = [
    {
        id: "ev-demo-past-1",
        title: "ICPC Regional Warmup Contest 2025",
        slug: "icpc-regional-warmup-contest-2025",
        summary: "5-hour official ICPC mirror contest with 85 collegiate teams competing under strict timer rules.",
        description: "Simulated regional round contest with 12 algorithmic problems prepared by Candidate Masters.",
        startsAt: "2025-11-15T10:00:00+05:30",
        endsAt: "2025-11-15T15:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Campus Auditorium, PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: null,
        publishedAt: "2025-11-01T00:00:00+05:30",
    },
    {
        id: "ev-demo-past-2",
        title: "Zero to Production: Distributed Microservices Workshop",
        slug: "zero-to-production-distributed-microservices",
        summary: "Hands-on architectural masterclass building high-throughput APIs with Node.js, Redis, and Docker.",
        description: "Over 160 students learned how to architect event-driven architectures, handle race conditions, and deploy to Kubernetes.",
        startsAt: "2025-10-10T11:00:00+05:30",
        endsAt: "2025-10-10T16:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Seminar Hall 1, PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: null,
        publishedAt: "2025-10-01T00:00:00+05:30",
    },
];

/**
 * Returns the full bundle for the demo club profile
 */
export function getDemoClubProfileBundle(_slug?: string): DemoClubDataBundle {
    return {
        club: demoClubProfile,
        coordinators: demoClubCoordinators,
        achievements: demoClubAchievements,
        teams: demoClubTeams,
        upcomingEvents: demoClubUpcomingEvents,
        pastEvents: demoClubPastEvents,
    };
}
