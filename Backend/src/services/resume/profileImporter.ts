import { query } from "../../database/client.js";
import type {
    ResumeContent,
    ProfileImportSummary,
    ProfileCompletenessMap,
    CodingProfileEntry,
    SkillCategory,
    EducationEntry,
} from "./resumeTypes.js";

function categorizeSkills(rawSkills: string[]): SkillCategory[] {
    const languagesSet = new Set([
        "c", "c++", "cpp", "c#", "java", "python", "javascript", "typescript", "go", "golang",
        "rust", "ruby", "php", "swift", "kotlin", "sql", "html", "css", "r", "dart", "scala",
    ]);

    const frameworksSet = new Set([
        "react", "react.js", "next.js", "nextjs", "vue", "vue.js", "angular", "node", "node.js",
        "express", "express.js", "django", "flask", "fastapi", "spring", "spring boot",
        "laravel", "asp.net", "tailwind", "tailwindcss", "bootstrap", "redux", "graphql",
        "prisma", "drizzle", "typeorm", "hibernate",
    ]);

    const databasesSet = new Set([
        "postgresql", "postgres", "mysql", "mongodb", "redis", "sqlite", "oracle", "mariadb",
        "cassandra", "elasticsearch", "neo4j", "dynamodb", "supabase", "firebase",
    ]);

    const toolsSet = new Set([
        "git", "github", "gitlab", "docker", "kubernetes", "aws", "gcp", "azure", "linux",
        "nginx", "vite", "webpack", "jest", "cypress", "postman", "ci/cd", "github actions",
    ]);

    const languages: string[] = [];
    const frameworks: string[] = [];
    const databases: string[] = [];
    const tools: string[] = [];
    const other: string[] = [];

    for (const skill of rawSkills) {
        const clean = skill.trim();
        if (!clean) continue;
        const lower = clean.toLowerCase();

        if (languagesSet.has(lower)) {
            languages.push(clean);
        } else if (frameworksSet.has(lower)) {
            frameworks.push(clean);
        } else if (databasesSet.has(lower)) {
            databases.push(clean);
        } else if (toolsSet.has(lower)) {
            tools.push(clean);
        } else {
            other.push(clean);
        }
    }

    const categories: SkillCategory[] = [];
    if (languages.length > 0) categories.push({ category: "Languages", items: languages });
    if (frameworks.length > 0) categories.push({ category: "Frameworks & Libraries", items: frameworks });
    if (databases.length > 0) categories.push({ category: "Databases & Storage", items: databases });
    if (tools.length > 0) categories.push({ category: "Developer Tools & Cloud", items: tools });
    if (other.length > 0) categories.push({ category: "Other Technical Skills", items: other });

    if (categories.length === 0 && rawSkills.length > 0) {
        categories.push({ category: "Technical Skills", items: rawSkills });
    }

    return categories;
}

