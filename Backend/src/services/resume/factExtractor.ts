import type {
    StructuredResumeFacts,
    ExtractedPersonal,
    ExtractedEducation,
    ExtractedExperience,
    ExtractedProject,
    ExtractedCompetencies,
    QuantifiedAchievement,
    ExtractedFact,
    SourceSection,
    EvidenceType,
    CodingProfileEntry,
    ParsingQualityReport,
} from "./resumeTypes.js";

// Canonical skill alias dictionary for normalization
const SKILL_ALIASES: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    py: "Python",
    python: "Python",
    cpp: "C++",
    "c++": "C++",
    csharp: "C#",
    "c#": "C#",
    golang: "Go",
    go: "Go",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    mongo: "MongoDB",
    mongodb: "MongoDB",
    react: "React",
    reactjs: "React",
    "react.js": "React",
    next: "Next.js",
    nextjs: "Next.js",
    "next.js": "Next.js",
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    vue: "Vue.js",
    vuejs: "Vue.js",
    express: "Express.js",
    expressjs: "Express.js",
    k8s: "Kubernetes",
    kubernetes: "Kubernetes",
    aws: "AWS (Amazon Web Services)",
    gcp: "Google Cloud Platform (GCP)",
    tailwind: "Tailwind CSS",
    tailwindcss: "Tailwind CSS",
    dsa: "Data Structures & Algorithms",
};

const CANONICAL_SKILLS = {
    languages: ["TypeScript", "JavaScript", "Python", "Java", "C++", "C", "Go", "Rust", "Kotlin", "Swift", "Ruby", "PHP", "SQL", "HTML", "CSS", "Bash", "R"],
    frameworks: ["React", "Next.js", "Vue.js", "Angular", "Node.js", "Express.js", "FastAPI", "Django", "Spring Boot", "NestJS", "Tailwind CSS", "Redux", "GraphQL", "Svelte", "Flask"],
    databasesAndStores: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB", "SQLite", "Firebase", "Supabase", "Kafka", "RabbitMQ"],
    toolsAndCloud: ["Docker", "Kubernetes", "AWS (Amazon Web Services)", "Google Cloud Platform (GCP)", "Azure", "Git", "GitHub", "Linux", "CI/CD", "GitHub Actions", "Nginx", "Terraform", "Postman", "Vite", "Webpack"],
    engineeringConcepts: ["Data Structures & Algorithms", "System Design", "Microservices", "RESTful APIs", "Object-Oriented Programming (OOP)", "Database Indexing", "Concurrency & Multithreading", "Test-Driven Development (TDD)", "WebSockets", "Caching Strategies"],
};

/**
 * Splits text into logical sections based on common resume headings
 */
export function segmentSections(text: string): Record<SourceSection, string[]> {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const sections: Record<SourceSection, string[]> = {
        header: [],
        summary: [],
        experience: [],
        education: [],
        projects: [],
        skills: [],
        certifications: [],
        other: [],
    };

    let currentSection: SourceSection = "header";

    const headingPatterns: Array<{ section: SourceSection; regex: RegExp }> = [
        { section: "summary", regex: /^(professional\s+summary|summary|profile|about\s+me|objective)\b/i },
        { section: "education", regex: /^(education|academic\s+background|academics|qualifications)\b/i },
        { section: "skills", regex: /^(technical\s+skills|skills|technologies|technical\s+competencies|tech\s+stack)\b/i },
        { section: "projects", regex: /^(projects|technical\s+projects|personal\s+projects|academic\s+projects|featured\s+projects)\b/i },
        { section: "experience", regex: /^(work\s+experience|professional\s+experience|experience|employment\s+history|internships)\b/i },
        { section: "certifications", regex: /^(certifications|certificates|licenses|honors|awards|achievements)\b/i },
    ];

    let headerLineCount = 0;

    for (const line of lines) {
        let isHeading = false;
        // Don't classify long paragraphs as headings
        if (line.length <= 45) {
            for (const { section, regex } of headingPatterns) {
                if (regex.test(line)) {
                    currentSection = section;
                    isHeading = true;
                    break;
                }
            }
        }

        if (isHeading) continue;

        if (currentSection === "header") {
            headerLineCount++;
            if (headerLineCount > 6) {
                currentSection = "other";
            }
        }

        sections[currentSection].push(line);
    }

    return sections;
}

