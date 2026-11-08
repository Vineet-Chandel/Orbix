import { query } from "../../database/client.js";
import { ProjectValidationError, type ValidatedProjectInput } from "../../validators/ProjectValidator.js";
import {
    extractGithubRepository,
    type ExtractedRepositoryIntelligence,
} from "./githubIntelligenceService.js";
import { getUserAuthorizedGithubToken } from "./githubAppService.js";
import {
    computeProjectDiff,
    buildMergedProjectPayload,
    type ProjectMergeAnalysis,
} from "./projectMergeEngine.js";

export interface ProjectDbRow {
    id: string;
    user_id: string;
    title: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    category: string;
    status: "draft" | "published";
    is_published: boolean;
    is_pinned: boolean;
    is_repo_private: boolean;
    hide_repo_url: boolean;
    display_order: number;
    repo_url: string | null;
    repo_name: string | null;
    repo_stars: number;
    repo_forks: number;
    repo_license: string | null;
    repo_language: string | null;
    repo_pushed_at: string | null;
    live_url: string | null;
    demo_video_url: string | null;
    documentation_url: string | null;
    image_url: string | null;
    gallery_images: string[];
    technologies: string[];
    features: Array<{ title: string; description?: string }>;
    external_links: Array<{ label: string; url: string; type?: string }>;
    architecture_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectFormatted {
    id: string;
    userId: string;
    title: string;
    slug: string;
    tagline?: string;
    description?: string;
    shortDescription?: string;
    problemStatement?: string;
    targetAudience?: string;
    fullOverview?: string;
    category: string;
    projectType: string;
    developmentStatus: string;
    status: "draft" | "published";
    isPublished: boolean;
    isPinned: boolean;
    isRepoPrivate: boolean;
    hideRepoUrl: boolean;
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
    galleryImages: any[];
    technologies: string[];
    categorizedTechnologies?: Record<string, any[]>;
    features: Array<{ id?: string; title: string; description?: string; iconOrImage?: string }>;
    externalLinks: Array<{ id?: string; label: string; url: string; type?: string; isHidden?: boolean }>;
    architectureNotes?: string;
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
    lastSyncedAt?: string;
    syncMetadata?: Record<string, any>;
    shortDescription?: string;
    repositoryProvider?: string;
    repositoryOwner?: string;
    repositoryVisibility?: string;
    repositoryMetadata?: Record<string, any>;
    extractionStatus?: string;
    extractionCompleteness?: number;
    showOnProfile?: boolean;
    repositoryLinkVisibility?: string;
    createdAt: string;
    updatedAt: string;
}

export function formatProjectRow(row: any, isPublicView = false): ProjectFormatted {
    const isRepoPrivate = Boolean(row.is_repo_private || row.repository_visibility === "private");
    const hideRepoUrl = Boolean(row.hide_repo_url || row.repository_link_visibility === "hidden");

    // Private Data Protection (Phase 3.2 & Phase 6):
    // If public visitor view:
    // 1. Redact source code repo URL if hidden or marked private
    // 2. Filter out hidden external links
    // 3. Strip internal extraction & provenance metadata (rawExtractedData, fieldOverrides, syncMetadata)
    let repoUrl = row.repo_url || undefined;
    let repoName = row.repo_name || undefined;
    if (isPublicView && (hideRepoUrl || isRepoPrivate)) {
        repoUrl = undefined;
        repoName = isRepoPrivate ? "Proprietary Codebase (Private)" : undefined;
    }

    // Filter out hidden external links for public visitors
    let externalLinks = Array.isArray(row.external_links) ? row.external_links : [];
    if (isPublicView) {
        externalLinks = externalLinks.filter((l: any) => !l.isHidden);
    }

    return {
        id: row.id,
        userId: row.user_id || row.userId,
        title: row.title,
        slug: row.slug,
        tagline: row.tagline || undefined,
        description: row.description || undefined,
        shortDescription: row.short_description || row.description || undefined,
        problemStatement: row.problem_statement || (row.story && typeof row.story === "object" ? row.story.problemStatement : undefined),
        targetAudience: row.target_audience || (row.story && typeof row.story === "object" ? row.story.targetAudience : undefined),
        fullOverview: row.full_overview || undefined,
        category: row.category || "Full-Stack",
        projectType: row.project_type || "Web application",
        developmentStatus: row.development_status || "Completed",
        status: row.status || (row.is_published ? "published" : "draft"),
        isPublished: Boolean(row.is_published),
        isPinned: Boolean(row.is_pinned),
        isRepoPrivate,
        hideRepoUrl,
        showOnProfile: typeof row.show_on_profile === "boolean" ? row.show_on_profile : true,
        repositoryProvider: row.repository_provider || "github",
        repositoryOwner: row.repository_owner || (row.repo_name?.includes("/") ? row.repo_name.split("/")[0] : undefined),
        repositoryVisibility: row.repository_visibility || (isRepoPrivate ? "private" : "public"),
        repositoryMetadata: row.repository_metadata && typeof row.repository_metadata === "object" ? row.repository_metadata : undefined,
        extractionStatus: row.extraction_status || "completed",
        extractionCompleteness: typeof row.extraction_completeness === "number" ? row.extraction_completeness : 100,
        repositoryLinkVisibility: row.repository_link_visibility || (hideRepoUrl ? "hidden" : "visible"),
        displayOrder: Number(row.display_order ?? 0),
        repoUrl,
        repoName,
        repoStars: Number(row.repo_stars || 0),
        repoForks: Number(row.repo_forks || 0),
        repoLicense: row.repo_license || undefined,
        repoLanguage: row.repo_language || undefined,
        repoPushedAt: row.repo_pushed_at ? new Date(row.repo_pushed_at).toISOString() : undefined,
        liveUrl: row.live_url || undefined,
        demoVideoUrl: row.demo_video_url || undefined,
        documentationUrl: row.documentation_url || undefined,
        apiDocUrl: row.api_doc_url || undefined,
        figmaUrl: row.figma_url || undefined,
        imageUrl: row.image_url || undefined,
        galleryImages: Array.isArray(row.gallery_images) ? row.gallery_images : [],
        technologies: Array.isArray(row.technologies) ? row.technologies : [],
        categorizedTechnologies: row.categorized_technologies && typeof row.categorized_technologies === "object" ? row.categorized_technologies : undefined,
        features: Array.isArray(row.features) ? row.features : [],
        externalLinks,
        architectureNotes: row.architecture_notes || undefined,
        story: row.story && typeof row.story === "object" ? row.story : undefined,
        contribution: row.contribution && typeof row.contribution === "object" ? row.contribution : undefined,
        additionalDetails: row.additional_details && typeof row.additional_details === "object" ? row.additional_details : undefined,
        rawExtractedData: isPublicView ? undefined : (row.raw_extracted_data && typeof row.raw_extracted_data === "object" ? row.raw_extracted_data : undefined),
        fieldOverrides: isPublicView ? undefined : (row.field_overrides && typeof row.field_overrides === "object" ? row.field_overrides : {}),
        lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : undefined,
        syncMetadata: isPublicView ? undefined : (row.sync_metadata && typeof row.sync_metadata === "object" ? row.sync_metadata : undefined),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
}

/**
 * Generates an SEO & URL friendly slug
 */
function slugify(text: string): string {
    const s = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w-]+/g, "") // Remove all non-word chars
        .replace(/--+/g, "-") // Replace multiple - with single -
        .slice(0, 100);
    return s || "project";
}

