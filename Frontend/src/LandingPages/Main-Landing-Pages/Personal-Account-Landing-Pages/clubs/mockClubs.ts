import type { CollegeClubItem } from "../../../../utils/clubProfileApi";
import type { CollegeEventItem } from "../../../../api/collegeEventsApi";
import { PRESET_EVENT_BANNERS } from "../../../../components/EventBanners/presetEventBanners";

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
        id: "club-aws-swg-psit",
        name: "AWS SWG PSIT",
        slug: "aws-swg-psit",
        clubUsername: "aws-swg-psit",
        category: "Cloud Computing & DevOps",
        categoryUpdatedAt: "2026-01-20T00:00:00Z",
        collegeId: "psit-kanpur",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeCity: "Kanpur",
        collegeState: "Uttar Pradesh",
        collegeCountry: "India",
        shortDescription:
            "Official collegiate AWS Student Working Group advancing Cloud Architecture, Serverless Systems, DevOps CI/CD, and AWS Certifications at PSIT Kanpur.",
        about:
            "Dedicated to cloud engineering, AWS Solutions Architect mentoring, DevOps pipelines, and serverless distributed systems.",
        logoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
        coverImageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761105/96eb5c33-f981-4018-a18c-c3f778b75f0b.png",
        websiteUrl: "https://awsswg.psit.ac.in",
        publicEmail: "a***@psit.ac.in",
        contactPhone: null,
        links: [
            {
                platform: "website",
                url: "https://awsswg.psit.ac.in",
                label: "Chapter Portal",
                displayOrder: 1,
            },
            {
                platform: "github",
                url: "https://github.com/aws-swg-psit",
                label: "Cloud & DevOps Repos",
                displayOrder: 2,
            },
        ],
        socialLinks: {
            github: "https://github.com/aws-swg-psit",
            linkedin: "https://linkedin.com/company/aws-swg-psit",
        },
        foundedYear: 2023,
        operatingStatus: "active",
        mission: "Accelerate cloud adoption across academia and architect scalable serverless systems.",
        vision: "To establish our campus as a premier collegiate cloud center of excellence.",
        focusAreas: ["AWS Cloud", "DevOps", "Serverless", "Cloud Architecture", "AWS Certifications"],
        visibility: "public",
        publicationStatus: "published",
        profileVisibility: "public",
        recruitmentStatus: "open",
        recruitmentAnnouncement: "Spring '26 recruitment open for Cloud Architecture & DevOps tracks.",
        recruitmentUrl: "https://orbix.dev/join/aws-swg-psit",
        isActive: true,
        verifiedAt: "2026-01-20T00:00:00Z",
        createdAt: "2026-01-20T00:00:00Z",
        updatedAt: "2026-11-04T00:00:00Z",
        memberCount: 68,
        eventsCount: 9,
        achievementsCount: 4,
        coordinatorsCount: 2,
        isCurrentClub: false,
        coordinators: [
            {
                id: "coord-aws-1",
                clubId: "club-aws-swg-psit",
                name: "Krishna Tripathi",
                role: "DevOps & Cloud Lead",
                isPrimary: true,
                displayOrder: 1,
                isPublic: true,
                contactEmail: "k***@orbix.dev",
                linkedinUrl: "https://linkedin.com/in/krishnatripathi",
                linkedUsername: "krishna_tripathi",
                linkedDisplayName: "Krishna Tripathi",
                linkedAvatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
            },
        ],
        achievements: [
            {
                id: "ach-aws-1",
                clubId: "club-aws-swg-psit",
                title: "AWS Community Day Hackathon Champions 2025",
                type: "Cloud Hackathon",
                achievementType: "Contest",
                description: "Won 1st place across North India for architecting an ultra low-latency disaster alerting system.",
                date: "2025-10-14",
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
        logoUrl: "/avatar_club.webp",
        coverImageUrl: MANDALA_BANNER_URL,
        websiteUrl: "https://awssbg.orbix.dev",
        publicEmail: "a***@orbix.dev",
        contactPhone: "91********10",
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
                contactEmail: "v***@orbix.dev",
                linkedinUrl: "https://linkedin.com/in/vineetchandel",
                linkedUsername: "vineetsinghbitu",
                linkedDisplayName: "Vineet Singh",
                linkedAvatarUrl: "/avatar_club.webp",
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
        publicEmail: "g***@orbix.dev",
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
                contactEmail: "a***@orbix.dev",
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
        clubLogoUrl: "/avatar_club.webp",
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
        clubLogoUrl: "/avatar_club.webp",
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
        id: "ev-cloud-immersion-psit",
        clubId: "club-aws-swg-psit",
        title: "AWS Cloud Immersion Day: Zero to Solutions Architect '26",
        slug: "aws-cloud-immersion-day-zero-to-architect-26",
        summary: "Full-day intensive workshop building multi-tier production architectures on AWS.",
        description:
            "Open to verified student coders nationwide. Hands-on architectural masterclass building multi-tier production architectures with VPC, Application Load Balancers, ECS Fargate, and Aurora Serverless.",
        startsAt: "2026-11-28T09:30:00+05:30",
        endsAt: "2026-11-28T17:30:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person",
        venueOrLocation: "Advanced Cloud Computing Center (Lab 5), PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761105/96eb5c33-f981-4018-a18c-c3f778b75f0b.png",
        status: "published",
        scope: "PAN_INDIA",
        publishedAt: "2026-11-01T00:00:00+05:30",
        createdAt: "2026-11-01T00:00:00+05:30",
        clubName: "AWS SWG PSIT",
        clubSlug: "aws-swg-psit",
        clubLogoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
        clubBannerUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761105/96eb5c33-f981-4018-a18c-c3f778b75f0b.png",
        collegeName: "Pranveer Singh Institute of Technology, Kanpur",
        collegeId: "psit-kanpur",
        clubCategory: "Cloud Computing & DevOps",
        likesCount: 245,
        hasLiked: false,
        isRegistered: false,
        registrationStatus: null,
        ticketCode: null,
        registrationsCount: 340,
    },
];