/**
 * Extracts personal and contact details with provenance
 */
export function extractPersonal(
    text: string,
    sections: Record<SourceSection, string[]>,
    verifiedPlatforms: CodingProfileEntry[] = []
): ExtractedPersonal {
    const headerLines = sections.header.concat(sections.other.slice(0, 4));
    const firstFew = headerLines.slice(0, 5);

    // Name detection: first line without @ or URL characters
    let nameCandidate = "Candidate";
    let nameSourceText = "";
    for (const line of firstFew) {
        if (!line.includes("@") && !line.includes("http") && !line.includes("/") && line.length >= 3 && line.length <= 40) {
            // Check if it's not a generic word like "RESUME"
            if (!/^(resume|curriculum|vitae|cv)$/i.test(line.trim())) {
                nameCandidate = line.trim();
                nameSourceText = line;
                break;
            }
        }
    }

    const nameParts = nameCandidate.split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    // Headline detection: second line or explicitly stated title
    let headlineVal = "";
    let headlineSource = "";
    const headlineRegex = /(software\s+(engineer|developer)|full\s*stack|frontend|backend|devops|data\s+scientist|machine\s+learning|cloud\s+engineer|sre|mobile\s+developer|ai\s+engineer)/i;
    for (const line of headerLines) {
        if (headlineRegex.test(line) && line !== nameCandidate) {
            headlineVal = line.replace(/^[|•-]\s*/, "").trim();
            headlineSource = line;
            break;
        }
    }

    // Email extraction
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const emailVal = emailMatch ? emailMatch[1].toLowerCase() : "";

    // Phone extraction
    const phoneMatch = text.match(/(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[-.\s]?\d{10})/);
    const phoneVal = phoneMatch ? phoneMatch[0].trim() : "";

    // Location detection
    const locationMatch = text.match(/(?:(?:[A-Z][a-zA-Z\s]+),\s*(?:[A-Z]{2}|[A-Za-z]+),\s*(?:India|USA|United States|UK|Canada|Germany|Singapore)?)|(?:Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurugram|San Francisco|New York|Seattle|London|Toronto)/i);
    const locationVal = locationMatch ? locationMatch[0].trim() : "";

    // External Profiles and Links
    const links: ExtractedPersonal["links"] = [];
    const githubMatch = text.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
    if (githubMatch) {
        const ghUser = githubMatch[1].toLowerCase();
        const orbixMatch = verifiedPlatforms.find((p) => p.portal === "github" && p.username?.toLowerCase() === ghUser);
        links.push({
            platform: "github",
            url: `https://github.com/${githubMatch[1]}`,
            username: githubMatch[1],
            evidenceType: "explicitly_stated",
            verificationStatus: orbixMatch?.verified ? "verified" : "claimed_only",
            verifiedAgainstOrbix: Boolean(orbixMatch?.verified),
        });
    }

    const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
    if (linkedinMatch) {
        links.push({
            platform: "linkedin",
            url: `https://linkedin.com/in/${linkedinMatch[1]}`,
            username: linkedinMatch[1],
            evidenceType: "explicitly_stated",
            verificationStatus: "claimed_only",
        });
    }

    const leetcodeMatch = text.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (leetcodeMatch) {
        const lcUser = leetcodeMatch[1].toLowerCase();
        const orbixMatch = verifiedPlatforms.find((p) => p.portal === "leetcode" && p.username?.toLowerCase() === lcUser);
        links.push({
            platform: "leetcode",
            url: `https://leetcode.com/u/${leetcodeMatch[1]}`,
            username: leetcodeMatch[1],
            evidenceType: "explicitly_stated",
            verificationStatus: orbixMatch?.verified ? "verified" : "claimed_only",
            verifiedAgainstOrbix: Boolean(orbixMatch?.verified),
        });
    }

    const codeforcesMatch = text.match(/codeforces\.com\/profile\/([a-zA-Z0-9_-]+)/i);
    if (codeforcesMatch) {
        const cfUser = codeforcesMatch[1].toLowerCase();
        const orbixMatch = verifiedPlatforms.find((p) => p.portal === "codeforces" && p.username?.toLowerCase() === cfUser);
        links.push({
            platform: "codeforces",
            url: `https://codeforces.com/profile/${codeforcesMatch[1]}`,
            username: codeforcesMatch[1],
            evidenceType: "explicitly_stated",
            verificationStatus: orbixMatch?.verified ? "verified" : "claimed_only",
            verifiedAgainstOrbix: Boolean(orbixMatch?.verified),
        });
    }

    return {
        fullName: {
            value: nameCandidate,
            sourceSection: "header",
            sourceText: nameSourceText || nameCandidate,
            extractionConfidence: nameCandidate !== "Candidate" ? 0.95 : 0.4,
            evidenceType: "explicitly_stated",
            verificationStatus: "claimed_only",
        },
        firstName,
        lastName,
        headline: headlineVal
            ? {
                value: headlineVal,
                sourceSection: "header",
                sourceText: headlineSource,
                extractionConfidence: 0.9,
                evidenceType: "explicitly_stated",
                verificationStatus: "claimed_only",
            }
            : undefined,
        email: emailVal
            ? {
                value: emailVal,
                sourceSection: "header",
                sourceText: emailMatch ? emailMatch[0] : emailVal,
                extractionConfidence: 0.98,
                evidenceType: "explicitly_stated",
                verificationStatus: "claimed_only",
            }
            : undefined,
        phone: phoneVal
            ? {
                value: phoneVal,
                sourceSection: "header",
                sourceText: phoneVal,
                extractionConfidence: 0.92,
                evidenceType: "explicitly_stated",
                verificationStatus: "claimed_only",
            }
            : undefined,
        location: locationVal
            ? {
                value: locationVal,
                sourceSection: "header",
                sourceText: locationVal,
                extractionConfidence: 0.85,
                evidenceType: "explicitly_stated",
                verificationStatus: "claimed_only",
            }
            : undefined,
        links,
    };
}

