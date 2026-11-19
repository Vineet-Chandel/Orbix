import { apiFetch } from "./apiClient";
import type {
    ProjectItem,
    ProjectListResponse,
    PublicProjectsResponse,
    CreateProjectInput,
    UpdateProjectInput,
    AnalyzeRepoResponse,
    ProjectMediaUploadConfig,
    ProjectMergeAnalysis,
} from "../types/project";

/**
 * 1. Fetch current user's projects with slot capacity metadata (0 min, 4 max)
 */
export async function fetchMyProjects(): Promise<ProjectListResponse> {
    return apiFetch<ProjectListResponse>("/api/projects", {
        method: "GET",
    });
}

/**
 * 2. Fetch public projects for a given username
 */
export async function fetchUserProjects(username: string): Promise<PublicProjectsResponse> {
    return apiFetch<PublicProjectsResponse>(`/api/projects/user/${encodeURIComponent(username)}`, {
        method: "GET",
    });
}

/**
 * 3. Analyze a GitHub repository via Repository Intelligence Engine
 * Non-destructive: Extracts metadata for user review without saving to database.
 */
export async function analyzeGithubRepo(repoUrl: string): Promise<AnalyzeRepoResponse> {
    return apiFetch<AnalyzeRepoResponse>("/api/projects/analyze-repo", {
        method: "POST",
        body: JSON.stringify({ repoUrl }),
    });
}

/**
 * 4. Create a new project showcase slot (Draft or Published)
 * Enforces atomic 4-project capacity limit on backend.
 */
export async function createProject(
    data: CreateProjectInput
): Promise<{ success: boolean; message: string; project: ProjectItem }> {
    return apiFetch<{ success: boolean; message: string; project: ProjectItem }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

/**
 * 5. Update an existing project
 * Allows editing all fields (no field is permanently read-only).
 */
export async function updateProject(
    id: string,
    data: UpdateProjectInput
): Promise<{ success: boolean; message: string; project: ProjectItem }> {
    return apiFetch<{ success: boolean; message: string; project: ProjectItem }>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

/**
 * 6. Delete a project and automatically free up a showcase slot
 */
export async function deleteProject(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/projects/${id}`, {
        method: "DELETE",
    });
}

/**
 * 7. Reorder projects
 */
export async function reorderProjects(
    projectIds: string[]
): Promise<{ success: boolean; message: string; projects: ProjectItem[] }> {
    return apiFetch<{ success: boolean; message: string; projects: ProjectItem[] }>("/api/projects/reorder", {
        method: "PATCH",
        body: JSON.stringify({ projectIds }),
    });
}

/**
 * 8. Quick toggle publication status
 */
export async function toggleProjectPublish(
    id: string,
    isPublished?: boolean
): Promise<{ success: boolean; message: string; project: ProjectItem }> {
    return apiFetch<{ success: boolean; message: string; project: ProjectItem }>(`/api/projects/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished }),
    });
}

/**
 * 9. Initiate GitHub App repository authorization with HMAC-SHA256 CSRF protection
 */
export async function initiateGithubAppInstall(
    repoHint?: string
): Promise<{ success: boolean; installUrl: string }> {
    const query = repoHint ? `?repo=${encodeURIComponent(repoHint)}` : "";
    return apiFetch<{ success: boolean; installUrl: string }>(`/api/projects/github-app/install${query}`, {
        method: "GET",
    });
}

/**
 * 10. Fetch current user's GitHub connection status
 */
export async function fetchGithubConnectionStatus(): Promise<{
    success: boolean;
    isConnected: boolean;
    accountLogin?: string;
}> {
    return apiFetch<{ success: boolean; isConnected: boolean; accountLogin?: string }>(
        "/api/projects/github-app/status",
        { method: "GET" }
    );
}

/**
 * 11. Disconnect user GitHub connection
 */
export async function disconnectGithubAccess(): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>("/api/projects/github-app/disconnect", {
        method: "DELETE",
    });
}

/**
 * 12. Request signed direct upload authorization for project media
 */
export async function requestProjectMediaSignature(): Promise<ProjectMediaUploadConfig> {
    const res = await apiFetch<{ success: boolean; uploadConfig: ProjectMediaUploadConfig }>(
        "/api/projects/media/signature",
        { method: "POST" }
    );
    if (!res.uploadConfig) {
        throw new Error("Invalid signature response from server.");
    }
    return res.uploadConfig;
}

/**
 * 13. Direct-to-Cloudinary authenticated upload for project images & diagrams
 */
export function uploadProjectMediaToCloudinary(
    config: ProjectMediaUploadConfig,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ secureUrl: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        secureUrl: response.secure_url,
                        publicId: response.public_id || config.publicId,
                    });
                } catch {
                    reject(new Error("Failed to parse cloud storage response."));
                }
            } else {
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    reject(new Error(errRes.error?.message || `Upload failed with status ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Network connection lost during upload."));
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", config.apiKey);
        formData.append("timestamp", String(config.timestamp));
        formData.append("signature", config.signature);
        formData.append("public_id", config.publicId);

        xhr.open("POST", config.uploadUrl);
        xhr.send(formData);
    });
}

/**
 * 14. Check repository synchronization diffs without overwriting user data
 */
export async function checkProjectSyncDiff(
    projectId: string
): Promise<{ success: boolean; analysis: ProjectMergeAnalysis }> {
    return apiFetch<{ success: boolean; analysis: ProjectMergeAnalysis }>(
        `/api/projects/${projectId}/sync/diff`,
        { method: "GET" }
    );
}

/**
 * 15. Apply repository synchronization merge with field decisions
 */
export async function applyProjectSyncMerge(
    projectId: string,
    decisions?: Record<string, "keep_user" | "accept_extracted">
): Promise<{
    success: boolean;
    message: string;
    project: ProjectItem;
    appliedDecisions: Record<string, string>;
    mergeAnalysis: ProjectMergeAnalysis;
}> {
    return apiFetch<{
        success: boolean;
        message: string;
        project: ProjectItem;
        appliedDecisions: Record<string, string>;
        mergeAnalysis: ProjectMergeAnalysis;
    }>(`/api/projects/${projectId}/sync/merge`, {
        method: "POST",
        body: JSON.stringify({ decisions: decisions || {} }),
    });
}

/**
 * 16. Reset an individual field to the latest extracted repository value
 */
export async function resetProjectFieldToExtracted(
    projectId: string,
    field: string
): Promise<{ success: boolean; message: string; project: ProjectItem }> {
    return apiFetch<{ success: boolean; message: string; project: ProjectItem }>(
        `/api/projects/${projectId}/sync/reset-field`,
        {
            method: "POST",
            body: JSON.stringify({ field }),
        }
    );
}

