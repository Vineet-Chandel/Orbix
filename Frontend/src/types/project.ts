export type ProjectCategory =
    | "Full-Stack"
    | "Frontend"
    | "Backend"
    | "AI / ML"
    | "Distributed Systems"
    | "Open Source"
    | "Mobile"
    | "CLI / Developer Tool"
    | "Cloud & DevOps"
    | "Cybersecurity"
    | "Web3"
    | "Hardware / IoT"
    | "Other";

export type ProjectType =
    | "Web application"
    | "Mobile application"
    | "Desktop application"
    | "AI / Machine Learning"
    | "Developer tool"
    | "Open-source project"
    | "API / Backend service"
    | "Research project"
    | "Hardware / IoT project"
    | "Other";

export type DevelopmentStatus =
    | "In development"
    | "Completed"
    | "Maintenance"
    | "Experimental"
    | "Archived";

export interface ProjectFeature {
    id?: string;
    title: string;
    description?: string;
    iconOrImage?: string;
}

export interface ProjectExternalLink {
    id?: string;
    label: string;
    url: string;
    type?: string;
    isHidden?: boolean;
}

export interface ProjectGalleryImage {
    id?: string;
    url: string;
    caption?: string;
    type?: "screenshot" | "architecture" | "supporting";
    displayOrder?: number;
}

export interface ProjectStory {
    problemStatement?: string;
    motivation?: string;
    solution?: string;
    targetAudience?: string;
    differentiation?: string;
    challenges?: string;
    learnings?: string;
}

export interface ProjectContribution {
    myRole?: string;
    myResponsibilities?: string;
    isTeamProject?: boolean;
    teamMembers?: string[];
    contributionDescription?: string;
}

export interface ProjectAdditionalDetails {
    achievements?: string[];
    performanceMetrics?: Array<{ label: string; value: string }>;
    futureImprovements?: string[];
    challenges?: string[];
    deploymentInfo?: string;
    customFields?: Array<{ key: string; value: string }>;
    notes?: string;
}

export interface TechnologyItem {
    name: string;
    category?: string;
    verified?: boolean;
    confidence?: number;
}

export interface ProjectMediaUploadConfig {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
    folder: string;
    uploadUrl: string;
    maxBytes: number;
    allowedFormats: string[];
}

export interface FieldDiff {
    field: string;
    label: string;
    currentValue: any;
    extractedValue: any;
    lastExtractedValue: any;
    isOverridden: boolean;
    hasChanged: boolean;
    changeType: "added" | "modified" | "unchanged" | "conflict";
    recommendedAction: "preserve_user_edit" | "auto_update" | "review_needed";
}

export interface ProjectMergeAnalysis {
    projectId: string;
    repoUrl: string;
    checkedAt: string;
    hasDifferences: boolean;
    diffs: Record<string, FieldDiff>;
    statisticsUpdated: {
        stars: { before: number; after: number };
        forks: { before: number; after: number };
        language: { before: string | null; after: string | null };
    };
    autoMergeableFields: string[];
    userOverriddenFields: string[];
}

export interface ProjectItem {
    id: string;
    userId: string;
    title: string;
    slug: string;
    tagline?: string;
    description?: string;
    fullOverview?: string;
    category: string;
    projectType?: string;
    developmentStatus?: string;
    status: "draft" | "published";
    isPublished: boolean;
    isPinned: boolean;
    isRepoPrivate?: boolean;
    hideRepoUrl?: boolean;
    displayOrder: number;
    repoUrl?: string;
    repoName?: string;
    repoStars: number;
    repoForks: number;
    repoLicense?: string;
    repoLanguage?: string;
    repoPushedAt?: string;
    liveUrl?: string;
    demoVideoUrl?: string;
    documentationUrl?: string;
    apiDocUrl?: string;
    figmaUrl?: string;
    imageUrl?: string;
    coverImageUrl?: string;
    galleryImages: Array<ProjectGalleryImage | string>;
    technologies: string[];
    categorizedTechnologies?: Record<string, TechnologyItem[]>;
    features: ProjectFeature[];
    externalLinks: ProjectExternalLink[];
    architectureNotes?: string;
    problemStatement?: string;
    targetAudience?: string;
    story?: ProjectStory;
    contribution?: ProjectContribution;
    additionalDetails?: ProjectAdditionalDetails;
    rawExtractedData?: Record<string, any>;
    fieldOverrides?: Record<string, boolean>;
    lastSyncedAt?: string;
    syncMetadata?: Record<string, any>;
    shortDescription?: string;
    repositoryProvider?: string;
    repositoryOwner?: string;
    repositoryVisibility?: "public" | "private" | "internal";
    repositoryMetadata?: Record<string, any>;
    extractionStatus?: "pending" | "analyzing" | "completed" | "manual" | "incomplete" | "error";
    extractionCompleteness?: number;
    showOnProfile?: boolean;
    repositoryLinkVisibility?: "visible" | "hidden";
    createdAt: string;
    updatedAt: string;
}

