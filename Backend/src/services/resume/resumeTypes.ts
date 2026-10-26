export type CheckStatus = "pass" | "warn" | "fail" | "not_checked";

export interface ResumeFinding {
    id: string;
    checkId: string;
    title: string;
    status: CheckStatus;
    explanation: string;
    evidence?: string;
    recommendedFix: string;
    actionType?: "navigate_section" | "edit_bullets" | "add_section" | "fix_link" | "import_profile" | "tailor_role";
    targetSection?: string;
    fixPayload?: Record<string, any>;
}

export interface RecruiterCheckSummary {
    id: string;
    label: string;
    status: CheckStatus;
    description: string;
    findingsCount: number;
}

export interface ScoreBreakdown {
    documentStructure: number; // 0 - 25
    contentCompleteness: number; // 0 - 25
    readabilityAndImpact: number; // 0 - 25
    verificationAndLinks: number; // 0 - 25
    overallScore: number; // 0 - 100
}

export interface AnalysisReport {
    id: string;
    resumeId?: string;
    versionId?: string;
    analyzerVersion: string;
    overallScore: number;
    scoreBreakdown: ScoreBreakdown;
    findings: ResumeFinding[];
    checks: RecruiterCheckSummary[];
    disclaimer: string;
    createdAt: string;
}

export interface EducationEntry {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate?: string;
    endDate?: string;
    expectedGraduation?: string;
    cgpa?: string;
    location?: string;
    highlights?: string[];
}

export interface SkillCategory {
    category: string;
    items: string[];
}

export interface ProjectEntry {
    id: string;
    title: string;
    subtitle?: string;
    technologies: string[];
    liveUrl?: string;
    githubUrl?: string;
    startDate?: string;
    endDate?: string;
    bullets: string[];
}

export interface WorkExperienceEntry {
    id: string;
    company: string;
    role: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    bullets: string[];
}

export interface CodingProfileEntry {
    portal: string;
    username: string;
    url: string;
    verified: boolean;
    totalSolved?: number | undefined;
    contestRating?: number | undefined;
    globalRank?: string | undefined;
    badge?: string | undefined;
    lastSyncAt?: string | undefined;
    lastSyncStatus?: string | undefined;
}

export interface CertificationEntry {
    id: string;
    title: string;
    issuer?: string;
    date?: string;
    url?: string;
    description?: string;
}

export interface CustomContactLink {
    label: string;
    url: string;
}

export interface ContactInformation {
    fullName: string;
    headline?: string;
    email: string;
    phone?: string;
    location?: string;
    portfolioUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    customLinks?: CustomContactLink[];
    includeEmail: boolean;
    includePhone: boolean;
    includeLocation: boolean;
}

export interface ResumeContent {
    contact: ContactInformation;
    summary: string;
    education: EducationEntry[];
    skills: SkillCategory[];
    projects: ProjectEntry[];
    experience: WorkExperienceEntry[];
    codingProfiles: CodingProfileEntry[];
    certifications: CertificationEntry[];
    sectionOrder: string[];
    visibleSections: Record<string, boolean>;
}

export interface ResumeDocument {
    id: string;
    userId: string;
    username: string;
    title: string;
    targetRole: string;
    templateId: string;
    content: ResumeContent;
    completenessScore: number;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ResumeVersion {
    id: string;
    resumeId: string;
    userId: string;
    username: string;
    versionNumber: number;
    versionLabel: string;
    targetRole?: string;
    companyName?: string;
    jobDescription?: string;
    content: ResumeContent;
    createdAt: string;
}

export interface ProfileCompletenessMap {
    score: number;
    completedFields: string[];
    missingFields: {
        field: string;
        label: string;
        severity: "critical" | "recommended" | "optional";
        reason: string;
    }[];
    verifiedPlatformsCount: number;
    isStudent: boolean;
}

export interface ProfileImportSummary {
    profileData: ResumeContent;
    completenessMap: ProfileCompletenessMap;
    verifiedPlatforms: CodingProfileEntry[];
    unverifiedLinks: { portal: string; url: string; reason: string }[];
}

export interface JobMatchSkillItem {
    name: string;
    category?: string;
    foundInResume: boolean;
    contextInJob?: string;
}

export interface JobMatchReport {
    targetRole: string;
    companyName?: string;
    matchScore: number; // 0 - 100
    matchedSkills: JobMatchSkillItem[];
    missingSkills: JobMatchSkillItem[];
    experienceMatches: {
        requirement: string;
        evidenceFound: boolean;
        evidenceSnippet?: string;
    }[];
    projectHighlights: {
        projectTitle: string;
        relevanceReason: string;
        suggestedBulletsToEmphasize: string[];
    }[];
    suggestedSummaryRewrite?: string;
    suggestedBulletImprovements: {
        sectionId: "projects" | "experience";
        entryId: string;
        bulletIndex: number;
        originalBullet: string;
        improvedBullet: string;
        rationale: string;
    }[];
}

export interface ExportValidationResult {
    success: boolean;
    format: "pdf" | "docx";
    filesizeBytes: number;
    filesizeMb: number;
    pageCount: number;
    isUnder5Mb: boolean;
    extractedCharacters: number;
    textIntegrityPassed: boolean;
    verifiedTokensFound: string[];
    missingTokens: string[];
    warnings: string[];
}
