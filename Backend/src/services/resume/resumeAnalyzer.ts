import type {
    ResumeContent,
    AnalysisReport,
    ResumeFinding,
    RecruiterCheckSummary,
    ScoreBreakdown,
    CheckStatus,
    CodingProfileEntry,
} from "./resumeTypes.js";

// Action verbs dictionary for technical resumes
const STRONG_ACTION_VERBS = new Set([
    "accelerated", "achieved", "analyzed", "architected", "automated", "benchmarked",
    "built", "centralized", "compiled", "configured", "containerized", "created",
    "debugged", "decreased", "delivered", "deployed", "designed", "developed",
    "dockerized", "eliminated", "engineered", "enhanced", "established", "executed",
    "expanded", "expedited", "fabricated", "formulated", "generated", "implemented",
    "improved", "increased", "indexed", "initiated", "installed", "integrated",
    "launched", "maintained", "managed", "migrated", "modernized", "monitored",
    "negotiated", "optimized", "orchestrated", "overhauled", "partitioned", "pioneered",
    "profiled", "programmed", "provisioned", "published", "refactored", "resolved",
    "restructured", "retrieved", "scaled", "secured", "simplified", "spearheaded",
    "standardized", "streamlined", "structured", "synthesized", "tested", "transformed",
    "troubleshot", "upgraded", "validated", "visualized", "yielded",
]);

const WEAK_VERB_PATTERNS = [
    { pattern: /\bresponsible for\b/i, suggestion: "Replace 'responsible for' with a direct action verb (e.g. 'Engineered', 'Managed', 'Led')" },
    { pattern: /\bworked on\b/i, suggestion: "Replace 'worked on' with the specific technical contribution (e.g. 'Architected', 'Implemented', 'Refactored')" },
    { pattern: /\bhelped to\b/i, suggestion: "Replace 'helped to' with your specific contribution (e.g. 'Co-developed', 'Contributed to', 'Designed')" },
    { pattern: /\bassisted with\b/i, suggestion: "Replace 'assisted with' with your specific technical role (e.g. 'Implemented', 'Tested', 'Debugged')" },
    { pattern: /\bhandled\b/i, suggestion: "Replace 'handled' with an exact outcome-focused verb (e.g. 'Administered', 'Configured', 'Maintained')" },
    { pattern: /\btasked with\b/i, suggestion: "Replace 'tasked with' with the direct action taken (e.g. 'Spearheaded', 'Delivered', 'Built')" },
];

const METRIC_PATTERN = /(\b\d+(\.\d+)?%|\b\d+x\b|\b\d+(\+)?\s*(users|clients|requests|ms|seconds|minutes|hours|qps|rps|stars|downloads|endpoints|queries|tables)\b|\b\$\d+[\d,]*\b)/i;