export interface ProjectListResponse {
    success: boolean;
    count: number;
    maxCapacity: number;
    isCapacityReached: boolean;
    projects: ProjectItem[];
}

export interface PublicProjectsResponse {
    success: boolean;
    username: string;
    count: number;
    projects: ProjectItem[];
}

export interface CreateProjectInput {
    title: string;
    tagline?: string;
    description?: string;
    fullOverview?: string;
    category?: string;
    projectType?: string;
    developmentStatus?: string;
    status?: "draft" | "published";
    isPublished?: boolean;
    isPinned?: boolean;
    isRepoPrivate?: boolean;
    hideRepoUrl?: boolean;
    repoUrl?: string;
    repoName?: string;
    repoStars?: number;
    repoForks?: number;
    repoLicense?: string;
    repoLanguage?: string;
    liveUrl?: string;
    demoVideoUrl?: string;
    documentationUrl?: string;
    apiDocUrl?: string;
    figmaUrl?: string;
    imageUrl?: string;
    coverImageUrl?: string;
    galleryImages?: Array<ProjectGalleryImage | string>;
    technologies?: string[];
    categorizedTechnologies?: Record<string, TechnologyItem[]>;
    features?: Array<{ id?: string; title: string; description?: string; iconOrImage?: string } | string>;
    externalLinks?: ProjectExternalLink[];
    architectureNotes?: string;
    problemStatement?: string;
    targetAudience?: string;
    story?: ProjectStory;
    contribution?: ProjectContribution;
    additionalDetails?: ProjectAdditionalDetails;
    rawExtractedData?: Record<string, any>;
    fieldOverrides?: Record<string, boolean>;
    lastSyncedAt?: string;
    syncMetadata?: Record<string, any>;
    shortDescription?: string;
    repositoryProvider?: string;
    repositoryOwner?: string;
    repositoryVisibility?: "public" | "private" | "internal";
    repositoryMetadata?: Record<string, any>;
    extractionStatus?: "pending" | "analyzing" | "completed" | "manual" | "incomplete" | "error";
    extractionCompleteness?: number;
    showOnProfile?: boolean;
    repositoryLinkVisibility?: "visible" | "hidden";
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type FieldExtractionStatus = "extracted" | "not_found" | "incomplete" | "inferred";
export type ExtractionSource =
    | "github_metadata"
    | "languages_api"
    | "dependency_manifest"
    | "readme_markdown"
    | "readme_images"
    | "user_input"
    | "fallback";

export interface FieldScorecardEntry {
    field: string;
    label: string;
    status: FieldExtractionStatus;
    source: ExtractionSource;
    confidence: number;
    notes?: string;
}

export interface ExtractionScorecard {
    completenessScore: number;
    qualityTier: "Complete" | "High Quality" | "Moderate" | "Basic";
    fields: Record<string, FieldScorecardEntry>;
    missingInformation: string[];
    extractionWarnings: string[];
}

export interface ExtractedLanguageItem {
    name: string;
    bytes: number;
    percentage: number;
}

export interface ExtractedScreenshot {
    url: string;
    alt?: string;
    caption?: string;
}

export interface RepoAnalysisResult {
    title: string;
    tagline: string;
    description: string;
    category: string;
    repoUrl: string;
    repoName: string;
    repoStars: number;
    repoForks: number;
    repoLanguage: string | null;
    repoLicense: string | null;
    primaryLanguage?: string | null;
    license?: string | null;
    stars?: number;
    forks?: number;
    watchers?: number;
    openIssues?: number;
    openIssuesExplanation?: string;
    contributorCount?: number | null;
    languages?: ExtractedLanguageItem[];
    latestRelease?: {
        tagName: string;
        name: string | null;
        publishedAt: string;
        htmlUrl: string;
    } | null;
    technicalFacts?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        packageManagers: string[];
        devTools: string[];
        manifestFound: string | null;
    };
    inferredMetadata?: {
        technologies: string[];
        category: string;
    };
    liveUrl: string | null;
    demoVideoUrl?: string | null;
    documentationUrl?: string | null;
    screenshots?: ExtractedScreenshot[];
    technologies: string[];
    features: Array<{ title: string; description?: string }>;
    architectureNotes?: string | null;
    scorecard?: ExtractionScorecard;
}

export interface AnalyzeRepoResponse {
    success: boolean;
    message?: string;
    analysis?: RepoAnalysisResult;
    isUnsupportedProvider?: boolean;
    isLikelyPrivate?: boolean;
    owner?: string;
    repo?: string;
    repoName?: string;
    repoUrl?: string;
    canConnectGitHub?: boolean;
    canEnterManually?: boolean;
}

export type ProjectLifecycleStage =
    | "empty" // 0 projects
    | "repo_entered" // User inputted repository URL
    | "analyzing" // Analyzing repository via GitHub intelligence
    | "analyzed" // Analysis complete, awaiting user review
    | "editing" // User reviewing and editing fields (none permanently read-only)
    | "saving" // Saving draft or publishing
    | "saved_draft" // Saved as draft
    | "published" // Published live
    | "error"; // Analysis or validation error
