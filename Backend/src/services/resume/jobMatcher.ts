import type {
    ResumeContent,
    JobMatchReport,
    JobMatchSkillItem,
} from "./resumeTypes.js";

const COMMON_TECH_TERMS = [
    // Languages
    "python", "javascript", "typescript", "c++", "cpp", "c#", "java", "golang", "go",
    "rust", "ruby", "php", "swift", "kotlin", "sql", "r", "scala", "dart",
    // Frontend
    "react", "react.js", "next.js", "vue", "angular", "redux", "tailwind", "css",
    "html", "webpack", "vite", "responsive design", "state management",
    // Backend & API
    "node.js", "node", "express", "django", "fastapi", "spring boot", "graphql",
    "rest", "restful", "microservices", "websockets", "grpc",
    // Databases
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
    "database indexing", "orm", "prisma", "hibernate",
    // Cloud & DevOps
    "docker", "kubernetes", "aws", "gcp", "azure", "ci/cd", "github actions",
    "linux", "nginx", "terraform", "serverless",
    // Fundamentals & Testing
    "data structures", "algorithms", "system design", "unit testing", "jest",
    "object-oriented", "oop", "git", "agile", "scrum", "performance optimization",
];

export function runJobMatchAnalysis(
    resume: ResumeContent,
    targetRole: string,
    companyName: string = "",
    jobDescription: string = ""
): JobMatchReport {
    const jdClean = jobDescription.toLowerCase();
    const roleClean = targetRole.toLowerCase();

    // 1. Collect all skills and text from the resume
    const resumeSkills = new Set<string>();
    for (const cat of resume.skills || []) {
        for (const s of cat.items || []) {
            if (s && s.trim()) resumeSkills.add(s.trim().toLowerCase());
        }
    }

    const resumeAllText = [
        resume.summary,
        ...resume.education.map((e) => `${e.institution} ${e.degree} ${e.fieldOfStudy} ${(e.highlights || []).join(" ")}`),
        ...resume.skills.flatMap((c) => c.items),
        ...resume.projects.map((p) => `${p.title} ${p.subtitle || ""} ${p.technologies.join(" ")} ${p.bullets.join(" ")}`),
        ...resume.experience.map((e) => `${e.company} ${e.role} ${e.bullets.join(" ")}`),
    ]
        .join(" ")
        .toLowerCase();

    // 2. Identify skills mentioned in the job description
    const jdSkillsFound = new Set<string>();
    for (const term of COMMON_TECH_TERMS) {
        // Use word boundary check
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(jdClean) || regex.test(roleClean)) {
            jdSkillsFound.add(term);
        }
    }

    // 3. Classify into matched vs missing skills
    const matchedSkills: JobMatchSkillItem[] = [];
    const missingSkills: JobMatchSkillItem[] = [];

    for (const term of jdSkillsFound) {
        const found = resumeSkills.has(term) || resumeAllText.includes(term);
        const item: JobMatchSkillItem = {
            name: term.charAt(0).toUpperCase() + term.slice(1),
            foundInResume: found,
            contextInJob: `Referenced in job description for ${targetRole}`,
        };

        if (found) {
            matchedSkills.push(item);
        } else {
            missingSkills.push(item);
        }
    }

    // 4. Evaluate experience requirements
    const requirementRules = [
        { label: "Degree in Computer Science or related technical discipline", check: () => resume.education.some((e) => /computer|engineering|technology|science|it/i.test(e.fieldOfStudy || e.degree)) },
        { label: "Hands-on experience building web applications or APIs", check: () => resume.projects.length > 0 || resume.experience.length > 0 },
        { label: "Familiarity with modern version control & Git workflows", check: () => resumeSkills.has("git") || resumeSkills.has("github") || Boolean(resume.contact.githubUrl) },
        { label: "Data Structures & Algorithmic Problem Solving capability", check: () => resume.codingProfiles.some((p) => p.verified && (p.totalSolved || 0) > 0) || resumeSkills.has("data structures") },
        { label: "Containerization or Cloud deployment awareness (Docker/AWS)", check: () => resumeSkills.has("docker") || resumeSkills.has("aws") || resumeAllText.includes("docker") || resumeAllText.includes("aws") },
    ];

    const experienceMatches = requirementRules.map((rule) => {
        const passed = rule.check();
        return {
            requirement: rule.label,
            evidenceFound: passed,
            evidenceSnippet: passed ? "Supported by verified profile and project data." : "No explicit evidence found in current draft.",
        };
    });

    // 5. Identify relevant projects to prioritize
    const projectHighlights = (resume.projects || []).map((proj) => {
        const projText = `${proj.title} ${proj.technologies.join(" ")} ${proj.bullets.join(" ")}`.toLowerCase();
        let overlapCount = 0;
        for (const term of jdSkillsFound) {
            if (projText.includes(term)) overlapCount++;
        }

        const bulletsToEmphasize = proj.bullets.slice(0, 2);
        return {
            projectTitle: proj.title,
            relevanceReason: overlapCount > 0
                ? `Shares ${overlapCount} relevant technology keyword(s) with the ${targetRole} role.`
                : "Demonstrates full-stack development capability and system implementation.",
            suggestedBulletsToEmphasize: bulletsToEmphasize,
        };
    });

    // 6. Generate grounded summary rewrite
    const candidateName = resume.contact.fullName || "Developer";
    const primarySkills = Array.from(resumeSkills).slice(0, 4).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
    const companyContext = companyName ? ` at ${companyName}` : "";

    const suggestedSummaryRewrite = `${candidateName} is an analytical, results-driven software engineer specializing in ${primarySkills || "modern full-stack engineering"}. Proven ability to design and implement robust architectures, write maintainable code, and solve complex technical challenges aligned with the ${targetRole} opening${companyContext}.`;

    // 7. Generate bullet improvements for weak or relevant bullets
    const suggestedBulletImprovements: JobMatchReport["suggestedBulletImprovements"] = [];

    resume.projects.forEach((proj, pIdx) => {
        proj.bullets.forEach((bullet, bIdx) => {
            if (/worked on|responsible for|helped/i.test(bullet)) {
                const improved = bullet
                    .replace(/\bworked on\b/i, "Architected and delivered")
                    .replace(/\bresponsible for\b/i, "Spearheaded")
                    .replace(/\bhelped to\b/i, "Engineered");

                suggestedBulletImprovements.push({
                    sectionId: "projects",
                    entryId: proj.id || `proj_${pIdx}`,
                    bulletIndex: bIdx,
                    originalBullet: bullet,
                    improvedBullet: improved,
                    rationale: "Replaced passive verb with strong technical action verb to highlight ownership.",
                });
            }
        });
    });

    // 8. Calculate match score
    const totalJdSkills = jdSkillsFound.size;
    let score = 50;
    if (totalJdSkills > 0) {
        const ratio = matchedSkills.length / totalJdSkills;
        score = Math.round(40 + ratio * 45);
    }
    const reqPassCount = experienceMatches.filter((e) => e.evidenceFound).length;
    score += Math.round((reqPassCount / requirementRules.length) * 15);
    const finalScore = Math.min(96, Math.max(25, score));

    return {
        targetRole,
        companyName,
        matchScore: finalScore,
        matchedSkills,
        missingSkills,
        experienceMatches,
        projectHighlights,
        suggestedSummaryRewrite,
        suggestedBulletImprovements,
    };
}