export async function importProfileDataForUser(
    userId: string,
    username: string,
    email: string
): Promise<ProfileImportSummary> {
    // 1. Fetch user profile row
    const userResult = await query(
        `SELECT
            id,
            username,
            firstname AS "firstName",
            middlename AS "middleName",
            lastname AS "lastName",
            email AS gmail,
            headline,
            bio,
            website,
            linkedin,
            github,
            custom_link AS "customLink",
            location,
            skills,
            links,
            college_id AS "collegeId",
            college AS "collegeName",
            resume_metadata AS "resumeMetadata"
        FROM users
        WHERE id = $1 OR email = $2 OR username = $3
        LIMIT 1;`,
        [userId, email, username]
    );

    const user = userResult.rows[0] || {};
    const fullName = [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || username || "Developer";

    // 2. Fetch college info
    let collegeOfficialName = user.collegeName || "";
    let collegeLocation = "";
    if (user.collegeId) {
        const collegeRes = await query(
            `SELECT official_name AS "officialName", city, state FROM institutions WHERE id = $1 LIMIT 1;`,
            [user.collegeId]
        );
        if (collegeRes.rows[0]) {
            collegeOfficialName = collegeRes.rows[0].officialName || collegeOfficialName;
            collegeLocation = [collegeRes.rows[0].city, collegeRes.rows[0].state].filter(Boolean).join(", ");
        }
    }

    // 3. Fetch connected platforms from user_links
    const linksResult = await query(
        `SELECT
            portal,
            portal_username AS "portalUsername",
            link,
            verified,
            display_name AS "displayName",
            stats,
            last_sync_status AS "lastSyncStatus",
            last_sync_at AS "lastSyncAt"
        FROM user_links
        WHERE username = $1 OR username = $2
        ORDER BY created_at ASC;`,
        [user.username || username, user.gmail || email]
    );

    const verifiedPlatforms: CodingProfileEntry[] = [];
    const unverifiedLinks: { portal: string; url: string; reason: string }[] = [];

    for (const row of linksResult.rows || []) {
        let totalSolved: number | undefined;
        let contestRating: number | undefined;
        let globalRank: string | undefined;

        if (Array.isArray(row.stats)) {
            for (const item of row.stats) {
                const label = String(item.label || item.key || "").toLowerCase();
                const val = Number(item.value);
                if (!Number.isNaN(val)) {
                    if (label.includes("solved") || label.includes("problem")) {
                        totalSolved = val;
                    } else if (label.includes("rating") || label.includes("score")) {
                        contestRating = val;
                    }
                }
            }
        } else if (typeof row.stats === "object" && row.stats !== null) {
            totalSolved = row.stats.totalSolved || row.stats.solved;
            contestRating = row.stats.contestRating || row.stats.rating;
            globalRank = row.stats.globalRank || row.stats.rank;
        }

        const isVerified = row.verified !== false && row.lastSyncStatus === "valid";
        const entry: CodingProfileEntry = {
            portal: row.portal,
            username: row.portalUsername,
            url: row.link,
            verified: isVerified,
            totalSolved,
            contestRating,
            globalRank,
            lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt).toISOString() : undefined,
            lastSyncStatus: row.lastSyncStatus || "valid",
        };

        if (isVerified) {
            verifiedPlatforms.push(entry);
        } else {
            unverifiedLinks.push({
                portal: row.portal,
                url: row.link,
                reason: row.lastSyncStatus === "failed" ? "Platform verification failed or expired" : "Pending account verification",
            });
        }
    }

    // 4. Parse skills
    const rawSkills: string[] = Array.isArray(user.skills) ? user.skills : [];
    const skillCategories = categorizeSkills(rawSkills);

    // 5. Initial Education Entry
    const education: EducationEntry[] = [];
    if (collegeOfficialName) {
        education.push({
            id: "edu_primary",
            institution: collegeOfficialName,
            degree: "Bachelor of Technology (B.Tech)",
            fieldOfStudy: "Computer Science & Engineering",
            location: collegeLocation || user.location || undefined,
            expectedGraduation: "2026",
            highlights: ["Relevant Coursework: Data Structures & Algorithms, Operating Systems, Database Management, System Design"],
        });
    }

    // 6. Professional Summary
    let summary = "";
    if (user.bio && user.bio.trim().length > 15) {
        summary = user.bio.trim();
    } else if (user.headline) {
        summary = `${user.headline}. Passionate developer with hands-on experience in building scalable web applications, solving complex algorithmic problems, and collaborating on modern software engineering workflows.`;
    } else {
        summary = "Analytical software engineer with a strong foundation in core computer science, competitive programming, and modern web architectures. Proven problem-solving capabilities with a focus on writing clean, maintainable, and production-ready code.";
    }

    // 7. Assemble Structured ResumeContent
    const profileData: ResumeContent = {
        contact: {
            fullName,
            headline: user.headline || "Software Engineer",
            email: user.gmail || email,
            phone: "",
            location: user.location || "",
            portfolioUrl: user.website || user.customLink || "",
            linkedinUrl: user.linkedin || "",
            githubUrl: user.github || "",
            customLinks: [],
            includeEmail: true,
            includePhone: true,
            includeLocation: Boolean(user.location),
        },
        summary,
        education,
        skills: skillCategories,
        projects: [],
        experience: [],
        codingProfiles: verifiedPlatforms,
        certifications: [],
        sectionOrder: ["contact", "summary", "education", "skills", "projects", "codingProfiles", "experience", "certifications"],
        visibleSections: {
            contact: true,
            summary: true,
            education: true,
            skills: true,
            projects: true,
            codingProfiles: verifiedPlatforms.length > 0,
            experience: false, // Default to false for freshers unless user adds work experience
            certifications: false,
        },
    };

    // 8. Compute Real Completeness Map
    const completedFields: string[] = [];
    const missingFields: ProfileCompletenessMap["missingFields"] = [];

    if (fullName) completedFields.push("Full Name");
    else missingFields.push({ field: "fullName", label: "Full Name", severity: "critical", reason: "Recruiters require candidate name." });

    if (user.gmail || email) completedFields.push("Email Address");
    else missingFields.push({ field: "email", label: "Email Address", severity: "critical", reason: "Direct contact method is necessary for interview invitations." });

    if (rawSkills.length >= 3) completedFields.push(`Technical Skills (${rawSkills.length} listed)`);
    else missingFields.push({ field: "skills", label: "Skills & Technologies", severity: "critical", reason: "List at least 3 core programming languages or technologies." });

    if (collegeOfficialName) completedFields.push("Education / College");
    else missingFields.push({ field: "college", label: "College / University", severity: "recommended", reason: "Education details help recruiters verify your academic background." });

    if (verifiedPlatforms.length > 0) completedFields.push(`Verified Coding Profiles (${verifiedPlatforms.length} connected)`);
    else missingFields.push({ field: "codingProfiles", label: "Verified Coding Profile", severity: "recommended", reason: "Connect platforms like LeetCode or Codeforces to showcase verified problem-solving metrics." });

    if (user.github) completedFields.push("GitHub Profile");
    else missingFields.push({ field: "github", label: "GitHub Profile", severity: "recommended", reason: "Provides direct evidence of repositories, code commits, and project activity." });

    if (user.linkedin) completedFields.push("LinkedIn Profile");
    else missingFields.push({ field: "linkedin", label: "LinkedIn Profile", severity: "recommended", reason: "Enables recruiters to review your professional network and background." });

    if (user.location) completedFields.push("Location");
    else missingFields.push({ field: "location", label: "Current Location", severity: "optional", reason: "City and state help recruiters identify relocation preferences." });

    missingFields.push({
        field: "projects",
        label: "Projects with Impact Bullets",
        severity: "recommended",
        reason: "Adding at least 2 engineering projects with measurable results substantially improves your ATS pass rate.",
    });

    // Score calculation
    let totalPoints = 0;
    if (fullName) totalPoints += 15;
    if (user.gmail || email) totalPoints += 15;
    if (rawSkills.length >= 3) totalPoints += 20;
    if (collegeOfficialName) totalPoints += 15;
    if (verifiedPlatforms.length > 0) totalPoints += 15;
    if (user.github) totalPoints += 10;
    if (user.linkedin) totalPoints += 5;
    if (user.location) totalPoints += 5;

    const completenessScore = Math.min(100, totalPoints);

    const completenessMap: ProfileCompletenessMap = {
        score: completenessScore,
        completedFields,
        missingFields,
        verifiedPlatformsCount: verifiedPlatforms.length,
        isStudent: true,
    };

    return {
        profileData,
        completenessMap,
        verifiedPlatforms,
        unverifiedLinks,
    };
}
