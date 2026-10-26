import type { CodingProfileEntry } from "./resumeTypes.js";

export interface GeminiAnalysisReport {
    analyzerVersion: string;
    modelUsed: string; // e.g. "gemini-2.0-flash", "gemini-1.5-flash", "orbix-deterministic-engine"
    overallScore: number; // 0 - 100
    scoreGrade: "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement";
    targetRoleDetected: string;
    experienceLevel: "Entry-Level" | "Mid-Level" | "Senior" | "Lead / Staff";
    summary: string;

    scoreBreakdown: {
        impactAndMetrics: number; // 0 - 100
        technicalDepth: number;   // 0 - 100
        atsParsability: number;   // 0 - 100
        clarityAndStructure: number; // 0 - 100
        verifiedProfiles: number; // 0 - 100
    };

    detectedSkills: {
        languages: string[];
        frameworks: string[];
        databasesAndTools: string[];
        concepts: string[];
    };

    strengths: Array<{
        title: string;
        description: string;
    }>;

    improvements: Array<{
        title: string;
        category: "metrics" | "action_verbs" | "technical_keywords" | "structure" | "brevity";
        issue: string;
        suggestion: string;
        exampleBefore?: string;
        exampleAfter?: string;
    }>;

    checks: Array<{
        id: string;
        label: string;
        status: "pass" | "warn" | "fail";
        score: number;
        description: string;
        evidence: string;
        recommendation: string;
    }>;

    missingKeywords: string[];
    roleSpecificTips: string[];
    filename: string;
    filesizeBytes: number;
    createdAt: string;
}

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

const KNOWN_SKILLS_DB = {
    languages: ["TypeScript", "JavaScript", "Python", "Java", "C++", "C", "Go", "Rust", "Kotlin", "Swift", "Ruby", "PHP", "SQL", "HTML", "CSS"],
    frameworks: ["React", "Next.js", "Vue", "Angular", "Node.js", "Express", "FastAPI", "Django", "Spring Boot", "NestJS", "Tailwind CSS", "Redux", "GraphQL"],
    databasesAndTools: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "GitHub", "Linux", "Kafka", "Elasticsearch", "Nginx"],
    concepts: ["Data Structures", "Algorithms", "System Design", "Microservices", "REST APIs", "CI/CD", "Object-Oriented Programming", "Concurrency", "Database Indexing", "Cloud Architecture"],
};

/**
 * Intelligent deterministic fallback analysis engine
 * Guarantees a comprehensive, recruiter-grade analysis report even if external API is unreachable or key is missing.
 */
