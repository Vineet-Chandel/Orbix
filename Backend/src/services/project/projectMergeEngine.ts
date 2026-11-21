import type { ExtractedRepositoryIntelligence } from "./githubIntelligenceService.js";
import type { ProjectFormatted } from "./projectService.js";

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

/**
 * Normalizes values for comparison to prevent false positive diffs
 */
function normalizeForComparison(val: any): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) {
        return JSON.stringify(
            val.map((item) => (typeof item === "string" ? item.trim() : item))
        );
    }
    return JSON.stringify(val);
}

/**
 * Computes a field-by-field diff between current project data and fresh GitHub extraction
 */
export function computeProjectDiff(
    currentProject: any,
    freshExtraction: ExtractedRepositoryIntelligence,
    fieldOverrides: Record<string, boolean> = {},
    rawExtractedData: Record<string, any> = {}
): ProjectMergeAnalysis {
    const diffs: Record<string, FieldDiff> = {};
    const autoMergeableFields: string[] = [];
    const userOverriddenFields: string[] = [];

    // Fields to analyze for provenance diffing
    const fieldsToCompare: Array<{ field: string; label: string; extractKey: keyof ExtractedRepositoryIntelligence | string }> = [
        { field: "title", label: "Project Title", extractKey: "title" },
        { field: "tagline", label: "Project Tagline", extractKey: "tagline" },
        { field: "description", label: "Overview Description", extractKey: "description" },
        { field: "fullOverview", label: "Full Project Overview", extractKey: "description" },
        { field: "category", label: "Project Category", extractKey: "category" },
        { field: "liveUrl", label: "Live Demo URL", extractKey: "liveUrl" },
        { field: "documentationUrl", label: "Documentation URL", extractKey: "documentationUrl" },
        { field: "technologies", label: "Technologies", extractKey: "technologies" },
        { field: "features", label: "Features", extractKey: "features" },
        { field: "architectureNotes", label: "Architecture Notes", extractKey: "architectureNotes" },
        { field: "repoLicense", label: "License", extractKey: "license" },
    ];

    let hasDifferences = false;

    for (const { field, label, extractKey } of fieldsToCompare) {
        const currentValue = currentProject[field];
        const extractedValue = (freshExtraction as any)[extractKey] ?? null;
        const lastExtractedValue = rawExtractedData[field] ?? null;
        const isOverridden = Boolean(fieldOverrides[field]);

        const currNorm = normalizeForComparison(currentValue);
        const extNorm = normalizeForComparison(extractedValue);
        const hasChanged = currNorm !== extNorm && extNorm.length > 0;

        let changeType: FieldDiff["changeType"] = "unchanged";
        let recommendedAction: FieldDiff["recommendedAction"] = "auto_update";

        if (hasChanged) {
            hasDifferences = true;
            if (isOverridden) {
                changeType = "conflict";
                recommendedAction = "preserve_user_edit"; // User edit is always authoritative
                userOverriddenFields.push(field);
            } else {
                changeType = currNorm.length === 0 ? "added" : "modified";
                recommendedAction = "auto_update";
                autoMergeableFields.push(field);
            }
        } else if (isOverridden) {
            userOverriddenFields.push(field);
        }

        diffs[field] = {
            field,
            label,
            currentValue,
            extractedValue,
            lastExtractedValue,
            isOverridden,
            hasChanged,
            changeType,
            recommendedAction,
        };
    }

    const beforeStars = Number(currentProject.repo_stars || currentProject.repoStars || 0);
    const afterStars = freshExtraction.stars || freshExtraction.repoStars || 0;
    const beforeForks = Number(currentProject.repo_forks || currentProject.repoForks || 0);
    const afterForks = freshExtraction.forks || freshExtraction.repoForks || 0;
    const beforeLang = currentProject.repo_language || currentProject.repoLanguage || null;
    const afterLang = freshExtraction.primaryLanguage || freshExtraction.repoLanguage || null;

    return {
        projectId: currentProject.id,
        repoUrl: currentProject.repo_url || currentProject.repoUrl || freshExtraction.repoUrl,
        checkedAt: new Date().toISOString(),
        hasDifferences,
        diffs,
        statisticsUpdated: {
            stars: { before: beforeStars, after: afterStars },
            forks: { before: beforeForks, after: afterForks },
            language: { before: beforeLang, after: afterLang },
        },
        autoMergeableFields,
        userOverriddenFields,
    };
}

/**
 * Builds merged project values by honoring user overrides as authoritative
 * and applying fresh extracted data only to non-overridden fields or explicitly approved fields.
 */
export function buildMergedProjectPayload(
    currentProject: any,
    freshExtraction: ExtractedRepositoryIntelligence,
    fieldOverrides: Record<string, boolean>,
    explicitDecisions: Record<string, "keep_user" | "accept_extracted"> = {}
): {
    mergedPayload: Record<string, any>;
    updatedOverrides: Record<string, boolean>;
    newRawExtractedData: Record<string, any>;
} {
    const updatedOverrides = { ...fieldOverrides };
    const mergedPayload: Record<string, any> = {};
    const newRawExtractedData: Record<string, any> = {};

    // 1. Facts & Statistics are updated directly from GitHub
    mergedPayload["repoStars"] = freshExtraction.stars || freshExtraction.repoStars || 0;
    mergedPayload["repoForks"] = freshExtraction.forks || freshExtraction.repoForks || 0;
    mergedPayload["repoLanguage"] = freshExtraction.primaryLanguage || freshExtraction.repoLanguage || currentProject.repoLanguage;
    mergedPayload["repoPushedAt"] = freshExtraction.pushedAt || currentProject.repoPushedAt;
    mergedPayload["repoLicense"] = freshExtraction.license || currentProject.repoLicense;

    // 2. Field-level provenance merge
    const fields = [
        "title",
        "tagline",
        "description",
        "fullOverview",
        "category",
        "liveUrl",
        "documentationUrl",
        "technologies",
        "features",
        "architectureNotes",
    ];

    for (const field of fields) {
        const userValue = currentProject[field];
        const extractedValue = (freshExtraction as any)[field] ?? null;
        newRawExtractedData[field] = extractedValue;

        const isOverridden = Boolean(fieldOverrides[field]);
        const decision = explicitDecisions[field];

        if (decision === "accept_extracted") {
            // User explicitly reset/accepted the incoming GitHub value
            mergedPayload[field] = extractedValue;
            updatedOverrides[field] = false; // Override cleared
        } else if (decision === "keep_user") {
            // User explicitly decided to keep custom value
            mergedPayload[field] = userValue;
            updatedOverrides[field] = true;
        } else if (isOverridden) {
            // User has overridden this field previously: USER VERSION IS AUTHORITATIVE
            mergedPayload[field] = userValue;
        } else {
            // Not overridden: Safe to auto-update with fresh GitHub value if present
            mergedPayload[field] = extractedValue ?? userValue;
        }
    }

    return {
        mergedPayload,
        updatedOverrides,
        newRawExtractedData,
    };
}
