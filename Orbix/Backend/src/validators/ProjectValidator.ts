import validator from "../utils/validation.js";

export class ProjectValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProjectValidationError";
    }
}

function sanitizeSafeString(val: any, maxLen: number, fieldName: string, required = false): string {
    if (val === undefined || val === null) {
        if (required) {
            throw new ProjectValidationError(`${fieldName} is required.`);
        }
        return "";
    }
    if (typeof val !== "string") {
        throw new ProjectValidationError(`${fieldName} must be a valid text string.`);
    }
    const clean = val.trim();
    if (required && clean.length === 0) {
        throw new ProjectValidationError(`${fieldName} cannot be empty.`);
    }
    if (clean.length > maxLen) {
        throw new ProjectValidationError(`${fieldName} exceeds maximum length of ${maxLen} characters.`);
    }
    return clean;
}

function sanitizeSafeUrl(val: any, fieldName: string, required = false): string | null {
    if (!val || typeof val !== "string" || !val.trim()) {
        if (required) {
            throw new ProjectValidationError(`${fieldName} URL is required.`);
        }
        return null;
    }
    const clean = val.trim();
    if (clean.length > 1000) {
        throw new ProjectValidationError(`${fieldName} URL is too long.`);
    }
    // Only permit http or https
    if (!/^https?:\/\//i.test(clean)) {
        throw new ProjectValidationError(`${fieldName} must start with http:// or https://`);
    }
    if (!validator.isURL(clean, { require_protocol: true })) {
        throw new ProjectValidationError(`Please provide a valid URL for ${fieldName}.`);
    }
    return clean;
}

export interface ValidatedProjectInput {
    title: string;
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
    repoUrl?: string | null;
    repoName?: string | null;
    repoStars?: number;
    repoForks?: number;
    repoLicense?: string | null;
    repoLanguage?: string | null;
    liveUrl?: string | null;
    demoVideoUrl?: string | null;
    documentationUrl?: string | null;
    apiDocUrl?: string | null;
    figmaUrl?: string | null;
    imageUrl?: string | null;
    galleryImages: Array<{ id?: string; url: string; caption?: string; type?: string; displayOrder?: number } | string>;
    technologies: string[];
    categorizedTechnologies?: Record<string, Array<{ name: string; category?: string; verified?: boolean; confidence?: number }>>;
    features: Array<{ id?: string; title: string; description?: string; iconOrImage?: string }>;
    externalLinks: Array<{ id?: string; label: string; url: string; type?: string; isHidden?: boolean }>;
    architectureNotes?: string | null;
    story?: {
        problemStatement?: string;
        motivation?: string;
        solution?: string;
        targetAudience?: string;
        differentiation?: string;
        challenges?: string;
        learnings?: string;
    };
    contribution?: {
        myRole?: string;
        myResponsibilities?: string;
        isTeamProject?: boolean;
        teamMembers?: string[];
        contributionDescription?: string;
    };
    additionalDetails?: {
        achievements?: string[];
        performanceMetrics?: Array<{ label: string; value: string }>;
        futureImprovements?: string[];
        challenges?: string[];
        deploymentInfo?: string;
        customFields?: Array<{ key: string; value: string }>;
        notes?: string;
    };
    rawExtractedData?: Record<string, any>;
    fieldOverrides?: Record<string, boolean>;
    lastSyncedAt?: string | null;
    syncMetadata?: Record<string, any>;
    shortDescription?: string;
    problemStatement?: string;
    targetAudience?: string;
    repositoryProvider?: string;
    repositoryOwner?: string;
    repositoryVisibility?: "public" | "private" | "internal";
    repositoryMetadata?: Record<string, any>;
    extractionStatus?: "pending" | "analyzing" | "completed" | "manual" | "incomplete" | "error";
    extractionCompleteness?: number;
    showOnProfile?: boolean;
    repositoryLinkVisibility?: "visible" | "hidden";
}

