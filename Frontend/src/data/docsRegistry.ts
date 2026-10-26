export interface DocFile {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    folderId: string;
    folderName: string;
    badge: string;
    badgeColor?: string;
    image: string;
    summary: string;
    tags: string[];
    readTime: string;
    updatedAt: string;
    author: string;
    featured?: boolean;
    hasInteractiveSim?: boolean;
}

export interface DocFolder {
    id: string;
    name: string;
    badge: string;
    icon: string;
    description: string;
    color: string;
    files: DocFile[];
}

export const DOCS_FOLDERS: DocFolder[] = [
    {
        id: "scoring-engine",
        name: "Scoring & Leaderboard Engine",
        badge: "Core Architecture",
        icon: "Cpu",
        color: "bg-[#a2ff86]",
        description: "Deterministic mathematical models, diminishing returns saturation curves, and ranking algorithms for college and global leaderboards.",
        files: [
            {
                id: "orbix-score-algorithm",
                slug: "orbix-score-algorithm",
                title: "Orbix Score Engine: Authoritative Ranking Algorithm",
                subtitle: "Standard 0 to 10,000 Points • 6 Canonical Pillars • Diminishing Returns Architecture",
                folderId: "scoring-engine",
                folderName: "Scoring & Leaderboard Engine",
                badge: "v2.0.0 Authoritative",
                badgeColor: "bg-[#a2ff86]",
                image: "https://res.cloudinary.com/dj0ivep44/image/upload/v1792948389/Neon_Algorithm_Grid_Wallpaper_smd5di.png",
                summary: "Complete mathematical documentary of the Orbix Score engine powering both Global and College Leaderboards. Explores the 6 canonical pillars, concave saturation formulas, anti-cheat bounding, and platform weighting.",
                tags: ["Algorithm", "Leaderboard", "College & Global", "Mathematics", "Diminishing Returns"],
                readTime: "12 min read",
                updatedAt: "October 2026",
                author: "Orbix Research & Engineering",
                featured: true,
                hasInteractiveSim: true,
            },
        ],
    },
    {
        id: "platform-integrations",
        name: "Connected Platform Registry",
        badge: "16 Platforms",
        icon: "Layers",
        color: "bg-[#FFE566]",
        description: "Official integration capabilities, rate limits, metric mappings, and webhook sync engines across all 16 supported developer portals.",
        files: [
            {
                id: "supported-platform-registry",
                slug: "supported-platform-registry",
                title: "Supported Platform Registry (16 Genuine Platforms)",
                subtitle: "Capability matrix across Competitive Programming, Open Source & Writing",
                folderId: "platform-integrations",
                folderName: "Connected Platform Registry",
                badge: "Verified Ecosystem",
                badgeColor: "bg-[#FFE566]",
                image: "https://res.cloudinary.com/dj0ivep44/image/upload/v1792945186/f729d8bb-9852-499f-94b6-4df0c75ffac2.png",
                summary: "Exhaustive documentation of the 16 genuine developer portals natively indexed by Orbix, including metric extractors, contest rating trackers, and contribution synchronizers.",
                tags: ["Platforms", "LeetCode", "Codeforces", "GitHub", "AtCoder", "CodeChef"],
                readTime: "9 min read",
                updatedAt: "October 2026",
                author: "Integrations Team",
                featured: true,
                hasInteractiveSim: true,
            },
        ],
    },
    {
        id: "resume-intelligence",
        name: "Resume Intelligence & Parsing Engine",
        badge: "v3.0.0 Architecture",
        icon: "Brain",
        color: "bg-[#a2ff86]",
        description: "Multi-stage document parsing, AST text extraction, 7-dimension deterministic scoring, fact provenance, and consent-driven profile sync.",
        files: [
            {
                id: "resume-intelligence-algorithm",
                slug: "resume-intelligence-algorithm",
                title: "Orbix Resume Intelligence: Fact Extraction & 7-Dimension Scoring Engine",
                subtitle: "Deterministic 7-Dimension Mathematical Model • Structured Provenance • ATS Linear Audit • Profile Sync",
                folderId: "resume-intelligence",
                folderName: "Resume Intelligence & Parsing Engine",
                badge: "v3.0.0 Authoritative",
                badgeColor: "bg-[#a2ff86]",
                image: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793003144/Neon_Resume_PDF_Thumbnail_lucuju.png",
                summary: "Full-fledged architectural documentation of the Orbix Resume Intelligence Engine. Explores multi-stage ingestion, selectable text parsing, structured fact provenance (explicitly stated vs inferred vs verified), 7 weighted evaluation dimensions, explainability formulas, and profile synchronization.",
                tags: ["Resume Analytics", "Algorithm", "ATS Linear Audit", "Provenance", "Profile Sync", "Deterministic Math"],
                readTime: "14 min read",
                updatedAt: "October 2026",
                author: "Orbix Research & Intelligence Engineering",
                featured: true,
                hasInteractiveSim: true,
            },
        ],
    },
];

export const ALL_DOC_FILES: DocFile[] = DOCS_FOLDERS.flatMap((folder) => folder.files);

export const getDocBySlug = (slug: string): DocFile | undefined => {
    return ALL_DOC_FILES.find((f) => f.slug.toLowerCase() === slug.toLowerCase() || f.id.toLowerCase() === slug.toLowerCase());
};