/**
 * Ensure unique slug for a given user
 */
async function generateUniqueSlug(userId: string, title: string, excludeProjectId?: string): Promise<string> {
    const baseSlug = slugify(title);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
        const res = await query(
            `SELECT id FROM user_projects WHERE user_id = $1 AND slug = $2 ${
                excludeProjectId ? "AND id != $3" : ""
            } LIMIT 1;`,
            excludeProjectId ? [userId, candidate, excludeProjectId] : [userId, candidate]
        );
        if (res.rowCount === 0) {
            return candidate;
        }
        suffix++;
        candidate = `${baseSlug}-${suffix}`;
    }
}

/**
 * 1. Fetch user's projects with strict 4-slot capacity metadata
 */
export async function getUserProjects(userId: string): Promise<{
    count: number;
    maxCapacity: number;
    isCapacityReached: boolean;
    projects: ProjectFormatted[];
}> {
    const res = await query(
        `SELECT * FROM user_projects 
         WHERE user_id = $1 
         ORDER BY display_order ASC, created_at DESC;`,
        [userId]
    );

    const projects = res.rows.map(formatProjectRow);
    const count = projects.length;
    const maxCapacity = 4;

    return {
        count,
        maxCapacity,
        isCapacityReached: count >= maxCapacity,
        projects,
    };
}

