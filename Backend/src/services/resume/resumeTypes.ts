export type CheckStatus = "pass" | "warn" | "fail" | "not_checked";

export type SourceSection =
    | "header"
    | "summary"
    | "experience"
    | "education"
    | "projects"
    | "skills"
    | "certifications"
    | "other";

export type EvidenceType = "explicitly_stated" | "inferred" | "externally_verified";

export type VerificationStatus = "verified" | "unverified" | "claimed_only" | "conflicting";

export interface ExtractedFact<T = string> {
    value: T;
    sourceSection: SourceSection;
    sourceText: string;
    pageNumber?: number;
    extractionConfidence: number; // 0.0 - 1.0
    evidenceType: EvidenceType;
    verificationStatus: VerificationStatus;
}

export interface ExtractedPersonal {
    fullName: ExtractedFact<string>;
    firstName?: string;
    lastName?: string;
    headline?: ExtractedFact<string>;
    email?: ExtractedFact<string>;
    phone?: ExtractedFact<string>;
    location?: ExtractedFact<string>;
    links: Array<{
        platform: string;
        url: string;
        username?: string;
        evidenceType: EvidenceType;
        verificationStatus: VerificationStatus;
        verifiedAgainstOrbix?: boolean;
    }>;
}

export interface ExtractedEducation {
    institution: ExtractedFact<string>;
    degree?: ExtractedFact<string>;
    fieldOfStudy?: ExtractedFact<string>;
    startDate?: string;
    endDate?: string;
    graduationYear?: number;
    gpa?: ExtractedFact<string>;
    sourceText: string;
    evidenceType: EvidenceType;
}

export interface ExtractedExperience {
    company: ExtractedFact<string>;
    role: ExtractedFact<string>;
    durationMonths?: number;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    responsibilities: string[];
    technologiesUsed: string[];
    metricsIdentified: string[];
    ownershipSignals: string[];
    sourceText: string;
}

export interface ExtractedProject {
    title: ExtractedFact<string>;
    description: string;
    technologies: string[];
    liveUrl?: string;
    githubUrl?: string;
    metricsIdentified: string[];
    architectureSignals: string[];
    sourceText: string;
}

export interface ExtractedCompetencies {
    languages: ExtractedFact<string>[];
    frameworks: ExtractedFact<string>[];
    databasesAndStores: ExtractedFact<string>[];
    toolsAndCloud: ExtractedFact<string>[];
    engineeringConcepts: ExtractedFact<string>[];
    certifications: ExtractedFact<string>[];
}

export interface QuantifiedAchievement {
    metric: string;
    metricType: "percentage" | "latency" | "throughput" | "scale" | "cost" | "test_coverage" | "other";
    context: string;
    associatedEntry: string;
    sourceSection: SourceSection;
    sourceText: string;
    evidenceType: EvidenceType;
}

export interface ParsingQualityReport {
    pageCount: number;
    wordCount: number;
    characterCount: number;
    detectedSections: string[];
    hasSelectableText: boolean;
    isScanned: boolean;
    qualityScore: number; // 0 - 100
    parsingWarnings: string[];
}

export interface StructuredResumeFacts {
    schemaVersion: string;
    personal: ExtractedPersonal;
    education: ExtractedEducation[];
    experience: ExtractedExperience[];
    projects: ExtractedProject[];
    competencies: ExtractedCompetencies;
    quantifiedAchievements: QuantifiedAchievement[];
    parsingQuality: ParsingQualityReport;
}

export type ScoringDimensionKey =
    | "impactAndMetrics"
    | "technicalDepth"
    | "targetRoleAlignment"
    | "atsStructure"
    | "clarityAndActionWriting"
    | "verifiedProfiles"
    | "contactAndCompleteness";

export interface SubcriterionResult {
    id: string;
    label: string;
    score: number; // 0 - 100
    maxScore: number;
    weight: number; // Decimal fraction within dimension
    evidence: string;
    explanation: string;
}

export interface DimensionScoreResult {
    dimensionKey: ScoringDimensionKey;
    label: string;
    weight: number; // e.g. 0.25 (25%)
    score: number; // 0 - 100
    assessed: boolean;
    subcriteria: SubcriterionResult[];
    explanation: string;
    strengths: string[];
    weaknesses: string[];
}