function analyzeWithRuleEngine(
    rawText: string,
    filename: string,
    filesizeBytes: number,
    verifiedPlatforms: CodingProfileEntry[] = []
): GeminiAnalysisReport {
    const textLower = rawText.toLowerCase();
    const words = textLower.match(/[a-z0-9+#.-]+/g) || [];
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // 1. Detect Skills
    const detectedLanguages = KNOWN_SKILLS_DB.languages.filter((s) => textLower.includes(s.toLowerCase()));
    const detectedFrameworks = KNOWN_SKILLS_DB.frameworks.filter((s) => textLower.includes(s.toLowerCase()));
    const detectedDatabasesAndTools = KNOWN_SKILLS_DB.databasesAndTools.filter((s) => textLower.includes(s.toLowerCase()));
    const detectedConcepts = KNOWN_SKILLS_DB.concepts.filter((s) => textLower.includes(s.toLowerCase()));

    // 2. Detect Action Verbs
    const foundVerbs = new Set<string>();
    for (const w of words) {
        if (STRONG_ACTION_VERBS.has(w)) {
            foundVerbs.add(w);
        }
    }

    // 3. Detect Metrics & Impact
    const metricMatches = rawText.match(/(\b\d+(\.\d+)?%|\b\d+x\b|\b\d+(\+)?\s*(users|clients|requests|ms|seconds|minutes|hours|qps|rps|stars|downloads|endpoints|queries|tables)\b|\b\$\d+[\d,]*\b)/gi) || [];
    const metricsCount = metricMatches.length;

    // 4. Section detection
    const hasEducation = /education|academic|bachelor|master|b\.tech|m\.tech/i.test(rawText);
    const hasProjects = /project|developed|built|architected/i.test(rawText);
    const hasExperience = /experience|work\s+experience|intern|software\s+engineer/i.test(rawText);
    const hasSkills = /skills|technologies|proficiencies|languages/i.test(rawText);
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText);
    const hasPhone = /(\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(rawText);
    const hasGithub = /github\.com/i.test(rawText);
    const hasLinkedin = /linkedin\.com/i.test(rawText);

    // 5. Calculate Score Dimensions
    const impactScore = Math.min(100, Math.round(metricsCount * 14 + foundVerbs.size * 2));
    const technicalScore = Math.min(100, Math.round((detectedLanguages.length * 10) + (detectedFrameworks.length * 8) + (detectedDatabasesAndTools.length * 6)));
    const atsScore = Math.min(100, 40 + (hasEducation ? 15 : 0) + (hasProjects ? 15 : 0) + (hasExperience ? 15 : 0) + (hasSkills ? 15 : 0));
    const clarityScore = Math.min(100, 30 + (hasEmail ? 20 : 0) + (hasPhone ? 20 : 0) + (lines.length > 15 && lines.length < 90 ? 30 : 15));

    const hasVerifiedLinks = verifiedPlatforms.some((p) => p.verified);
    const platformMatchesInResume = verifiedPlatforms.filter((p) => p.url && textLower.includes(p.portal.toLowerCase()));
    const verificationScore = hasVerifiedLinks
        ? Math.min(100, 50 + platformMatchesInResume.length * 25)
        : (hasGithub || hasLinkedin ? 70 : 40);

    const overall = Math.round(
        impactScore * 0.25 +
        technicalScore * 0.25 +
        atsScore * 0.20 +
        clarityScore * 0.15 +
        verificationScore * 0.15
    );

    let scoreGrade: GeminiAnalysisReport["scoreGrade"] = "Needs Improvement";
    if (overall >= 85) scoreGrade = "Top Tier";
    else if (overall >= 70) scoreGrade = "Competitive";
    else if (overall >= 55) scoreGrade = "Strong Foundation";

    // Target Role & Experience Level heuristics
    let targetRoleDetected = "Full Stack Engineer";
    if (detectedLanguages.includes("Python") && (textLower.includes("machine learning") || textLower.includes("deep learning") || textLower.includes("model"))) {
        targetRoleDetected = "AI / ML Engineer";
    } else if (detectedFrameworks.includes("React") || detectedFrameworks.includes("Next.js") || detectedFrameworks.includes("Vue")) {
        if (!detectedDatabasesAndTools.includes("PostgreSQL") && !detectedDatabasesAndTools.includes("Docker")) {
            targetRoleDetected = "Frontend Engineer";
        }
    } else if (textLower.includes("microservices") || detectedDatabasesAndTools.includes("Docker") || detectedDatabasesAndTools.includes("Kubernetes")) {
        targetRoleDetected = "Backend / Systems Engineer";
    }

    let experienceLevel: GeminiAnalysisReport["experienceLevel"] = "Entry-Level";
    if (/senior|lead|architect|staff/i.test(rawText)) {
        experienceLevel = "Senior";
    } else if (metricsCount >= 4 && foundVerbs.size >= 8) {
        experienceLevel = "Mid-Level";
    }

    // Strengths
    const strengths: GeminiAnalysisReport["strengths"] = [];
    if (detectedLanguages.length >= 3 && detectedFrameworks.length >= 2) {
        strengths.push({
            title: "Robust Polyglot Technical Stack",
            description: `Identified strong competencies across ${detectedLanguages.slice(0, 4).join(", ")} and modern frameworks (${detectedFrameworks.slice(0, 3).join(", ")}).`,
        });
    }
    if (foundVerbs.size >= 5) {
        strengths.push({
            title: "Action-Oriented Leadership Verbs",
            description: `Uses strong technical verbs (${Array.from(foundVerbs).slice(0, 4).join(", ")}) demonstrating direct ownership.`,
        });
    }
    if (metricsCount >= 2) {
        strengths.push({
            title: "Quantifiable Impact & Performance Metrics",
            description: `Resume provides measurable outcomes (e.g. ${metricMatches.slice(0, 2).join(", ")}), crucial for passing 6-second recruiter scans.`,
        });
    }
    if (hasGithub) {
        strengths.push({
            title: "Verified Open Source / GitHub Visibility",
            description: "Direct GitHub profile link allows technical screeners to inspect code quality and commits.",
        });
    }
    if (strengths.length === 0) {
        strengths.push({
            title: "Clear Core Engineering Foundation",
            description: "Demonstrates core computer science skills and linear chronological progression.",
        });
    }

    // Improvements
    const improvements: GeminiAnalysisReport["improvements"] = [];
    if (metricsCount < 3) {
        improvements.push({
            title: "Quantify Bullet Points with Metrics",
            category: "metrics",
            issue: "Only a few quantifiable impact indicators were detected in bullet points.",
            suggestion: "Enhance bullets using the Google XYZ formula: 'Accomplished [X], as measured by [Y], by doing [Z]'.",
            exampleBefore: "Optimized database queries for faster loading.",
            exampleAfter: "Restructured PostgreSQL query indexing, decreasing API endpoint response latency by 42% under 5,000 QPS.",
        });
    }
    if (foundVerbs.size < 6) {
        improvements.push({
            title: "Eliminate Passive Phrasing",
            category: "action_verbs",
            issue: "Bullets contain passive verbs or descriptive phrases rather than strong accomplishment verbs.",
            suggestion: "Begin each project or experience bullet with a high-impact technical verb like Architected, Engineered, Refactored, or Containerized.",
            exampleBefore: "Responsible for building the user dashboard.",
            exampleAfter: "Architected a real-time reactive user dashboard with React and WebSockets, supporting 10k+ daily active engineers.",
        });
    }
    if (!hasPhone || !hasEmail) {
        improvements.push({
            title: "Ensure Standard Contact Header",
            category: "structure",
            issue: "Missing or non-standard contact fields (email or phone).",
            suggestion: "Place Email, Location, and Direct Phone cleanly in the top header line for recruiter reachouts.",
        });
    }
    if (!hasGithub || !hasLinkedin) {
        improvements.push({
            title: "Embed Verified Coding Links",
            category: "technical_keywords",
            issue: "GitHub or LinkedIn profile link is missing or unlinked.",
            suggestion: "Include clean, clickable profile links and connect your Orbix verified profile for live contest statistics.",
        });
    }

    // Recruiter Checks
    const checks: GeminiAnalysisReport["checks"] = [
        {
            id: "ats_structure",
            label: "ATS Linear Parseability",
            status: hasEducation && (hasProjects || hasExperience) && hasSkills ? "pass" : "warn",
            score: atsScore,
            description: "Applicant Tracking Systems parse standard single-column text hierarchies reliably.",
            evidence: `Detected sections: Education (${hasEducation ? "Yes" : "No"}), Experience/Projects (${hasProjects || hasExperience ? "Yes" : "No"}), Skills (${hasSkills ? "Yes" : "No"}).`,
            recommendation: "Maintain standard section headers and clean linear flow without multi-layer canvas elements.",
        },
        {
            id: "metrics_density",
            label: "Quantifiable Impact & Metrics",
            status: metricsCount >= 3 ? "pass" : metricsCount >= 1 ? "warn" : "fail",
            score: impactScore,
            description: "Recruiters and hiring managers prioritize engineers who quantify results (%, latency, users).",
            evidence: `Found ${metricsCount} measurable metrics across projects and experience bullets.`,
            recommendation: "Aim for at least 1-2 quantified metrics per technical project or work experience entry.",
        },
        {
            id: "action_verbs",
            label: "Action Verbs & Leadership Voice",
            status: foundVerbs.size >= 5 ? "pass" : "warn",
            score: Math.min(100, foundVerbs.size * 18),
            description: "Direct action verbs highlight initiative and technical execution ownership.",
            evidence: `Detected ${foundVerbs.size} strong verbs (${Array.from(foundVerbs).slice(0, 5).join(", ")}).`,
            recommendation: "Replace phrases like 'worked on' or 'helped with' with active engineering verbs.",
        },
        {
            id: "tech_stack_depth",
            label: "Technical Keywords & Frameworks",
            status: detectedLanguages.length >= 2 && detectedFrameworks.length >= 2 ? "pass" : "warn",
            score: technicalScore,
            description: "Relevant languages and tools aligned with target roles.",
            evidence: `Found ${detectedLanguages.length} languages, ${detectedFrameworks.length} frameworks, and ${detectedDatabasesAndTools.length} databases/tools.`,
            recommendation: "Ensure core languages match your target job descriptions (e.g. TypeScript, Python, Docker).",
        },
        {
            id: "contact_clarity",
            label: "Recruiter Contact Information",
            status: hasEmail ? "pass" : "fail",
            score: clarityScore,
            description: "Direct email and professional links readily accessible in header.",
            evidence: `Email: ${hasEmail ? "Present" : "Missing"}, Phone: ${hasPhone ? "Present" : "Missing"}, GitHub: ${hasGithub ? "Present" : "Missing"}.`,
            recommendation: "Ensure email and verified portfolio/GitHub links are in the top header.",
        },
        {
            id: "file_health",
            label: "Document Health & File Size",
            status: filesizeBytes <= 5 * 1024 * 1024 ? "pass" : "fail",
            score: filesizeBytes <= 2 * 1024 * 1024 ? 100 : 80,
            description: `File size is ${(filesizeBytes / (1024 * 1024)).toFixed(2)} MB (limit: 5.00 MB).`,
            evidence: `File: ${filename} (${(filesizeBytes / 1024).toFixed(1)} KB).`,
            recommendation: "Keep resume PDF under 3 MB for instant recruiter mobile loading.",
        },
        {
            id: "profile_verification",
            label: "Orbix Profile Link & Proof-of-Work",
            status: hasVerifiedLinks || hasGithub ? "pass" : "warn",
            score: verificationScore,
            description: "Verifiable coding handles allow recruiters to inspect live ratings and repositories.",
            evidence: hasVerifiedLinks
                ? "Connected Orbix platform verification active."
                : (hasGithub ? "GitHub handle present in document." : "No verified coding profiles detected."),
            recommendation: "Connect your LeetCode, Codeforces, and GitHub profiles to back up your resume with live ratings.",
        },
    ];

    const missingKeywords = ["CI/CD", "Docker", "Unit Testing", "System Design", "Cloud Services (AWS/GCP)"].filter(
        (kw) => !textLower.includes(kw.toLowerCase())
    );

    return {
        analyzerVersion: "gemini-orbix-v2.0",
        modelUsed: "orbix-deterministic-engine",
        overallScore: overall,
        scoreGrade,
        targetRoleDetected,
        experienceLevel,
        summary: `Strong candidate profile for ${targetRoleDetected} (${experienceLevel}). Demonstrates solid grounding in ${detectedLanguages.slice(0, 3).join(", ") || "software development"} with active project implementations. Opportunities exist to strengthen quantifiable metrics and embed verified coding handles.`,
        scoreBreakdown: {
            impactAndMetrics: impactScore,
            technicalDepth: technicalScore,
            atsParsability: atsScore,
            clarityAndStructure: clarityScore,
            verifiedProfiles: verificationScore,
        },
        detectedSkills: {
            languages: detectedLanguages,
            frameworks: detectedFrameworks,
            databasesAndTools: detectedDatabasesAndTools,
            concepts: detectedConcepts,
        },
        strengths,
        improvements,
        checks,
        missingKeywords,
        roleSpecificTips: [
            "Highlight full-stack ownership by linking live demo URLs alongside GitHub repositories.",
            "Group technical skills logically (Languages, Frameworks, Developer Tools, Core Concepts) for fast parsing.",
            "Keep font sizes between 10pt and 12pt with standard margins for 1-page compact layout.",
        ],
        filename,
        filesizeBytes,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Primary entry point: Calls Google Gemini API if GEMINI_API_KEY is available;
 * seamlessly falls back to high-fidelity rule engine if key is absent or network fails.
 */
export async function analyzeResumeWithGemini(
    rawText: string,
    filename: string,
    filesizeBytes: number,
    verifiedPlatforms: CodingProfileEntry[] = []
): Promise<GeminiAnalysisReport> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return analyzeWithRuleEngine(rawText, filename, filesizeBytes, verifiedPlatforms);
    }

    try {
        const verifiedPlatformsText = verifiedPlatforms
            .map((p) => `- ${p.portal}: ${p.url} (Verified: ${p.verified})`)
            .join("\n") || "No verified external profiles yet.";

        const systemPrompt = `You are an elite Silicon Valley Technical Recruiter & Principal ATS Architecture Specialist for software engineers.
Analyze the following candidate resume text thoroughly. Evaluate technical depth, quantifiable impact, ATS linear structure, action verbs, and recruiter clarity.
Return a STRICT valid JSON object following this exact structure with NO markdown fences, NO preamble, and NO backticks:
{
  "analyzerVersion": "gemini-orbix-v2.0",
  "modelUsed": "gemini-2.0-flash",
  "overallScore": number (0-100),
  "scoreGrade": "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement",
  "targetRoleDetected": string (e.g. "Full Stack Engineer", "Backend Engineer", "Frontend Engineer", "AI/ML Engineer"),
  "experienceLevel": "Entry-Level" | "Mid-Level" | "Senior" | "Lead / Staff",
  "summary": string (3-4 sentences executive synthesis of candidate positioning),
  "scoreBreakdown": {
    "impactAndMetrics": number (0-100),
    "technicalDepth": number (0-100),
    "atsParsability": number (0-100),
    "clarityAndStructure": number (0-100),
    "verifiedProfiles": number (0-100)
  },
  "detectedSkills": {
    "languages": [string],
    "frameworks": [string],
    "databasesAndTools": [string],
    "concepts": [string]
  },
  "strengths": [
    { "title": string, "description": string }
  ],
  "improvements": [
    {
      "title": string,
      "category": "metrics" | "action_verbs" | "technical_keywords" | "structure" | "brevity",
      "issue": string,
      "suggestion": string,
      "exampleBefore": string,
      "exampleAfter": string
    }
  ],
  "checks": [
    {
      "id": string,
      "label": string,
      "status": "pass" | "warn" | "fail",
      "score": number,
      "description": string,
      "evidence": string,
      "recommendation": string
    }
  ],
  "missingKeywords": [string],
  "roleSpecificTips": [string]
}`;

        const userPrompt = `Candidate Document: ${filename} (${(filesizeBytes / 1024).toFixed(1)} KB)
Verified Candidate Platforms on Orbix:
${verifiedPlatformsText}

Resume Raw Text:
---
${rawText.slice(0, 8000)}
---

Provide the rigorous JSON evaluation now.`;

        // Attempt Gemini 2.0 Flash with JSON response mode
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        parts: [{ text: userPrompt }],
                    },
                ],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.2,
                },
            }),
        });

        if (!res.ok) {
            console.warn(`Gemini API returned ${res.status}. Falling back to rule engine.`);
            return analyzeWithRuleEngine(rawText, filename, filesizeBytes, verifiedPlatforms);
        }

        const data = await res.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            console.warn("Gemini response empty. Falling back to rule engine.");
            return analyzeWithRuleEngine(rawText, filename, filesizeBytes, verifiedPlatforms);
        }

        const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
        const parsed = JSON.parse(cleaned);

        return {
            ...parsed,
            analyzerVersion: "gemini-orbix-v2.0",
            modelUsed: "gemini-2.0-flash",
            filename,
            filesizeBytes,
            createdAt: new Date().toISOString(),
        };
    } catch (err: any) {
        console.warn("Gemini API call error:", err?.message || err);
        return analyzeWithRuleEngine(rawText, filename, filesizeBytes, verifiedPlatforms);
    }
}