/**
 * 2. Fetch public projects for a given username (for public and demo profile views)
 */
export async function getPublicProjectsByUsername(
    username: string,
    viewerId?: string
): Promise<{
    username: string;
    count: number;
    projects: ProjectFormatted[];
}> {
    const userRes = await query(
        `SELECT id, username, is_public FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
        [username]
    );

    if (userRes.rowCount === 0) {
        throw new ProjectValidationError(`User '@${username}' not found.`);
    }

    const user = userRes.rows[0];
    const isOwner = viewerId && viewerId === user.id;

    // If profile is private and viewer is not owner, return empty list
    if (user.is_public === false && !isOwner) {
        return { username: user.username, count: 0, projects: [] };
    }

    // Owner sees all projects including drafts. Public visitors only see published projects where show_on_profile = true.
    const projectRes = await query(
        `SELECT * FROM user_projects 
         WHERE user_id = $1 ${isOwner ? "" : "AND is_published = TRUE AND (show_on_profile IS NULL OR show_on_profile = TRUE)"}
         ORDER BY is_pinned DESC, display_order ASC, created_at DESC
         LIMIT 4;`,
        [user.id]
    );

    return {
        username: user.username,
        count: projectRes.rowCount || 0,
        projects: projectRes.rows.map((r) => formatProjectRow(r, !isOwner)),
    };
}

/**
 * 3. Fetch single project by ID
 */
export async function getProjectById(projectId: string, viewerId?: string): Promise<ProjectFormatted> {
    const res = await query(`SELECT * FROM user_projects WHERE id = $1 LIMIT 1;`, [projectId]);
    if (res.rowCount === 0) {
        throw new ProjectValidationError("Project not found.");
    }
    const row = res.rows[0];
    const isOwner = Boolean(viewerId && row.user_id === viewerId);

    // If viewer is not owner, enforce public visibility rules
    if (!isOwner) {
        if (!row.is_published || row.show_on_profile === false) {
            throw new ProjectValidationError("Project not found or private.");
        }
    }

    return formatProjectRow(row, !isOwner);
}

/**
 * 4. Create a project with atomic 4-slot capacity enforcement
 */
export async function createProject(userId: string, input: ValidatedProjectInput): Promise<ProjectFormatted> {
    // 1. Transactional check for max capacity (4/4) with advisory lock
    await query(`SELECT pg_advisory_xact_lock(hashtext('user_projects_capacity_' || $1));`, [userId]);

    const countRes = await query(
        `SELECT COUNT(*) AS total FROM user_projects WHERE user_id = $1;`,
        [userId]
    );
    const currentCount = parseInt(countRes.rows[0]?.total || "0", 10);
    if (currentCount >= 4) {
        throw new ProjectValidationError(
            "Maximum project capacity reached (4/4). You cannot showcase more than 4 projects. Please delete an existing project before adding a new one."
        );
    }

    // 2. Generate slug and assign next display order
    const slug = await generateUniqueSlug(userId, input.title);
    const displayOrder = currentCount;

    const finalStory = {
        ...(input.story && typeof input.story === "object" ? input.story : {}),
        ...((input as any).problemStatement ? { problemStatement: (input as any).problemStatement } : {}),
        ...((input as any).targetAudience ? { targetAudience: (input as any).targetAudience } : {}),
    };

    // 3. Insert into database
    const insertRes = await query(
        `INSERT INTO user_projects (
            user_id,
            title,
            slug,
            tagline,
            description,
            short_description,
            full_overview,
            category,
            project_type,
            development_status,
            status,
            is_published,
            is_pinned,
            is_repo_private,
            hide_repo_url,
            show_on_profile,
            repository_provider,
            repository_owner,
            repository_visibility,
            repository_metadata,
            extraction_status,
            extraction_completeness,
            repository_link_visibility,
            display_order,
            repo_url,
            repo_name,
            repo_stars,
            repo_forks,
            repo_license,
            repo_language,
            live_url,
            demo_video_url,
            documentation_url,
            api_doc_url,
            figma_url,
            image_url,
            gallery_images,
            technologies,
            categorized_technologies,
            features,
            external_links,
            architecture_notes,
            story,
            contribution,
            additional_details,
            raw_extracted_data,
            field_overrides,
            last_synced_at,
            sync_metadata
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, $44, $45, $46, $47, $48, $49
        ) RETURNING *;`,
        [
            userId,
            input.title,
            slug,
            input.tagline || null,
            input.description || null,
            input.shortDescription || input.description || null,
            input.fullOverview || null,
            input.category,
            input.projectType || "Web application",
            input.developmentStatus || "Completed",
            input.status,
            input.isPublished,
            input.isPinned,
            Boolean(input.isRepoPrivate),
            Boolean(input.hideRepoUrl),
            input.showOnProfile !== undefined ? input.showOnProfile : true,
            input.repositoryProvider || "github",
            input.repositoryOwner || (input.repoName?.includes("/") ? input.repoName.split("/")[0] : null),
            input.repositoryVisibility || (input.isRepoPrivate ? "private" : "public"),
            input.repositoryMetadata ? JSON.stringify(input.repositoryMetadata) : JSON.stringify({ stars: input.repoStars || 0, forks: input.repoForks || 0 }),
            input.extractionStatus || "completed",
            input.extractionCompleteness ?? 100,
            input.repositoryLinkVisibility || (input.hideRepoUrl ? "hidden" : "visible"),
            displayOrder,
            input.repoUrl || null,
            input.repoName || null,
            input.repoStars || 0,
            input.repoForks || 0,
            input.repoLicense || null,
            input.repoLanguage || null,
            input.liveUrl || null,
            input.demoVideoUrl || null,
            input.documentationUrl || null,
            input.apiDocUrl || null,
            input.figmaUrl || null,
            input.imageUrl || null,
            JSON.stringify(input.galleryImages || []),
            JSON.stringify(input.technologies || []),
            input.categorizedTechnologies ? JSON.stringify(input.categorizedTechnologies) : null,
            JSON.stringify(input.features || []),
            JSON.stringify(input.externalLinks || []),
            input.architectureNotes || null,
            Object.keys(finalStory).length > 0 ? JSON.stringify(finalStory) : null,
            input.contribution ? JSON.stringify(input.contribution) : null,
            input.additionalDetails ? JSON.stringify(input.additionalDetails) : null,
            input.rawExtractedData ? JSON.stringify(input.rawExtractedData) : JSON.stringify({}),
            input.fieldOverrides ? JSON.stringify(input.fieldOverrides) : JSON.stringify({}),
            input.lastSyncedAt ? new Date(input.lastSyncedAt) : new Date(),
            input.syncMetadata ? JSON.stringify(input.syncMetadata) : JSON.stringify({ pendingDiffCount: 0 }),
        ]
    );

    return formatProjectRow(insertRes.rows[0]);
}

/**
 * 5. Update an existing project
 */
export async function updateProject(
    projectId: string,
    userId: string,
    input: Partial<ValidatedProjectInput>
): Promise<ProjectFormatted> {
    // Verify ownership
    const checkRes = await query(
        `SELECT id, user_id, title, slug, raw_extracted_data, field_overrides, story FROM user_projects WHERE id = $1 LIMIT 1;`,
        [projectId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found.");
    }
    if (checkRes.rows[0].user_id !== userId) {
        throw new ProjectValidationError("Unauthorized: You do not own this project.");
    }

    const current = checkRes.rows[0];
    let newSlug = current.slug;
    if (input.title && input.title !== current.title) {
        newSlug = await generateUniqueSlug(userId, input.title, projectId);
    }

    let finalStory = input.story;
    const pStatement = (input as any).problemStatement;
    const tAudience = (input as any).targetAudience;
    if (finalStory !== undefined || pStatement !== undefined || tAudience !== undefined) {
        finalStory = {
            ...(current.story && typeof current.story === "object" ? current.story : {}),
            ...(finalStory || {}),
            ...(pStatement !== undefined ? { problemStatement: pStatement } : {}),
            ...(tAudience !== undefined ? { targetAudience: tAudience } : {}),
        };
    }

    // Field-level provenance tracking: automatically record user manual edits against extracted values
    let finalOverrides = input.fieldOverrides;
    if (finalOverrides === undefined) {
        const raw = (current.raw_extracted_data && typeof current.raw_extracted_data === "object") ? current.raw_extracted_data : {};
        const existingOverrides = { ...((current.field_overrides && typeof current.field_overrides === "object") ? current.field_overrides : {}) };
        let hasChanges = false;
        for (const [key, val] of Object.entries(input)) {
            if (raw[key] !== undefined && val !== undefined && val !== raw[key]) {
                existingOverrides[key] = true;
                hasChanges = true;
            }
        }
        if (hasChanges) {
            finalOverrides = existingOverrides;
        }
    }

    const updateRes = await query(
        `UPDATE user_projects SET
            title = COALESCE($1, title),
            slug = $2,
            tagline = CASE WHEN $3::boolean THEN $4 ELSE tagline END,
            description = CASE WHEN $5::boolean THEN $6 ELSE description END,
            full_overview = CASE WHEN $7::boolean THEN $8 ELSE full_overview END,
            category = COALESCE($9, category),
            project_type = COALESCE($10, project_type),
            development_status = COALESCE($11, development_status),
            status = COALESCE($12, status),
            is_published = COALESCE($13, is_published),
            is_pinned = COALESCE($14, is_pinned),
            repo_url = CASE WHEN $15::boolean THEN $16 ELSE repo_url END,
            repo_name = CASE WHEN $17::boolean THEN $18 ELSE repo_name END,
            repo_stars = COALESCE($19, repo_stars),
            repo_forks = COALESCE($20, repo_forks),
            repo_license = CASE WHEN $21::boolean THEN $22 ELSE repo_license END,
            repo_language = CASE WHEN $23::boolean THEN $24 ELSE repo_language END,
            live_url = CASE WHEN $25::boolean THEN $26 ELSE live_url END,
            demo_video_url = CASE WHEN $27::boolean THEN $28 ELSE demo_video_url END,
            documentation_url = CASE WHEN $29::boolean THEN $30 ELSE documentation_url END,
            api_doc_url = CASE WHEN $31::boolean THEN $32 ELSE api_doc_url END,
            figma_url = CASE WHEN $33::boolean THEN $34 ELSE figma_url END,
            image_url = CASE WHEN $35::boolean THEN $36 ELSE image_url END,
            gallery_images = COALESCE($37::jsonb, gallery_images),
            technologies = COALESCE($38::jsonb, technologies),
            categorized_technologies = CASE WHEN $39::boolean THEN $40::jsonb ELSE categorized_technologies END,
            features = COALESCE($41::jsonb, features),
            external_links = COALESCE($42::jsonb, external_links),
            architecture_notes = CASE WHEN $43::boolean THEN $44 ELSE architecture_notes END,
            is_repo_private = COALESCE($45, is_repo_private),
            hide_repo_url = COALESCE($46, hide_repo_url),
            story = CASE WHEN $47::boolean THEN $48::jsonb ELSE story END,
            contribution = CASE WHEN $49::boolean THEN $50::jsonb ELSE contribution END,
            additional_details = CASE WHEN $51::boolean THEN $52::jsonb ELSE additional_details END,
            raw_extracted_data = CASE WHEN $53::boolean THEN $54::jsonb ELSE raw_extracted_data END,
            field_overrides = CASE WHEN $55::boolean THEN $56::jsonb ELSE field_overrides END,
            last_synced_at = CASE WHEN $57::boolean THEN $58::timestamptz ELSE last_synced_at END,
            sync_metadata = CASE WHEN $59::boolean THEN $60::jsonb ELSE sync_metadata END,
            short_description = CASE WHEN $61::boolean THEN $62 ELSE short_description END,
            repository_provider = COALESCE($63, repository_provider),
            repository_owner = CASE WHEN $64::boolean THEN $65 ELSE repository_owner END,
            repository_visibility = COALESCE($66, repository_visibility),
            repository_metadata = CASE WHEN $67::boolean THEN $68::jsonb ELSE repository_metadata END,
            extraction_status = COALESCE($69, extraction_status),
            extraction_completeness = COALESCE($70, extraction_completeness),
            show_on_profile = COALESCE($71, show_on_profile),
            repository_link_visibility = COALESCE($72, repository_link_visibility),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $73 AND user_id = $74
        RETURNING *;`,
        [
            input.title || null,
            newSlug,
            input.tagline !== undefined,
            input.tagline || null,
            input.description !== undefined,
            input.description || null,
            input.fullOverview !== undefined,
            input.fullOverview || null,
            input.category || null,
            input.projectType || null,
            input.developmentStatus || null,
            input.status || null,
            input.isPublished !== undefined ? input.isPublished : null,
            input.isPinned !== undefined ? input.isPinned : null,
            input.repoUrl !== undefined,
            input.repoUrl || null,
            input.repoName !== undefined,
            input.repoName || null,
            input.repoStars !== undefined ? input.repoStars : null,
            input.repoForks !== undefined ? input.repoForks : null,
            input.repoLicense !== undefined,
            input.repoLicense || null,
            input.repoLanguage !== undefined,
            input.repoLanguage || null,
            input.liveUrl !== undefined,
            input.liveUrl || null,
            input.demoVideoUrl !== undefined,
            input.demoVideoUrl || null,
            input.documentationUrl !== undefined,
            input.documentationUrl || null,
            input.apiDocUrl !== undefined,
            input.apiDocUrl || null,
            input.figmaUrl !== undefined,
            input.figmaUrl || null,
            input.imageUrl !== undefined,
            input.imageUrl || null,
            input.galleryImages ? JSON.stringify(input.galleryImages) : null,
            input.technologies ? JSON.stringify(input.technologies) : null,
            input.categorizedTechnologies !== undefined,
            input.categorizedTechnologies ? JSON.stringify(input.categorizedTechnologies) : null,
            input.features ? JSON.stringify(input.features) : null,
            input.externalLinks ? JSON.stringify(input.externalLinks) : null,
            input.architectureNotes !== undefined,
            input.architectureNotes || null,
            input.isRepoPrivate !== undefined ? input.isRepoPrivate : null,
            input.hideRepoUrl !== undefined ? input.hideRepoUrl : null,
            finalStory !== undefined,
            finalStory ? JSON.stringify(finalStory) : null,
            input.contribution !== undefined,
            input.contribution ? JSON.stringify(input.contribution) : null,
            input.additionalDetails !== undefined,
            input.additionalDetails ? JSON.stringify(input.additionalDetails) : null,
            input.rawExtractedData !== undefined,
            input.rawExtractedData ? JSON.stringify(input.rawExtractedData) : null,
            finalOverrides !== undefined,
            finalOverrides ? JSON.stringify(finalOverrides) : null,
            input.lastSyncedAt !== undefined,
            input.lastSyncedAt ? new Date(input.lastSyncedAt) : null,
            input.syncMetadata !== undefined,
            input.syncMetadata ? JSON.stringify(input.syncMetadata) : null,
            input.shortDescription !== undefined,
            input.shortDescription || null,
            input.repositoryProvider || null,
            input.repositoryOwner !== undefined,
            input.repositoryOwner || null,
            input.repositoryVisibility || null,
            input.repositoryMetadata !== undefined,
            input.repositoryMetadata ? JSON.stringify(input.repositoryMetadata) : null,
            input.extractionStatus || null,
            input.extractionCompleteness !== undefined ? input.extractionCompleteness : null,
            input.showOnProfile !== undefined ? input.showOnProfile : null,
            input.repositoryLinkVisibility || null,
            projectId,
            userId,
        ]
    );

    return formatProjectRow(updateRes.rows[0]);
}

/**
 * 6. Delete a project and automatically re-compact display_order
 */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
    const checkRes = await query(
        `SELECT id FROM user_projects WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [projectId, userId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found or not owned by you.");
    }

    await query(`DELETE FROM user_projects WHERE id = $1 AND user_id = $2;`, [projectId, userId]);

    // Re-compact display_order
    const remaining = await query(
        `SELECT id FROM user_projects WHERE user_id = $1 ORDER BY display_order ASC, created_at ASC;`,
        [userId]
    );

    for (let i = 0; i < remaining.rows.length; i++) {
        await query(`UPDATE user_projects SET display_order = $1 WHERE id = $2;`, [i, remaining.rows[i].id]);
    }

    return true;
}

/**
 * 7. Reorder user projects
 */
export async function reorderProjects(userId: string, projectIds: string[]): Promise<ProjectFormatted[]> {
    if (!Array.isArray(projectIds)) {
        throw new ProjectValidationError("projectIds must be an array of IDs.");
    }

    // Verify all IDs belong to this user
    const userProjectsRes = await query(
        `SELECT id FROM user_projects WHERE user_id = $1;`,
        [userId]
    );
    const validIds = new Set(userProjectsRes.rows.map((r) => r.id));

    for (let index = 0; index < projectIds.length; index++) {
        const id = projectIds[index];
        if (validIds.has(id)) {
            await query(
                `UPDATE user_projects SET display_order = $1 WHERE id = $2 AND user_id = $3;`,
                [index, id, userId]
            );
        }
    }

    const updatedRes = await query(
        `SELECT * FROM user_projects WHERE user_id = $1 ORDER BY display_order ASC;`,
        [userId]
    );
    return updatedRes.rows.map(formatProjectRow);
}

/**
 * 8. Quick toggle publish status
 */
export async function toggleProjectPublish(
    projectId: string,
    userId: string,
    isPublished?: boolean
): Promise<ProjectFormatted> {
    const checkRes = await query(
        `SELECT id, is_published FROM user_projects WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [projectId, userId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found.");
    }

    const currentPublished = checkRes.rows[0].is_published;
    const targetPublished = isPublished !== undefined ? isPublished : !currentPublished;
    const targetStatus = targetPublished ? "published" : "draft";

    const updateRes = await query(
        `UPDATE user_projects 
         SET is_published = $1, status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING *;`,
        [targetPublished, targetStatus, projectId, userId]
    );

    return formatProjectRow(updateRes.rows[0]);
}

/**
 * 9. GitHub Repository Intelligence Engine
 * Fetches repository metadata, languages, and README for non-destructive user review.
 */
export async function analyzeGithubRepo(rawInput: string, userId?: string): Promise<
    ExtractedRepositoryIntelligence & {
        repoStars: number;
        repoForks: number;
        repoLanguage: string | null;
        repoLicense: string | null;
    }
> {
    let authToken: string | null = null;
    if (userId) {
        authToken = await getUserAuthorizedGithubToken(userId);
    }
    const intel = await extractGithubRepository(rawInput, authToken);

    return {
        ...intel,
        // Provide both property styles for backward compatibility
        repoStars: intel.stars,
        repoForks: intel.forks,
        repoLanguage: intel.primaryLanguage,
        repoLicense: intel.license,
    };
}

/**
 * 10. Check Repository Synchronization Diffs (Phase 5: Field-level Provenance)
 * Compares current project data with fresh GitHub extraction without overwriting user edits.
 */
export async function checkProjectSyncDiff(projectId: string, userId: string): Promise<ProjectMergeAnalysis> {
    const checkRes = await query(
        `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [projectId, userId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found or unauthorized.");
    }

    const row = checkRes.rows[0];
    if (!row.repo_url) {
        throw new ProjectValidationError("Cannot sync a project that does not have a linked repository URL.");
    }

    const freshIntel = await analyzeGithubRepo(row.repo_url, userId);
    const diffAnalysis = computeProjectDiff(
        row,
        freshIntel,
        row.field_overrides || {},
        row.raw_extracted_data || {}
    );

    // Save check timestamp and diff count to sync_metadata
    await query(
        `UPDATE user_projects 
         SET sync_metadata = jsonb_set(
             COALESCE(sync_metadata, '{}'::jsonb),
             '{lastCheck}',
             $1::jsonb
         )
         WHERE id = $2;`,
        [
            JSON.stringify({
                checkedAt: diffAnalysis.checkedAt,
                pendingDiffCount: Object.values(diffAnalysis.diffs).filter((d) => d.hasChanged).length,
                autoMergeableCount: diffAnalysis.autoMergeableFields.length,
                conflictCount: diffAnalysis.userOverriddenFields.length,
            }),
            projectId,
        ]
    );

    return diffAnalysis;
}

/**
 * 11. Apply Non-Destructive Repository Synchronization Merge (Phase 5)
 * Merges fresh GitHub intelligence while strictly preserving user-overridden fields.
 */
export async function applyProjectSyncMerge(
    projectId: string,
    userId: string,
    explicitDecisions: Record<string, "keep_user" | "accept_extracted"> = {}
): Promise<{ project: ProjectFormatted; mergedFields: string[]; preservedOverrides: string[] }> {
    const checkRes = await query(
        `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [projectId, userId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found or unauthorized.");
    }

    const row = checkRes.rows[0];
    if (!row.repo_url) {
        throw new ProjectValidationError("Cannot sync a project that does not have a linked repository URL.");
    }

    const freshIntel = await analyzeGithubRepo(row.repo_url, userId);
    const { mergedPayload, updatedOverrides, newRawExtractedData } = buildMergedProjectPayload(
        row,
        freshIntel,
        row.field_overrides || {},
        explicitDecisions
    );

    const updated = await updateProject(projectId, userId, {
        ...mergedPayload,
        fieldOverrides: updatedOverrides,
        rawExtractedData: newRawExtractedData,
        lastSyncedAt: new Date().toISOString(),
        syncMetadata: {
            lastSyncedAt: new Date().toISOString(),
            pendingDiffCount: 0,
        },
    });

    const mergedFields = Object.keys(mergedPayload);
    const preservedOverrides = Object.keys(updatedOverrides).filter((k) => updatedOverrides[k]);

    return {
        project: updated,
        mergedFields,
        preservedOverrides,
    };
}

/**
 * 12. Reset Single Field to Extracted Value (Phase 5)
 * Allows resetting an individual field to the latest repository value, clearing its override flag.
 */
export async function resetProjectFieldToExtracted(
    projectId: string,
    userId: string,
    fieldName: string
): Promise<ProjectFormatted> {
    const checkRes = await query(
        `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [projectId, userId]
    );
    if (checkRes.rowCount === 0) {
        throw new ProjectValidationError("Project not found or unauthorized.");
    }

    const row = checkRes.rows[0];
    let extractedValue = row.raw_extracted_data?.[fieldName];

    // If not in cache or cache is empty, fetch fresh from repo
    if (extractedValue === undefined && row.repo_url) {
        const freshIntel = await analyzeGithubRepo(row.repo_url, userId);
        extractedValue = (freshIntel as any)[fieldName];
    }

    if (extractedValue === undefined) {
        throw new ProjectValidationError(`No extracted value available for field '${fieldName}'.`);
    }

    const currentOverrides = { ...(row.field_overrides || {}) };
    currentOverrides[fieldName] = false; // Reset override flag

    const updatePayload: Record<string, any> = {
        [fieldName]: extractedValue,
        fieldOverrides: currentOverrides,
    };

    return await updateProject(projectId, userId, updatePayload);
}