export function validateProjectPayload(data: any, isUpdate = false): ValidatedProjectInput {
    if (!data || typeof data !== "object") {
        throw new ProjectValidationError("Invalid project payload: expected an object.");
    }

    const title = sanitizeSafeString(data.title, 150, "Project Title", !isUpdate || data.title !== undefined);
    const tagline = sanitizeSafeString(data.tagline, 255, "Project Tagline", false);
    const description = sanitizeSafeString(data.description, 10000, "Project Description", false);
    const fullOverview = sanitizeSafeString(data.fullOverview, 50000, "Full Project Overview", false);
    const architectureNotes = sanitizeSafeString(data.architectureNotes, 10000, "Architecture Notes", false);

    const validCategories = [
        "Full-Stack",
        "Frontend",
        "Backend",
        "AI / ML",
        "Distributed Systems",
        "Open Source",
        "Mobile",
        "CLI / Developer Tool",
        "Cloud & DevOps",
        "Cybersecurity",
        "Web3",
        "Hardware / IoT",
        "Other",
    ];
    let category = "Full-Stack";
    if (data.category && typeof data.category === "string" && data.category.trim()) {
        const catClean = data.category.trim();
        category = validCategories.find((c) => c.toLowerCase() === catClean.toLowerCase()) || catClean.slice(0, 50);
    }

    // Section A: Project Type
    const validProjectTypes = [
        "Web application",
        "Mobile application",
        "Desktop application",
        "AI / Machine Learning",
        "Developer tool",
        "Open-source project",
        "API / Backend service",
        "Research project",
        "Hardware / IoT project",
        "Other",
    ];
    let projectType = "Web application";
    if (data.projectType && typeof data.projectType === "string" && data.projectType.trim()) {
        const ptClean = data.projectType.trim();
        projectType = validProjectTypes.find((t) => t.toLowerCase() === ptClean.toLowerCase()) || ptClean.slice(0, 60);
    }

    // Section A: Development Status
    const validDevStatuses = [
        "In development",
        "Completed",
        "Maintenance",
        "Experimental",
        "Archived",
    ];
    let developmentStatus = "Completed";
    if (data.developmentStatus && typeof data.developmentStatus === "string" && data.developmentStatus.trim()) {
        const dsClean = data.developmentStatus.trim();
        developmentStatus = validDevStatuses.find((s) => s.toLowerCase() === dsClean.toLowerCase()) || dsClean.slice(0, 40);
    }

    // Status and publication
    const isPublished = Boolean(data.isPublished || data.status === "published");
    const status: "draft" | "published" = isPublished ? "published" : "draft";
    const isPinned = Boolean(data.isPinned);
    const isRepoPrivate = Boolean(data.isRepoPrivate);
    const hideRepoUrl = Boolean(data.hideRepoUrl);

    // URLs
    const repoUrl = sanitizeSafeUrl(data.repoUrl, "Repository", false);
    const liveUrl = sanitizeSafeUrl(data.liveUrl, "Live Demo", false);
    const demoVideoUrl = sanitizeSafeUrl(data.demoVideoUrl, "Demo Video", false);
    const documentationUrl = sanitizeSafeUrl(data.documentationUrl, "Documentation", false);
    const apiDocUrl = sanitizeSafeUrl(data.apiDocUrl, "API Documentation", false);
    const figmaUrl = sanitizeSafeUrl(data.figmaUrl, "Figma Preview", false);
    const imageUrl = sanitizeSafeUrl(data.imageUrl, "Thumbnail Image", false);

    const repoName = sanitizeSafeString(data.repoName, 150, "Repository Name", false) || null;
    const repoStars = typeof data.repoStars === "number" && !isNaN(data.repoStars) ? Math.max(0, Math.floor(data.repoStars)) : 0;
    const repoForks = typeof data.repoForks === "number" && !isNaN(data.repoForks) ? Math.max(0, Math.floor(data.repoForks)) : 0;
    const repoLicense = sanitizeSafeString(data.repoLicense, 100, "Repository License", false) || null;
    const repoLanguage = sanitizeSafeString(data.repoLanguage, 60, "Repository Language", false) || null;

    // Gallery images (screenshots, architecture diagrams, supporting images)
    const galleryImages: Array<{ id?: string; url: string; caption?: string; type?: string; displayOrder?: number } | string> = [];
    if (Array.isArray(data.galleryImages)) {
        for (const img of data.galleryImages.slice(0, 10)) {
            if (typeof img === "string") {
                const valid = sanitizeSafeUrl(img, "Gallery image", false);
                if (valid) galleryImages.push(valid);
            } else if (img && typeof img === "object") {
                const validUrl = sanitizeSafeUrl(img.url, "Gallery image URL", false);
                if (validUrl) {
                    galleryImages.push({
                        id: sanitizeSafeString(img.id, 50, "Gallery ID", false) || undefined,
                        url: validUrl,
                        caption: sanitizeSafeString(img.caption, 255, "Caption", false) || undefined,
                        type: sanitizeSafeString(img.type, 30, "Image type", false) || "screenshot",
                        displayOrder: typeof img.displayOrder === "number" ? img.displayOrder : 0,
                    });
                }
            }
        }
    }

    // Technologies
    const technologies: string[] = [];
    if (Array.isArray(data.technologies)) {
        for (const t of data.technologies.slice(0, 30)) {
            if (typeof t === "string" && t.trim()) {
                const clean = t.trim().slice(0, 50);
                if (!technologies.includes(clean)) {
                    technologies.push(clean);
                }
            }
        }
    }

    // Categorized Technologies (Section D)
    let categorizedTechnologies: Record<string, Array<{ name: string; category?: string; verified?: boolean; confidence?: number }>> | undefined = undefined;
    if (data.categorizedTechnologies && typeof data.categorizedTechnologies === "object" && !Array.isArray(data.categorizedTechnologies)) {
        categorizedTechnologies = {};
        for (const [cat, items] of Object.entries(data.categorizedTechnologies)) {
            const cleanCat = sanitizeSafeString(cat, 50, "Category Name", false);
            if (cleanCat && Array.isArray(items)) {
                categorizedTechnologies[cleanCat] = [];
                for (const item of (items as any[]).slice(0, 20)) {
                    if (typeof item === "string" && item.trim()) {
                        categorizedTechnologies[cleanCat].push({ name: item.trim().slice(0, 50), category: cleanCat, verified: false });
                    } else if (item && typeof item === "object" && item.name) {
                        const cleanName = sanitizeSafeString(item.name, 50, "Technology Name", false);
                        if (cleanName) {
                            categorizedTechnologies[cleanCat].push({
                                name: cleanName,
                                category: cleanCat,
                                verified: Boolean(item.verified),
                                confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 1,
                            });
                        }
                    }
                }
            }
        }
    }

    // Features (Section C)
    const features: Array<{ id?: string; title: string; description?: string; iconOrImage?: string }> = [];
    if (Array.isArray(data.features)) {
        for (const f of data.features.slice(0, 20)) {
            if (typeof f === "string" && f.trim()) {
                features.push({ title: f.trim().slice(0, 255) });
            } else if (f && typeof f === "object") {
                const ft = sanitizeSafeString(f.title, 255, "Feature Title", false);
                const fd = sanitizeSafeString(f.description, 1000, "Feature Description", false);
                const iconOrImage = sanitizeSafeString(f.iconOrImage, 500, "Feature Icon/Image", false);
                const fid = sanitizeSafeString(f.id, 50, "Feature ID", false);
                if (ft) {
                    features.push({
                        id: fid || undefined,
                        title: ft,
                        description: fd || undefined,
                        iconOrImage: iconOrImage || undefined,
                    });
                }
            }
        }
    }

    // External links (Section E)
    const externalLinks: Array<{ id?: string; label: string; url: string; type?: string; isHidden?: boolean }> = [];
    if (Array.isArray(data.externalLinks)) {
        for (const l of data.externalLinks.slice(0, 10)) {
            if (l && typeof l === "object") {
                const validUrl = sanitizeSafeUrl(l.url, "External link URL", false);
                const label = sanitizeSafeString(l.label || l.title || "Link", 50, "External link label", false);
                const type = sanitizeSafeString(l.type, 30, "External link type", false);
                const lid = sanitizeSafeString(l.id, 50, "Link ID", false);
                if (validUrl) {
                    externalLinks.push({
                        id: lid || undefined,
                        label: label || "Link",
                        url: validUrl,
                        type: type || undefined,
                        isHidden: Boolean(l.isHidden),
                    });
                }
            }
        }
    }

    // Project Story (Section B)
    let story: ValidatedProjectInput["story"] = undefined;
    const problemStatementInput = data.problemStatement || data.story?.problemStatement;
    const targetAudienceInput = data.targetAudience || data.story?.targetAudience;
    if ((data.story && typeof data.story === "object") || problemStatementInput || targetAudienceInput) {
        const rawStory = (data.story && typeof data.story === "object") ? data.story : {};
        story = {
            problemStatement: sanitizeSafeString(problemStatementInput, 5000, "Problem Statement", false) || undefined,
            motivation: sanitizeSafeString(rawStory.motivation, 5000, "Motivation", false) || undefined,
            solution: sanitizeSafeString(rawStory.solution, 5000, "Solution", false) || undefined,
            targetAudience: sanitizeSafeString(targetAudienceInput, 2000, "Target Audience", false) || undefined,
            differentiation: sanitizeSafeString(rawStory.differentiation, 2000, "Differentiation", false) || undefined,
            challenges: sanitizeSafeString(rawStory.challenges, 5000, "Challenges", false) || undefined,
            learnings: sanitizeSafeString(rawStory.learnings, 5000, "Learning Outcomes", false) || undefined,
        };
    }

    // Contributor Information (Section G)
    let contribution: ValidatedProjectInput["contribution"] = undefined;
    if (data.contribution && typeof data.contribution === "object") {
        const teamMembers: string[] = [];
        if (Array.isArray(data.contribution.teamMembers)) {
            for (const tm of data.contribution.teamMembers.slice(0, 15)) {
                if (typeof tm === "string" && tm.trim()) {
                    teamMembers.push(tm.trim().slice(0, 80));
                }
            }
        }
        contribution = {
            myRole: sanitizeSafeString(data.contribution.myRole, 100, "Role", false) || undefined,
            myResponsibilities: sanitizeSafeString(data.contribution.myResponsibilities, 3000, "Responsibilities", false) || undefined,
            isTeamProject: Boolean(data.contribution.isTeamProject),
            teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
            contributionDescription: sanitizeSafeString(data.contribution.contributionDescription, 5000, "Contribution Description", false) || undefined,
        };
    }

    // Additional Details (Section H)
    let additionalDetails: ValidatedProjectInput["additionalDetails"] = undefined;
    if (data.additionalDetails && typeof data.additionalDetails === "object") {
        const achievements: string[] = [];
        if (Array.isArray(data.additionalDetails.achievements)) {
            for (const ach of data.additionalDetails.achievements.slice(0, 10)) {
                if (typeof ach === "string" && ach.trim()) {
                    achievements.push(ach.trim().slice(0, 300));
                }
            }
        }

        const performanceMetrics: Array<{ label: string; value: string }> = [];
        if (Array.isArray(data.additionalDetails.performanceMetrics)) {
            for (const m of data.additionalDetails.performanceMetrics.slice(0, 10)) {
                if (m && typeof m === "object") {
                    const l = sanitizeSafeString(m.label, 50, "Metric Label", false);
                    const v = sanitizeSafeString(m.value, 50, "Metric Value", false);
                    if (l && v) performanceMetrics.push({ label: l, value: v });
                }
            }
        }

        const futureImprovements: string[] = [];
        if (Array.isArray(data.additionalDetails.futureImprovements)) {
            for (const fi of data.additionalDetails.futureImprovements.slice(0, 10)) {
                if (typeof fi === "string" && fi.trim()) {
                    futureImprovements.push(fi.trim().slice(0, 300));
                }
            }
        }

        const challenges: string[] = [];
        if (Array.isArray(data.additionalDetails.challenges)) {
            for (const ch of data.additionalDetails.challenges.slice(0, 10)) {
                if (typeof ch === "string" && ch.trim()) {
                    challenges.push(ch.trim().slice(0, 300));
                }
            }
        }

        const customFields: Array<{ key: string; value: string }> = [];
        if (Array.isArray(data.additionalDetails.customFields)) {
            for (const cf of data.additionalDetails.customFields.slice(0, 10)) {
                if (cf && typeof cf === "object") {
                    const k = sanitizeSafeString(cf.key, 50, "Custom Field Key", false);
                    const v = sanitizeSafeString(cf.value, 500, "Custom Field Value", false);
                    if (k && v) customFields.push({ key: k, value: v });
                }
            }
        }

        additionalDetails = {
            achievements: achievements.length > 0 ? achievements : undefined,
            performanceMetrics: performanceMetrics.length > 0 ? performanceMetrics : undefined,
            futureImprovements: futureImprovements.length > 0 ? futureImprovements : undefined,
            challenges: challenges.length > 0 ? challenges : undefined,
            deploymentInfo: sanitizeSafeString(data.additionalDetails.deploymentInfo, 3000, "Deployment Info", false) || undefined,
            customFields: customFields.length > 0 ? customFields : undefined,
            notes: sanitizeSafeString(data.additionalDetails.notes, 5000, "Additional Notes", false) || undefined,
        };
    }

    // Phase 5: Provenance & Synchronization Metadata
    const rawExtractedData = data.rawExtractedData && typeof data.rawExtractedData === "object" ? data.rawExtractedData : undefined;
    const fieldOverrides = data.fieldOverrides && typeof data.fieldOverrides === "object" ? data.fieldOverrides : undefined;
    const syncMetadata = data.syncMetadata && typeof data.syncMetadata === "object" ? data.syncMetadata : undefined;
    const lastSyncedAt = data.lastSyncedAt && typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : undefined;

    // Phase 6: Logical Specification Scalable Entity Fields
    const shortDescription = sanitizeSafeString(data.shortDescription || data.description, 500, "Short Description", false) || undefined;
    const repositoryProvider = sanitizeSafeString(data.repositoryProvider || "github", 50, "Repository Provider", false) || "github";
    const repositoryOwner = sanitizeSafeString(data.repositoryOwner, 100, "Repository Owner", false) || undefined;

    let repositoryVisibility: "public" | "private" | "internal" = "public";
    if (data.repositoryVisibility === "private" || data.repositoryVisibility === "internal" || data.isRepoPrivate) {
        repositoryVisibility = data.repositoryVisibility === "internal" ? "internal" : "private";
    }

    const repositoryMetadata = data.repositoryMetadata && typeof data.repositoryMetadata === "object" ? data.repositoryMetadata : undefined;

    const validExtractionStatuses = ["pending", "analyzing", "completed", "manual", "incomplete", "error"];
    const extractionStatus = validExtractionStatuses.includes(data.extractionStatus) ? data.extractionStatus : "completed";

    let extractionCompleteness = typeof data.extractionCompleteness === "number" ? Math.min(Math.max(Math.round(data.extractionCompleteness), 0), 100) : 100;

    const showOnProfile = typeof data.showOnProfile === "boolean" ? data.showOnProfile : true;
    const repositoryLinkVisibility: "visible" | "hidden" = data.repositoryLinkVisibility === "hidden" || data.hideRepoUrl ? "hidden" : "visible";

    return {
        title,
        tagline: tagline || undefined,
        description: description || undefined,
        shortDescription,
        problemStatement: story?.problemStatement,
        targetAudience: story?.targetAudience,
        fullOverview: fullOverview || undefined,
        category,
        projectType,
        developmentStatus,
        status,
        isPublished,
        isPinned,
        isRepoPrivate,
        hideRepoUrl,
        showOnProfile,
        repositoryProvider,
        repositoryOwner,
        repositoryVisibility,
        repositoryMetadata,
        repositoryLinkVisibility,
        extractionStatus,
        extractionCompleteness,
        repoUrl,
        repoName,
        repoStars,
        repoForks,
        repoLicense,
        repoLanguage,
        liveUrl,
        demoVideoUrl,
        documentationUrl,
        apiDocUrl,
        figmaUrl,
        imageUrl,
        galleryImages,
        technologies,
        categorizedTechnologies,
        features,
        externalLinks,
        architectureNotes: architectureNotes || undefined,
        story,
        contribution,
        additionalDetails,
        rawExtractedData,
        fieldOverrides,
        lastSyncedAt,
        syncMetadata,
    };
}
