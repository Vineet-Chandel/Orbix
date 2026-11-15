import type { CollegeClubItem } from "../../../utils/clubProfileApi";
import type { CollegeEventItem } from "../../../api/collegeEventsApi";
import { PRESET_EVENT_BANNERS } from "../../../components/EventBanners/presetEventBanners";

// Helper: Mandala SVG banner matching the authentic mandala artwork from user image 2
const MANDALA_BANNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <radialGradient id="mandala-bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1A1829"/>
      <stop offset="60%" stop-color="#0F0E17"/>
      <stop offset="100%" stop-color="#08070C"/>
    </radialGradient>
    <linearGradient id="gold-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="50%" stop-color="#FB923C"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FDE047" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="#FB923C" stop-opacity="0.7"/>
      <stop offset="70%" stop-color="#38BDF8" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#08070C" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background base -->
  <rect width="1200" height="675" fill="url(#mandala-bg)"/>
  <circle cx="600" cy="337" r="300" fill="url(#center-glow)" opacity="0.35"/>

  <!-- Geometric Mandala Concentric Rings -->
  <g transform="translate(600, 337)">
    <!-- Outer ornate rings -->
    <circle r="290" fill="none" stroke="#FDE047" stroke-width="1.5" stroke-dasharray="4 8" opacity="0.4"/>
    <circle r="270" fill="none" stroke="#FB923C" stroke-width="2" opacity="0.5"/>
    <circle r="250" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.6"/>

    <!-- Petal Ring 1 (24 Petals) -->
    <g stroke="url(#gold-glow)" stroke-width="2.5" fill="none" opacity="0.75">
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(30)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(60)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(90)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(120)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(150)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(180)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(210)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(240)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(270)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(300)" />
      <path d="M 0 0 C 40 -120 70 -200 0 -240 C -70 -200 -40 -120 0 0" transform="rotate(330)" />
    </g>

    <!-- Mid Petal Ring (12 ornate florets with fill) -->
    <g stroke="#FDE047" stroke-width="1.5" fill="#FB923C" fill-opacity="0.15" opacity="0.85">
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(15)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(45)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(75)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(105)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(135)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(165)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(195)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(225)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(255)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(285)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(315)" />
      <path d="M 0 0 C 25 -70 50 -120 0 -150 C -50 -120 -25 -70 0 0" transform="rotate(345)" />
    </g>

    <!-- Inner Sacred Lotus (Cyan + Golden core) -->
    <circle r="75" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
    <circle r="45" fill="#F59E0B" fill-opacity="0.25" stroke="#FDE047" stroke-width="2"/>
    <circle r="18" fill="#FDE047" stroke="#000000" stroke-width="2"/>
  </g>