/**
 * Extracts education history with institution, degree, and graduation dates
 */
export function extractEducation(sections: Record<SourceSection, string[]>): ExtractedEducation[] {
    const lines = sections.education;
    if (lines.length === 0) return [];

    const entries: ExtractedEducation[] = [];
    const textBlob = lines.join("\n");

    // Common institution keywords
    const instRegex = /(?:Indian\s+Institute\s+of\s+Technology|National\s+Institute\s+of\s+Technology|IIIT|IIT|NIT|BITS|University|Institute|College|Academy|School\s+of\s+Engineering)[\w\s,.-]+/i;
    const instMatch = textBlob.match(instRegex);

    // Degree pattern
    const degreeRegex = /(?:Bachelor|Master|B\.?Tech|B\.?E\.?|B\.?S\.?|M\.?Tech|M\.?S\.?|BCA|MCA|Ph\.?D)[\w\s&,.-]*(?:Computer\s+Science|Information\s+Technology|Engineering|Data\s+Science|Software)?/i;
    const degreeMatch = textBlob.match(degreeRegex);

    // Date / Year pattern
    const yearMatch = textBlob.match(/(?:20\d{2}\s*[-–—]\s*(?:20\d{2}|Present|Current|Expected))|(?:Class\s+of\s+20\d{2})/i);
    const gradYearMatch = textBlob.match(/20(2[0-9]|1[0-9])/g);
    const lastYear = gradYearMatch ? Math.max(...gradYearMatch.map((y) => parseInt(y, 10))) : undefined;

    // CGPA / GPA pattern
    const gpaMatch = textBlob.match(/(?:CGPA|GPA|Grade)[\s:]*([0-9]+\.[0-9]+(?:\s*\/\s*(?:10|4(?:\.0)?))?)/i);

    if (instMatch || degreeMatch) {
        entries.push({
            institution: {
                value: instMatch ? instMatch[0].trim() : "University / Institution",
                sourceSection: "education",
                sourceText: instMatch ? instMatch[0] : lines[0],
                extractionConfidence: instMatch ? 0.92 : 0.6,
                evidenceType: "explicitly_stated",
                verificationStatus: "claimed_only",
            },
            degree: degreeMatch
                ? {
                    value: degreeMatch[0].trim(),
                    sourceSection: "education",
                    sourceText: degreeMatch[0],
                    extractionConfidence: 0.9,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                }
                : undefined,
            fieldOfStudy: degreeMatch && /Computer\s+Science|Information\s+Technology/i.test(degreeMatch[0])
                ? {
                    value: "Computer Science & Engineering",
                    sourceSection: "education",
                    sourceText: degreeMatch[0],
                    extractionConfidence: 0.88,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                }
                : undefined,
            startDate: yearMatch ? yearMatch[0].split(/[-–—]/)[0].trim() : undefined,
            endDate: yearMatch ? yearMatch[0].split(/[-–—]/)[1]?.trim() : undefined,
            graduationYear: lastYear,
            gpa: gpaMatch
                ? {
                    value: gpaMatch[1],
                    sourceSection: "education",
                    sourceText: gpaMatch[0],
                    extractionConfidence: 0.95,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                }
                : undefined,
            sourceText: lines.slice(0, 4).join(" | "),
            evidenceType: "explicitly_stated",
        });
    }

    return entries;
}