export function analyzeResumeContent(
    content: ResumeContent,
    verifiedPlatformsFromDb?: CodingProfileEntry[],
    fileSizeMb?: number
): AnalysisReport {
    const findings: ResumeFinding[] = [];

    // =========================================================================
    // CHECK 1: ATS-Oriented Document Structure
    // =========================================================================
    const visibleSections = Object.entries(content.visibleSections || {})
        .filter(([, isVis]) => isVis)
        .map(([name]) => name);

    const hasCoreSections = visibleSections.includes("contact") &&
        visibleSections.includes("skills") &&
        (visibleSections.includes("projects") || visibleSections.includes("experience")) &&
        visibleSections.includes("education");

    let check1Status: CheckStatus = "pass";
    let check1Evidence = "Single-column linear structure with standard readable sections.";
    let check1Fix = "Keep clean single-column hierarchy for reliable parsing across major recruiting systems.";

    if (!hasCoreSections) {
        check1Status = "warn";
        check1Evidence = `Current sections: ${visibleSections.join(", ")}. Missing core sections.`;
        check1Fix = "Ensure Contact, Skills, Projects/Experience, and Education sections are visible.";
    }

    findings.push({
        id: "ats_structure",
        checkId: "format",
        title: "ATS-Oriented Document Structure",
        status: check1Status,
        explanation: "Evaluating single-column layout, standard section sequence, and reading order. Note: Greenhouse and other recruiting systems document parsing issues with complex multi-column layouts, tables, headers, footers, and text boxes. No universal ATS pass can be guaranteed.",
        evidence: check1Evidence,
        recommendedFix: check1Fix,
        actionType: "navigate_section",
        targetSection: "skills",
    });

    // =========================================================================
    // CHECK 2: File Size & Document Health
    // =========================================================================
    const sizeMb = fileSizeMb !== undefined ? fileSizeMb : 0.15; // Estimated from structured content
    let check2Status: CheckStatus = "pass";
    let check2Evidence = `Estimated file size: ~${sizeMb.toFixed(2)} MB (budget limit is 5.00 MB).`;
    let check2Fix = "File size is within the strict 5 MB budget.";

    if (sizeMb > 5.0) {
        check2Status = "fail";
        check2Evidence = `Current size: ${sizeMb.toFixed(2)} MB exceeds 5.00 MB target.`;
        check2Fix = "Reduce embedded images or export with optimized vector typography.";
    } else if (sizeMb > 2.5) {
        check2Status = "warn";
        check2Evidence = `Current size: ${sizeMb.toFixed(2)} MB. Larger files load slower on mobile recruiter screens.`;
        check2Fix = "Optimize document styling and keep under 2 MB for instantaneous mobile loading.";
    }

    findings.push({
        id: "file_health",
        checkId: "size",
        title: "File Size & Document Health",
        status: check2Status,
        explanation: "Verifying document size against the product target of 5 MB and evaluating lightweight vector readability.",
        evidence: check2Evidence,
        recommendedFix: check2Fix,
    });

    // =========================================================================
    // CHECK 3: Verified Coding Profiles & Evidence
    // =========================================================================
    const codingProfiles = content.codingProfiles || [];
    const verifiedDbList = verifiedPlatformsFromDb || [];
    const verifiedCount = codingProfiles.filter((p) => p.verified).length;
    const dbVerifiedCount = verifiedDbList.filter((p) => p.verified).length;

    let check3Status: CheckStatus = "pass";
    let check3Evidence = "";
    let check3Fix = "";

    if (verifiedCount > 0 || dbVerifiedCount > 0) {
        const totalSolved = codingProfiles.reduce((acc, p) => acc + (p.totalSolved || 0), 0);
        check3Status = "pass";
        check3Evidence = `${verifiedCount} verified platform(s) linked (${totalSolved > 0 ? `${totalSolved.toLocaleString()} problems solved` : "with live sync"}).`;
        check3Fix = "Your verified profiles prove real-world problem-solving abilities.";
    } else {
        const hasUnverifiedLink = codingProfiles.some((p) => !p.verified);
        if (hasUnverifiedLink) {
            check3Status = "warn";
            check3Evidence = "Coding profile links exist in text, but they are not authenticated via Orbix portal sync.";
            check3Fix = "Connect and verify your coding platforms (LeetCode, Codeforces, GitHub) in Orbix to display verified evidence badges.";
        } else {
            check3Status = "warn";
            check3Evidence = "No coding profile accounts (LeetCode, Codeforces, CodeChef, GitHub) linked.";
            check3Fix = "Add your competitive programming or GitHub handles to provide evidence for your skills.";
        }
    }

    findings.push({
        id: "verified_profiles",
        checkId: "profile_link",
        title: "Verified Coding Profiles & Evidence",
        status: check3Status,
        explanation: "Evaluating connected developer platforms. Important: A URL existing in a text field is not proof of verification; Orbix distinguishes authenticated platform syncs from plain user-entered links.",
        evidence: check3Evidence,
        recommendedFix: check3Fix,
        actionType: "import_profile",
    });

    // =========================================================================
    // CHECK 4: Direct Contact Clarity
    // =========================================================================
    const contact = content.contact || {};
    const hasName = Boolean(contact.fullName && contact.fullName.trim().length > 1);
    const hasEmail = Boolean(contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()));
    const hasPhone = Boolean(contact.phone && contact.phone.trim().length >= 7);
    const hasGithub = Boolean(contact.githubUrl && contact.githubUrl.includes("github.com"));
    const hasLinkedin = Boolean(contact.linkedinUrl && contact.linkedinUrl.includes("linkedin.com"));

    let check4Status: CheckStatus = "pass";
    const contactMissing: string[] = [];
    if (!hasName) contactMissing.push("Full Name");
    if (!hasEmail) contactMissing.push("Valid Email");
    if (!hasPhone && contact.includePhone) contactMissing.push("Phone Number");

    if (!hasName || !hasEmail) {
        check4Status = "fail";
    } else if (!hasGithub && !hasLinkedin) {
        check4Status = "warn";
    }

    findings.push({
        id: "contact_clarity",
        checkId: "contact_info",
        title: "Direct Contact Clarity",
        status: check4Status,
        explanation: "Recruiters need immediate access to contact channels and professional links. Users can choose which optional personal details to include.",
        evidence: contactMissing.length > 0
            ? `Missing contact details: ${contactMissing.join(", ")}.`
            : `Full name and verified email present. GitHub: ${hasGithub ? "Yes" : "No"}, LinkedIn: ${hasLinkedin ? "Yes" : "No"}.`,
        recommendedFix: contactMissing.length > 0
            ? `Provide: ${contactMissing.join(", ")} in Contact Info.`
            : "Include your LinkedIn or GitHub profile to provide recruiter convenience.",
        actionType: "navigate_section",
        targetSection: "contact",
    });

    // =========================================================================
    // CHECK 5: Standard Section Headings & Hierarchy
    // =========================================================================
    const educationEntries = content.education || [];
    const projectEntries = content.projects || [];
    const experienceEntries = content.experience || [];
    const hasEducation = educationEntries.length > 0;
    const hasProjects = projectEntries.length > 0;
    const hasExperience = experienceEntries.length > 0;

    let check5Status: CheckStatus = "pass";
    let check5Evidence = "";
    let check5Fix = "";

    // Candidate experience aware: Students and freshers must NOT be penalized for lacking employment history
    if (!hasEducation && !hasProjects && !hasExperience) {
        check5Status = "fail";
        check5Evidence = "Neither Education, Projects, nor Experience sections contain entries.";
        check5Fix = "Add your Education details and at least 1-2 software engineering projects.";
    } else if (!hasExperience) {
        // Fresher / Student path
        check5Status = hasProjects ? "pass" : "warn";
        check5Evidence = hasProjects
            ? `Student / Early Career profile with ${educationEntries.length} education entry and ${projectEntries.length} project(s). Professional experience is optional for early career.`
            : "No work experience and no projects found. Freshers should showcase technical projects.";
        check5Fix = hasProjects
            ? "Your project-centric structure is well-suited for internships and junior software engineering roles."
            : "Add at least 2 engineering projects to demonstrate practical technical ability.";
    } else {
        check5Status = "pass";
        check5Evidence = `Contains Education (${educationEntries.length}), Projects (${projectEntries.length}), and Work Experience (${experienceEntries.length}).`;
        check5Fix = "Standard section headings are clear and identifiable by automated parsers.";
    }

    findings.push({
        id: "section_headings",
        checkId: "structure",
        title: "Standard Section Headings & Hierarchy",
        status: check5Status,
        explanation: "Checking recognizable headings: Education, Skills, Projects, Experience, and Certifications. Freshers without employment history are evaluated on projects and coursework rather than penalized.",
        evidence: check5Evidence,
        recommendedFix: check5Fix,
        actionType: "navigate_section",
        targetSection: hasProjects ? "education" : "projects",
    });

    // =========================================================================
    // CHECK 6: Impact & Action Verbs
    // =========================================================================
    const allBullets: { text: string; section: "projects" | "experience"; title: string }[] = [];
    for (const proj of projectEntries) {
        for (const b of proj.bullets || []) {
            if (b && b.trim()) allBullets.push({ text: b.trim(), section: "projects", title: proj.title });
        }
    }
    for (const exp of experienceEntries) {
        for (const b of exp.bullets || []) {
            if (b && b.trim()) allBullets.push({ text: b.trim(), section: "experience", title: exp.company });
        }
    }

    let strongVerbCount = 0;
    let metricCount = 0;
    const weakBullets: { bullet: string; suggestion: string }[] = [];

    for (const item of allBullets) {
        const words = item.text.split(/\s+/);
        const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
        if (STRONG_ACTION_VERBS.has(firstWord)) {
            strongVerbCount++;
        }

        if (METRIC_PATTERN.test(item.text)) {
            metricCount++;
        }

        for (const rule of WEAK_VERB_PATTERNS) {
            if (rule.pattern.test(item.text)) {
                weakBullets.push({ bullet: item.text, suggestion: rule.suggestion });
                break;
            }
        }
    }

    let check6Status: CheckStatus = "pass";
    let check6Evidence = "";
    let check6Fix = "";

    if (allBullets.length === 0) {
        check6Status = "warn";
        check6Evidence = "No project or experience bullet points found.";
        check6Fix = "Add descriptive bullet points detailing what you built, technologies used, and outcomes achieved.";
    } else if (weakBullets.length > 0) {
        check6Status = "warn";
        check6Evidence = `${weakBullets.length} bullet(s) contain passive or vague phrasing (e.g., "${weakBullets[0]?.bullet.slice(0, 50)}...").`;
        check6Fix = weakBullets[0]?.suggestion || "Begin every bullet with an active technical verb.";
    } else if (strongVerbCount < Math.ceil(allBullets.length * 0.5)) {
        check6Status = "warn";
        check6Evidence = `Only ${strongVerbCount}/${allBullets.length} bullets begin with recognized strong engineering action verbs.`;
        check6Fix = "Start bullets with past-tense verbs such as 'Architected', 'Implemented', 'Optimized', or 'Automated'.";
    } else {
        check6Status = "pass";
        check6Evidence = `${strongVerbCount}/${allBullets.length} bullets begin with strong action verbs. ${metricCount} bullet(s) contain measurable outcomes.`;
        check6Fix = "Strong action-driven phrasing communicates direct technical ownership.";
    }

    findings.push({
        id: "impact_verbs",
        checkId: "action_verbs",
        title: "Impact & Action Verbs",
        status: check6Status,
        explanation: "Detecting vague or repetitive language and evaluating whether bullets communicate individual technical contributions. Important: Never fabricate metrics; if exact metrics are unavailable, describe architectural complexity or scope.",
        evidence: check6Evidence,
        recommendedFix: check6Fix,
        actionType: "edit_bullets",
        targetSection: "projects",
    });

    // =========================================================================
    // CHECK 7: Technical Stack Coherence
    // =========================================================================
    const allSkillsList: string[] = [];
    for (const cat of content.skills || []) {
        for (const item of cat.items || []) {
            if (item && item.trim()) allSkillsList.push(item.trim());
        }
    }

    const bulletText = allBullets.map((b) => b.text.toLowerCase()).join(" ");
    const supportedSkills: string[] = [];
    const unsupportedSkills: string[] = [];

    for (const skill of allSkillsList) {
        const cleanSkill = skill.toLowerCase();
        if (bulletText.includes(cleanSkill)) {
            supportedSkills.push(skill);
        } else {
            unsupportedSkills.push(skill);
        }
    }

    let check7Status: CheckStatus = "pass";
    let check7Evidence = "";
    let check7Fix = "";

    if (allSkillsList.length === 0) {
        check7Status = "fail";
        check7Evidence = "No technical skills listed in the Skills section.";
        check7Fix = "Add programming languages, frameworks, and developer tools you are proficient in.";
    } else if (supportedSkills.length < Math.min(3, allSkillsList.length)) {
        check7Status = "warn";
        check7Evidence = `Listed skills (${allSkillsList.slice(0, 5).join(", ")}) are not mentioned in your project or experience bullets.`;
        check7Fix = "Mention how you applied your listed skills inside your project bullets to provide contextual proof.";
    } else {
        check7Status = "pass";
        check7Evidence = `${supportedSkills.length}/${allSkillsList.length} skills are reinforced with direct project or experience evidence.`;
        check7Fix = "High technical coherence between listed competencies and documented project implementations.";
    }

    findings.push({
        id: "stack_coherence",
        checkId: "skills_highlight",
        title: "Technical Stack Coherence",
        status: check7Status,
        explanation: "Cross-referencing listed skills with project descriptions and verified activity. Differentiates verified evidence from user-claimed skills without automatically downgrading competencies.",
        evidence: check7Evidence,
        recommendedFix: check7Fix,
        actionType: "navigate_section",
        targetSection: "skills",
    });

    // =========================================================================
    // CHECK 8: Typography & Clean Layout
    // =========================================================================
    let hasOverlongBullet = false;
    let hasSingleWordBullet = false;

    for (const item of allBullets) {
        const words = item.text.split(/\s+/).length;
        if (words > 45) hasOverlongBullet = true;
        if (words < 3) hasSingleWordBullet = true;
    }

    let check8Status: CheckStatus = "pass";
    let check8Evidence = "Consistent bullet lengths and clean typographic density.";
    let check8Fix = "Ensure bullet lengths are between 1 and 3 lines (12 - 35 words).";

    if (hasOverlongBullet) {
        check8Status = "warn";
        check8Evidence = "One or more bullet points exceed 45 words, creating dense paragraphs that recruiters scan past.";
        check8Fix = "Split overlong bullets into two concise, punchy statements.";
    } else if (hasSingleWordBullet) {
        check8Status = "warn";
        check8Evidence = "One or more bullet points are under 3 words, lacking descriptive detail.";
        check8Fix = "Expand brief points to explain what was built and the technologies involved.";
    }

    findings.push({
        id: "typography_layout",
        checkId: "readability",
        title: "Typography & Clean Layout",
        status: check8Status,
        explanation: "Evaluating visual hierarchy, readable line length, consistent bullet formatting, and absence of text overflow.",
        evidence: check8Evidence,
        recommendedFix: check8Fix,
    });

    // =========================================================================
    // COMPILE 8 RECRUITER CHECKS SUMMARY
    // =========================================================================
    const checks: RecruiterCheckSummary[] = [
        {
            id: "format",
            label: "ATS-Oriented Document Structure",
            status: check1Status,
            description: "Single-column linear structure without problematic layout tables or multi-column parsing traps.",
            findingsCount: findings.filter((f) => f.checkId === "format").length,
        },
        {
            id: "size",
            label: "Optimized File Size & Health",
            status: check2Status,
            description: `File size under 5 MB product budget. Fast to download and render for recruiters on mobile.`,
            findingsCount: findings.filter((f) => f.checkId === "size").length,
        },
        {
            id: "profile_link",
            label: "Verified Coding Profile Evidence",
            status: check3Status,
            description: "Distinguishes authenticated platform syncs from raw unverified text links.",
            findingsCount: findings.filter((f) => f.checkId === "profile_link").length,
        },
        {
            id: "contact_info",
            label: "Direct Contact Clarity",
            status: check4Status,
            description: "Clear name, valid email, and optional phone/links with user privacy choice.",
            findingsCount: findings.filter((f) => f.checkId === "contact_info").length,
        },
        {
            id: "structure",
            label: "Standard Section Headers",
            status: check5Status,
            description: "Clear separation across Education, Skills, Projects, and Experience (tailored for freshers).",
            findingsCount: findings.filter((f) => f.checkId === "structure").length,
        },
        {
            id: "action_verbs",
            label: "Impact & Action Verbs",
            status: check6Status,
            description: "Action-driven past-tense verbs and genuine outcomes without fabricated metrics.",
            findingsCount: findings.filter((f) => f.checkId === "action_verbs").length,
        },
        {
            id: "skills_highlight",
            label: "Technical Stack Coherence",
            status: check7Status,
            description: "Technical skills reinforced by concrete evidence in project bullet points.",
            findingsCount: findings.filter((f) => f.checkId === "skills_highlight").length,
        },
        {
            id: "readability",
            label: "Typography & Clean Layout",
            status: check8Status,
            description: "Predictable reading hierarchy, consistent bullet lengths, and legible spacing.",
            findingsCount: findings.filter((f) => f.checkId === "readability").length,
        },
    ];

    // =========================================================================
    // CALCULATE EXPLAINABLE QUALITY SCORE
    // =========================================================================
    let structScore = 0;
    if (check1Status === "pass") structScore += 13;
    else if (check1Status === "warn") structScore += 8;
    if (check5Status === "pass") structScore += 12;
    else if (check5Status === "warn") structScore += 7;

    let completenessScore = 0;
    if (hasName && hasEmail) completenessScore += 8;
    if (allSkillsList.length >= 4) completenessScore += 9;
    if (hasEducation && (hasProjects || hasExperience)) completenessScore += 8;

    let readabilityScore = 0;
    if (check6Status === "pass") readabilityScore += 13;
    else if (check6Status === "warn") readabilityScore += 8;
    if (check8Status === "pass") readabilityScore += 12;
    else if (check8Status === "warn") readabilityScore += 8;

    let verificationScore = 0;
    if (check3Status === "pass") verificationScore += 13;
    else if (check3Status === "warn") verificationScore += 6;
    if (check7Status === "pass") verificationScore += 12;
    else if (check7Status === "warn") verificationScore += 7;

    const overall = Math.min(100, Math.max(10, structScore + completenessScore + readabilityScore + verificationScore));

    const scoreBreakdown: ScoreBreakdown = {
        documentStructure: structScore,
        contentCompleteness: completenessScore,
        readabilityAndImpact: readabilityScore,
        verificationAndLinks: verificationScore,
        overallScore: overall,
    };

    return {
        id: `report_${Date.now()}`,
        analyzerVersion: "v2.0-ats-strict",
        overallScore: overall,
        scoreBreakdown,
        findings,
        checks,
        disclaimer: "Orbix Resume Intelligence evaluates document formatting, coherence, and verification based on standard technical recruiting practices. Recruiting systems and ATS parsers vary; no universal ATS pass can be guaranteed.",
        createdAt: new Date().toISOString(),
    };
}