</svg>`;

const toDataUrl = (svg: string): string => {
    const cleanSvg = svg.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
    return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
};

export const MANDALA_BANNER_URL = toDataUrl(MANDALA_BANNER_SVG);

export interface MockCollegeOption {
    id: string;
    officialName: string;
    city: string;
    state: string;
    aisheCode: string;
}

export const MOCK_COLLEGES: MockCollegeOption[] = [
    {
        id: "psit-kanpur",
        officialName: "Pranveer Singh Institute of Technology, Kanpur",
        city: "Kanpur",
        state: "Uttar Pradesh",
        aisheCode: "C-46844",
    },
    {
        id: "iit-delhi",
        officialName: "Indian Institute of Technology Delhi (IIT Delhi)",
        city: "New Delhi",
        state: "Delhi",
        aisheCode: "C-6395",
    },
    {
        id: "bits-pilani",
        officialName: "BITS Pilani, Pilani Campus",
        city: "Pilani",
        state: "Rajasthan",
        aisheCode: "U-0391",
    },
    {
        id: "iiit-hyderabad",
        officialName: "IIIT Hyderabad",
        city: "Hyderabad",
        state: "Telangana",
        aisheCode: "U-0013",
    },
    {
        id: "nsut-delhi",
        officialName: "Netaji Subhas University of Technology (NSUT)",
        city: "New Delhi",
        state: "Delhi",
        aisheCode: "U-0118",
    },
];

export const MOCK_CLUBS_DATA: CollegeClubItem[] = [
    {
        id: "club-acm-psit",
        name: "ACM Student Chapter",
        slug: "acm-psit",
        clubUsername: "acm-psit",
        category: "Competitive Programming",
        categoryUpdatedAt: "2026-01-20T00:00:00Z",
        collegeId: "psit-kanpur",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeCity: "Kanpur",
        collegeState: "Uttar Pradesh",
        collegeCountry: "India",
        shortDescription:
            "Advancing computing as a science and profession. Weekly ICPC problem sets, contests & algorithm workshops.",
        about:
            "Dedicated to competitive programming, algorithmic puzzles, discrete math, and preparing student coders for ICPC Regionals and global coding challenges.",
        logoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
        coverImageUrl: PRESET_EVENT_BANNERS[0]?.dataUrl || MANDALA_BANNER_URL,
        websiteUrl: "https://acm.org",
        publicEmail: "acm.psit@orbix.dev",
        contactPhone: null,
        links: [
            {
                platform: "website",
                url: "https://acm.psit.org",
                label: "Chapter Portal",
                displayOrder: 1,
            },
            {
                platform: "github",
                url: "https://github.com/acm-psit",
                label: "Algorithms Repo",
                displayOrder: 2,
            },
        ],
        socialLinks: {
            github: "https://github.com/acm-psit",
            linkedin: "https://linkedin.com/company/acm-psit",
        },
        foundedYear: 2023,
        operatingStatus: "active",
        mission: "Demystify advanced data structures and competitive programming.",
        vision: "Represent our campus on international ICPC podiums.",
        focusAreas: ["ICPC", "Algorithms", "DSA", "Codeforces"],
        visibility: "public",
        publicationStatus: "published",
        profileVisibility: "public",
        recruitmentStatus: "closed",
        recruitmentAnnouncement: null,
        recruitmentUrl: null,
        isActive: true,
        verifiedAt: "2026-01-20T00:00:00Z",
        createdAt: "2026-01-20T00:00:00Z",
        updatedAt: "2026-11-04T00:00:00Z",
        memberCount: 52,
        eventsCount: 7,
        achievementsCount: 3,
        coordinatorsCount: 2,
        isCurrentClub: false,
        coordinators: [
            {
                id: "coord-acm-1",
                clubId: "club-acm-psit",
                name: "Krishna Tripathi",
                role: "Competitive Head",
                isPrimary: true,
                displayOrder: 1,
                isPublic: true,
                contactEmail: "krishna@orbix.dev",
                linkedinUrl: "https://linkedin.com/in/krishnatripathi",
                linkedUsername: "krishna_tripathi",
                linkedDisplayName: "Krishna Tripathi",
                linkedAvatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
            },
        ],
        achievements: [
            {
                id: "ach-acm-1",
                clubId: "club-acm-psit",
                title: "ICPC Regional Finalist 2025",
                type: "Competitive Honor",
                achievementType: "Contest",
                description: "Qualified in top 15 teams across North India Regionals.",
                date: "2025-12-14",
                displayOrder: 1,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
            },
        ],
    },
    {
        id: "club-aws-sbg",
        name: "AWS SBG",
        slug: "vineetsinghbitu",
        clubUsername: "vineetsinghbitu",
        category: "Technical & Coding",
        categoryUpdatedAt: "2026-01-10T00:00:00Z",
        collegeId: "psit-kanpur",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeCity: "Kanpur",
        collegeState: "Uttar Pradesh",
        collegeCountry: "India",
        shortDescription:
            "AWS Student Builders Group Think boldly. Build practically. Grow together. An official AWS Student Builders Group chapter at ...",
        about:
            "AWS Student Builders Group (AWS SBG) is an official collegiate community designed to bridge student engineers directly with cloud systems, serverless computing, and distributed DevOps architecture. We host regular hands-on sessions, cloud hackathons, and certifications bootcamps.",
        logoUrl: "/avatar_club.png",
        coverImageUrl: MANDALA_BANNER_URL,
        websiteUrl: "https://awssbg.orbix.dev",
        publicEmail: "awssbg.chapter@orbix.dev",
        contactPhone: "+91 98765 43210",
        links: [
            {
                platform: "website",
                url: "https://awssbg.orbix.dev",
                label: "Chapter Hub",
                displayOrder: 1,
            },
            {
                platform: "github",
                url: "https://github.com/awssbg",
                label: "GitHub Repos",
                displayOrder: 2,
            },
            {
                platform: "linkedin",
                url: "https://linkedin.com/company/awssbg",
                label: "LinkedIn Community",
                displayOrder: 3,
            },
        ],
        socialLinks: {
            github: "https://github.com/awssbg",
            linkedin: "https://linkedin.com/company/awssbg",
            x: "https://x.com/awssbg",
        },
        foundedYear: 2026,
        operatingStatus: "active",
        mission:
            "Think boldly. Build practically. Grow together. Empowering every college student to deploy production-grade software to the cloud.",
        vision:
            "Building India's largest and most active student-led cloud builders chapter.",
        focusAreas: ["Cloud", "DevOps", "AWS", "Coding"],
        visibility: "public",
        publicationStatus: "published",
        profileVisibility: "public",
        recruitmentStatus: "open",
        recruitmentAnnouncement: "Core technical team applications are open for Cloud Leads and Event Leads.",
        recruitmentUrl: "https://orbix.dev/join/awssbg",
        isActive: true,
        verifiedAt: "2026-01-15T00:00:00Z",
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-11-06T00:00:00Z",
        memberCount: 1,
        eventsCount: 2,
        achievementsCount: 1,
        coordinatorsCount: 1,
        isCurrentClub: true,
        coordinators: [
            {
                id: "coord-1",
                clubId: "club-aws-sbg",
                name: "Vineet Singh",
                role: "Lead Coordinator",
                isPrimary: true,
                displayOrder: 1,
                isPublic: true,
                contactEmail: "vineet@orbix.dev",
                linkedinUrl: "https://linkedin.com/in/vineetchandel",
                linkedUsername: "vineetsinghbitu",
                linkedDisplayName: "Vineet Singh",
                linkedAvatarUrl: "/avatar_club.png",
                createdAt: "2026-01-15T00:00:00Z",
                updatedAt: "2026-01-15T00:00:00Z",
            },
        ],
        achievements: [
            {
                id: "ach-1",
                clubId: "club-aws-sbg",
                title: "Official AWS SBG Campus Charter",
                type: "National Recognition",
                achievementType: "Charter",
                description: "Chartered as official collegiate student builders community with AWS.",
                date: "2026-02-01",
                displayOrder: 1,
                createdAt: "2026-02-01T00:00:00Z",
                updatedAt: "2026-02-01T00:00:00Z",
            },
        ],
    },
    {
        id: "club-gdg-psit",
        name: "Google Developer Groups on Campus",
        slug: "gdg-psit",
        clubUsername: "gdg-psit",
        category: "Technical & Coding",
        categoryUpdatedAt: "2026-02-10T00:00:00Z",
        collegeId: "psit-kanpur",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeCity: "Kanpur",
        collegeState: "Uttar Pradesh",
        collegeCountry: "India",
        shortDescription:
            "Connecting students who are passionate about Google developer technologies, AI & Android innovation.",
        about:
            "GDG on Campus PSIT organizes regular workshops on Gemini API, Android, Flutter, and Google Cloud, hosting interactive hands-on code labs and community hackathons.",
        logoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855185/acd4f9fe-0a0a-426a-a7f6-04a3983935f7.png",
        coverImageUrl: PRESET_EVENT_BANNERS[3]?.dataUrl || MANDALA_BANNER_URL,
        websiteUrl: "https://gdg.community.dev",
        publicEmail: "gdg.psit@orbix.dev",
        contactPhone: null,
        links: [
            {
                platform: "website",
                url: "https://gdg.psit.org",
                label: "GDG Portal",
                displayOrder: 1,
            },
        ],
        socialLinks: {
            linkedin: "https://linkedin.com/company/gdg-psit",
        },
        foundedYear: 2024,
        operatingStatus: "active",
        mission: "Inspire and teach modern developer tools across disciplines.",
        vision: "Foster collaborative technology ecosystems within the campus.",
        focusAreas: ["AI", "Flutter", "Android", "Web"],
        visibility: "public",
        publicationStatus: "published",
        profileVisibility: "public",
        recruitmentStatus: "open",
        recruitmentAnnouncement: "Campus ambassadors auditions open.",
        recruitmentUrl: null,
        isActive: true,
        verifiedAt: "2026-02-15T00:00:00Z",
        createdAt: "2026-02-15T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
        memberCount: 28,
        eventsCount: 4,
        achievementsCount: 2,
        coordinatorsCount: 2,
        isCurrentClub: false,
        coordinators: [
            {
                id: "coord-gdg-1",
                clubId: "club-gdg-psit",
                name: "Aradhy Bajpai",
                role: "GDG Lead",
                isPrimary: true,
                displayOrder: 1,
                isPublic: true,
                contactEmail: "aradhy@orbix.dev",
                linkedinUrl: "https://linkedin.com/in/aradhybajpai",
                linkedUsername: "aradhy_bajpai",
                linkedDisplayName: "Aradhy Bajpai",
                linkedAvatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855185/acd4f9fe-0a0a-426a-a7f6-04a3983935f7.png",
                createdAt: "2026-02-15T00:00:00Z",
                updatedAt: "2026-02-15T00:00:00Z",
            },
        ],
        achievements: [],
    },
];

export const MOCK_COLLEGE_EVENTS_DATA: CollegeEventItem[] = [
    {
        id: "ev-cloud-arch-bootcamp",
        clubId: "club-aws-sbg",
        title: "AWS Cloud Foundations & Serverless Architecture",
        slug: "aws-cloud-foundations-serverless-architecture",
        summary: "Architecting fault-tolerant microservices, AWS Lambda event handlers & containerized deployments.",
        description:
            "Join AWS Student Builders Group at PSIT Kanpur for an interactive architectural walkthrough. Learn hands-on system design, Docker containerization, AWS Lambda serverless pipelines, and infrastructure-as-code (IaC) with AWS CDK. Free cloud credits and sandbox environments provided.",
        startsAt: "2026-11-06T10:00:00+05:30",
        endsAt: "2026-11-06T13:30:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person",
        venueOrLocation: "Campus Hall (Audi-2)",
        registrationUrl: null,
        coverImageUrl: PRESET_EVENT_BANNERS[0]?.dataUrl || MANDALA_BANNER_URL,
        status: "published",
        scope: "CAMPUS",
        publishedAt: "2026-11-01T00:00:00+05:30",
        createdAt: "2026-11-01T00:00:00+05:30",
        clubName: "AWS SBG",
        clubSlug: "vineetsinghbitu",
        clubLogoUrl: "/avatar_club.png",
        clubBannerUrl: MANDALA_BANNER_URL,
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeId: "psit-kanpur",
        clubCategory: "Technical & Coding",
        likesCount: 28,
        hasLiked: false,
        isRegistered: false,
        registrationStatus: null,
        ticketCode: null,
        registrationsCount: 42,
    },
    {
        id: "ev-fullstack-dev-sprint",
        clubId: "club-aws-sbg",
        title: "Full-Stack Developer Bootcamp: React, Node & Docker",
        slug: "fullstack-developer-bootcamp-react-node-docker",
        summary: "Hands-on engineering sprint building high-throughput APIs, Redis caching & container orchestration.",
        description:
            "Intensive full-stack masterclass covering modern production practices. We will architect a scalable web platform from scratch, implement caching layers, write clean type-safe APIs, and containerize the whole stack with Docker Compose for automated deployment.",
        startsAt: "2026-11-06T14:00:00+05:30",
        endsAt: "2026-11-06T17:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person",
        venueOrLocation: "Advanced Computing Lab (Lab 4)",
        registrationUrl: null,
        coverImageUrl: PRESET_EVENT_BANNERS[1]?.dataUrl || MANDALA_BANNER_URL,
        status: "published",
        scope: "CAMPUS",
        publishedAt: "2026-11-02T00:00:00+05:30",
        createdAt: "2026-11-02T00:00:00+05:30",
        clubName: "AWS SBG",
        clubSlug: "vineetsinghbitu",
        clubLogoUrl: "/avatar_club.png",
        clubBannerUrl: MANDALA_BANNER_URL,
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeId: "psit-kanpur",
        clubCategory: "Technical & Coding",
        likesCount: 19,
        hasLiked: false,
        isRegistered: false,
        registrationStatus: null,
        ticketCode: null,
        registrationsCount: 35,
    },
    {
        id: "ev-pan-india-arena",
        clubId: "club-acm-psit",
        title: "Pan-India Collegiate HackSprint '26",
        slug: "pan-india-collegiate-hacksprint-26",
        summary: "Inter-college 36-hour national sprint. ₹1,50,000 prize pool open to all verified college coders.",
        description:
            "Open to verified student coders nationwide. Build high-concurrency cloud backends, AI applications, and systems software.",
        startsAt: "2026-11-15T09:00:00+05:30",
        endsAt: "2026-11-16T21:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "virtual",
        venueOrLocation: "Virtual National Arena • Pan-India Discord",
        registrationUrl: null,
        coverImageUrl: PRESET_EVENT_BANNERS[2]?.dataUrl || MANDALA_BANNER_URL,
        status: "published",
        scope: "PAN_INDIA",
        publishedAt: "2026-11-01T00:00:00+05:30",
        createdAt: "2026-11-01T00:00:00+05:30",
        clubName: "ACM Student Chapter",
        clubSlug: "acm-psit",
        clubLogoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793855116/5985c311-0778-41af-b034-da3ddb26a12a.png",
        clubBannerUrl: "",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeId: "psit-kanpur",
        clubCategory: "Competitive Programming",
        likesCount: 182,
        hasLiked: false,
        isRegistered: false,
        registrationStatus: null,
        ticketCode: null,
        registrationsCount: 340,
    },
];