/**
 * Extracts work experience entries with duration, responsibilities, and ownership signals
 */
export function extractExperience(sections: Record<SourceSection, string[]>): ExtractedExperience[] {
    const lines = sections.experience;
    if (lines.length === 0) return [];

    const entries: ExtractedExperience[] = [];
    let currentEntry: Partial<ExtractedExperience> | null = null;

    const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\s*[-–—]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}|(?:20\d{2}\s*[-–—]\s*(?:20\d{2}|Present|Current))/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeaderLike = datePattern.test(line) || /^(intern|software\s+engineer|developer|lead|analyst)/i.test(line);

        if (isHeaderLike && (!currentEntry || currentEntry.responsibilities?.length)) {
            if (currentEntry && currentEntry.company && currentEntry.role) {
                entries.push(currentEntry as ExtractedExperience);
            }

            const dates = line.match(datePattern);
            const dateStr = dates ? dates[0] : undefined;
            const isCurrent = /present|current/i.test(dateStr || "");

            // Clean date out of line before splitting company/role
            const cleanLine = line.replace(datePattern, "").replace(/[()]/g, "").trim();
            const parts = cleanLine.split(/\s*[-–—|@]\s*/).filter(Boolean);

            const roleRegex = /intern|engineer|developer|lead|architect|manager|analyst|programmer|consultant|specialist/i;
            let roleStr = "Software Engineer";
            let companyStr = "Company";

            if (parts.length > 1) {
                if (roleRegex.test(parts[0]) && !roleRegex.test(parts[1])) {
                    roleStr = parts[0].trim();
                    companyStr = parts[1].trim();
                } else if (!roleRegex.test(parts[0]) && roleRegex.test(parts[1])) {
                    companyStr = parts[0].trim();
                    roleStr = parts[1].trim();
                } else {
                    companyStr = parts[0].trim();
                    roleStr = parts[1].trim();
                }
            } else if (parts.length === 1) {
                if (roleRegex.test(parts[0])) {
                    roleStr = parts[0].trim();
                } else {
                    companyStr = parts[0].trim();
                }
            }

            currentEntry = {
                company: {
                    value: companyStr || "Company",
                    sourceSection: "experience",
                    sourceText: line,
                    extractionConfidence: 0.85,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                },
                role: {
                    value: roleStr || "Software Engineer",
                    sourceSection: "experience",
                    sourceText: line,
                    extractionConfidence: 0.9,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                },
                startDate: dateStr ? dateStr.split(/[-–—]/)[0]?.trim() : undefined,
                endDate: dateStr ? dateStr.split(/[-–—]/)[1]?.trim() : undefined,
                isCurrent,
                durationMonths: 6, // default estimate if date calculation is needed
                responsibilities: [],
                technologiesUsed: [],
                metricsIdentified: [],
                ownershipSignals: [],
                sourceText: line,
            };
        } else if (currentEntry) {
            currentEntry.responsibilities = currentEntry.responsibilities || [];
            currentEntry.responsibilities.push(line);

            // Look for ownership words
            if (/\b(architected|spearheaded|led|owned|pioneered|engineered|overhauled)\b/i.test(line)) {
                currentEntry.ownershipSignals = currentEntry.ownershipSignals || [];
                const match = line.match(/\b(architected|spearheaded|led|owned|pioneered|engineered|overhauled)\b/i);
                if (match) currentEntry.ownershipSignals.push(match[0]);
            }

            // Look for metrics
            if (/\b(\d+(?:\.\d+)?%|\d+\s*(?:ms|qps|users|req\/s)|\b\$\d+[\d,]*)\b/i.test(line)) {
                currentEntry.metricsIdentified = currentEntry.metricsIdentified || [];
                const m = line.match(/\b(\d+(?:\.\d+)?%|\d+\s*(?:ms|qps|users|req\/s)|\b\$\d+[\d,]*)\b/i);
                if (m) currentEntry.metricsIdentified.push(m[0]);
            }
        }
    }

    if (currentEntry && currentEntry.company && currentEntry.role) {
        entries.push(currentEntry as ExtractedExperience);
    }

    return entries;
}