export interface ComprehensiveScoringResult {
    overallScore: number; // 0 - 100
    scoreGrade: "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement";
    formula: string;
    scoringVersion: string; // e.g. "v2.0.0"
    dimensions: Record<ScoringDimensionKey, DimensionScoreResult>;
    totalAssessedWeight: number;
    resumeReadinessScore: number; // 0 - 100
    extractionConfidence: number; // 0 - 100
    analysisConfidence: number; // 0 - 100
    confidenceDefinitions: {
        readiness: string;
        extraction: string;
        analysis: string;
    };
    explanationSummary: string;
}

export interface RoleSeniorityIntelligence {
    primaryTargetRole: string;
    secondaryTargetRole?: string;
    seniorityLevel: "Intern" | "Entry-Level (0-2 yrs)" | "Mid-Level (2-5 yrs)" | "Senior (5-8 yrs)" | "Lead / Staff (8+ yrs)";
    estimatedYearsExperience: number;
    roleConfidence: number; // 0 - 100
    reasoning: string;
    evidenceHighlights: string[];
}

export interface ProposedSyncField {
    fieldKey: "headline" | "bio" | "location" | "website" | "github" | "linkedin" | "skills" | "college";
    label: string;
    currentProfileValue: any;
    proposedValue: any;
    isMissingInProfile: boolean;
    confidence: number;
    sourceExcerpt: string;
}

export interface ProfileSyncProposal {
    proposedFields: ProposedSyncField[];
    totalEligibleFields: number;
    hasMissingFields: boolean;
}

export interface PersonalizedImprovement {
    id: string;
    dimensionKey: ScoringDimensionKey;
    category: "metrics" | "action_verbs" | "technical_depth" | "ats_structure" | "brevity" | "role_alignment";
    title: string;
    issue: string;
    suggestion: string;
    exampleBefore?: string;
    exampleAfter?: string;
    groundedContext: string;
}

export interface RecruiterCheck {
    id: string;
    label: string;
    dimensionKey: ScoringDimensionKey;
    status: CheckStatus;
    score: number;
    description: string;
    evidence: string;
    recommendation: string;
}

export interface ComprehensiveIntelligenceReport {
    analyzerVersion: string;
    modelUsed: string;
    filename: string;
    filesizeBytes: number;
    createdAt: string;

    overallScore: number;
    scoreGrade: "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement";
    summary: string;

    scoring: ComprehensiveScoringResult;
    roleIntelligence: RoleSeniorityIntelligence;
    structuredFacts: StructuredResumeFacts;
    profileSyncProposal: ProfileSyncProposal;

    strengths: Array<{ title: string; description: string }>;
    improvements: PersonalizedImprovement[];
    checks: RecruiterCheck[];
    missingKeywords: string[];
    roleSpecificTips: string[];

    // Backwards-compatibility helper fields
    targetRoleDetected: string;
    experienceLevel: string;
    scoreBreakdown: {
        impactAndMetrics: number;
        technicalDepth: number;
        targetRoleAlignment: number;
        atsParsability: number;
        clarityAndStructure: number;
        verifiedProfiles: number;
        contactCompleteness: number;
    };
    detectedSkills: {
        languages: string[];
        frameworks: string[];
        databasesAndTools: string[];
        concepts: string[];
    };
}

// Retain legacy interfaces for backward-compatibility with other modules
export type GeminiAnalysisReport = ComprehensiveIntelligenceReport;

export interface ResumeFinding {
    id: string;
    checkId: string;
    title: string;
    status: CheckStatus;
    explanation: string;
    evidence?: string;
    recommendedFix: string;
}

export interface RecruiterCheckSummary {
    id: string;
    label: string;
    status: CheckStatus;
    description: string;
    findingsCount: number;
}

export interface ScoreBreakdown {
    documentStructure: number;
    contentCompleteness: number;
    readabilityAndImpact: number;
    verificationAndLinks: number;
    overallScore: number;
}

export interface AnalysisReport {
    id: string;
    analyzerVersion: string;
    overallScore: number;
    scoreBreakdown: ScoreBreakdown;
    findings: ResumeFinding[];
    checks: RecruiterCheckSummary[];
    disclaimer: string;
    createdAt: string;
}

export interface CodingProfileEntry {
    portal: string;
    username: string;
    url: string;
    verified: boolean;
    totalSolved?: number;
    contestRating?: number;
    globalRank?: string;
    badge?: string;
    lastSyncAt?: string;
    lastSyncStatus?: string;
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

export interface CertificationEntry {
    id: string;
    title: string;
    issuer?: string;
    date?: string;
    url?: string;
    description?: string;
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
    includeEmail?: boolean;
    includePhone?: boolean;
    includeLocation?: boolean;
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