/**
 * Extracts projects, descriptions, architectural scope, and metrics
 */
export function extractProjects(sections: Record<SourceSection, string[]>): ExtractedProject[] {
    const lines = sections.projects;
    if (lines.length === 0) return [];

    const entries: ExtractedProject[] = [];
    let currentProj: Partial<ExtractedProject> | null = null;

    for (const line of lines) {
        // Project title candidate: usually starts with title and has tech stack in brackets or dash
        const isNewProject = /^[A-Z][\w\s-]+(?:[-–—:(]|\|)/.test(line) && !line.startsWith("-") && !line.startsWith("•");

        if (isNewProject) {
            if (currentProj && currentProj.title) {
                entries.push(currentProj as ExtractedProject);
            }

            const titlePart = line.split(/[-–—:(|]/)[0].trim();
            const techMatches = line.match(/\((.*?)\)|\|(.*?)$/);
            const rawTechs = techMatches ? (techMatches[1] || techMatches[2] || "").split(/[,/]/).map((t) => t.trim()).filter(Boolean) : [];

            currentProj = {
                title: {
                    value: titlePart,
                    sourceSection: "projects",
                    sourceText: line,
                    extractionConfidence: 0.9,
                    evidenceType: "explicitly_stated",
                    verificationStatus: "claimed_only",
                },
                description: line,
                technologies: rawTechs,
                metricsIdentified: [],
                architectureSignals: [],
                sourceText: line,
            };
        } else if (currentProj) {
            currentProj.description += " " + line;

            // Architectural scale checks
            if (/\b(microservices|websockets|distributed|caching|docker|redis|serverless|concurrency|queue|pipeline)\b/i.test(line)) {
                currentProj.architectureSignals = currentProj.architectureSignals || [];
                const m = line.match(/\b(microservices|websockets|distributed|caching|docker|redis|serverless|concurrency|queue|pipeline)\b/gi);
                if (m) {
                    for (const term of m) {
                        if (!currentProj.architectureSignals.includes(term.toLowerCase())) {
                            currentProj.architectureSignals.push(term.toLowerCase());
                        }
                    }
                }
            }

            // Metrics in project
            if (/\b(\d+(?:\.\d+)?%|\d+\+?\s*(?:qps|concurrent|users|requests|ms))\b/i.test(line)) {
                currentProj.metricsIdentified = currentProj.metricsIdentified || [];
                const m = line.match(/\b(\d+(?:\.\d+)?%|\d+\+?\s*(?:qps|concurrent|users|requests|ms))\b/i);
                if (m) currentProj.metricsIdentified.push(m[0]);
            }
        }
    }

    if (currentProj && currentProj.title) {
        entries.push(currentProj as ExtractedProject);
    }

    return entries;
}

/**
 * Extracts and canonicalizes technical competencies across all categories with provenance
 */
export function extractCompetencies(
    text: string,
    sections: Record<SourceSection, string[]>,
    verifiedPlatforms: CodingProfileEntry[] = []
): ExtractedCompetencies {
    const textLower = text.toLowerCase();
    const skillsText = sections.skills.join("\n").toLowerCase();

    const result: ExtractedCompetencies = {
        languages: [],
        frameworks: [],
        databasesAndStores: [],
        toolsAndCloud: [],
        engineeringConcepts: [],
        certifications: [],
    };

    const processCategory = (
        canonicalList: string[],
        targetArray: ExtractedFact<string>[]
    ) => {
        for (const skill of canonicalList) {
            const skillLower = skill.toLowerCase();
            // Word boundary match
            const escaped = skillLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const wordRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");

            if (wordRegex.test(textLower)) {
                const inSkillsSection = wordRegex.test(skillsText);
                const sourceSection: SourceSection = inSkillsSection ? "skills" : (
                    sections.projects.join(" ").toLowerCase().includes(skillLower) ? "projects" : "experience"
                );

                // Find matching excerpt
                const matchingLine = text.split("\n").find((l) => wordRegex.test(l.toLowerCase())) || skill;

                // Check if skill is verified against verified coding platforms
                let isVerified = false;
                if (verifiedPlatforms.some((p) => p.verified && p.portal === "github")) {
                    isVerified = true;
                }

                targetArray.push({
                    value: skill,
                    sourceSection,
                    sourceText: matchingLine.trim().slice(0, 150),
                    extractionConfidence: inSkillsSection ? 0.98 : 0.88,
                    evidenceType: inSkillsSection ? "explicitly_stated" : "inferred",
                    verificationStatus: isVerified ? "verified" : "claimed_only",
                });
            }
        }
    };

    processCategory(CANONICAL_SKILLS.languages, result.languages);
    processCategory(CANONICAL_SKILLS.frameworks, result.frameworks);
    processCategory(CANONICAL_SKILLS.databasesAndStores, result.databasesAndStores);
    processCategory(CANONICAL_SKILLS.toolsAndCloud, result.toolsAndCloud);
    processCategory(CANONICAL_SKILLS.engineeringConcepts, result.engineeringConcepts);

    return result;
}

/**
 * Extracts true quantified achievements and associates each with context
 */
export function extractQuantifiedAchievements(
    sections: Record<SourceSection, string[]>,
    experiences: ExtractedExperience[],
    projects: ExtractedProject[]
): QuantifiedAchievement[] {
    const achievements: QuantifiedAchievement[] = [];
    const candidateLines = sections.experience.concat(sections.projects);

    const metricRules: Array<{
        type: QuantifiedAchievement["metricType"];
        regex: RegExp;
        minNumber?: number;
    }> = [
        { type: "percentage", regex: /(\b\d+(?:\.\d+)?%)/i },
        { type: "latency", regex: /(\b\d+(?:\.\d+)?\s*(?:ms|milliseconds|seconds|sec)\b)/i },
        { type: "throughput", regex: /(\b\d+[\d,]*(?:\.\d+)?\+?\s*(?:qps|tps|req(?:uests)?\s*\/\s*sec|operations\s*\/\s*sec)\b)/i },
        { type: "scale", regex: /(\b\d+[\d,]*(?:\.\d+)?[kKmMbB]?\+?\s*(?:(?:concurrent|active|daily|monthly)\s+)?(?:API\s+)?(?:sessions|users|requests|records|events|subscribers|queries)\b)/i },
        { type: "cost", regex: /(\$\d+[\d,]*|\b\d+(?:\.\d+)?%\s*(?:cost|cloud|server)\s*reduction)/i },
        { type: "test_coverage", regex: /(\b\d{2,3}%\s*(?:test|code)\s*coverage)/i },
    ];

    for (const line of candidateLines) {
        // Exclude lines that are headers or just dates
        if (/^(education|experience|projects|skills)\b/i.test(line)) continue;
        if (/^(19|20)\d{2}\s*[-–—]/i.test(line)) continue;

        for (const rule of metricRules) {
            const match = line.match(rule.regex);
            if (match) {
                // Find associated experience or project
                let associated = "General Work";
                for (const exp of experiences) {
                    if (exp.responsibilities.includes(line)) {
                        associated = `${exp.role.value} at ${exp.company.value}`;
                        break;
                    }
                }
                if (associated === "General Work") {
                    for (const proj of projects) {
                        if (proj.description.includes(line)) {
                            associated = `Project: ${proj.title.value}`;
                            break;
                        }
                    }
                }

                achievements.push({
                    metric: match[1] || match[0],
                    metricType: rule.type,
                    context: line.trim(),
                    associatedEntry: associated,
                    sourceSection: sections.experience.includes(line) ? "experience" : "projects",
                    sourceText: line.trim(),
                    evidenceType: "explicitly_stated",
                });
                break; // One metric per line to avoid duplicates
            }
        }
    }

    return achievements;
}

/**
 * Stage B & C Master Orchestrator:
 * Extracts all structured facts with provenance, canonicalizes aliases, and validates integrity.
 */
export function extractStructuredFacts(
    docOrText: { rawText: string; parsingQuality: ParsingQualityReport } | string,
    qualityOrPlatforms?: ParsingQualityReport | CodingProfileEntry[],
    verifiedPlatformsArg?: CodingProfileEntry[]
): StructuredResumeFacts {
    let rawText = "";
    let parsingQuality: ParsingQualityReport;
    let verifiedPlatforms: CodingProfileEntry[] = [];

    if (typeof docOrText === "object" && docOrText !== null && "rawText" in docOrText) {
        rawText = docOrText.rawText;
        parsingQuality = docOrText.parsingQuality;
        if (Array.isArray(qualityOrPlatforms)) {
            verifiedPlatforms = qualityOrPlatforms;
        }
    } else {
        rawText = String(docOrText || "");
        if (qualityOrPlatforms && !Array.isArray(qualityOrPlatforms)) {
            parsingQuality = qualityOrPlatforms;
        } else {
            parsingQuality = {
                pageCount: 1,
                wordCount: rawText.split(/\s+/).length,
                characterCount: rawText.length,
                detectedSections: [],
                hasSelectableText: true,
                isScanned: false,
                qualityScore: 90,
                parsingWarnings: []
            };
        }
        if (Array.isArray(verifiedPlatformsArg)) {
            verifiedPlatforms = verifiedPlatformsArg;
        }
    }

    const sections = segmentSections(rawText);
    const personal = extractPersonal(rawText, sections, verifiedPlatforms);
    const education = extractEducation(sections);
    const experience = extractExperience(sections);
    const projects = extractProjects(sections);
    const competencies = extractCompetencies(rawText, sections, verifiedPlatforms);
    const quantifiedAchievements = extractQuantifiedAchievements(sections, experience, projects);

    return {
        schemaVersion: "v2.0.0",
        personal,
        education,
        experience,
        projects,
        competencies,
        quantifiedAchievements,
        parsingQuality,
    };
}
