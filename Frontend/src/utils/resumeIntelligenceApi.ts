import type { GeminiAnalysisReport } from "../../../Backend/src/services/resume/resumeTypes";

export type { GeminiAnalysisReport };

export interface ResumeProfileData {
    hasResume: boolean;
    resumeUrl: string | null;
    viewUrl: string | null;
    downloadUrl: string | null;
    signedUrl: string | null;
    rawUrl?: string | null;
    resumeFilename: string | null;
    resumeFilesize: number | null;
    resumeUpdatedAt: string | null;
    isResumePublic: boolean;
    checks?: any[];
    metadata?: {
        analysisReport?: GeminiAnalysisReport;
        uploadResultVersion?: number;
        [key: string]: any;
    };
}

const API_BASE = "/api/profile/resume";

/**
 * Fetch the authenticated user's uploaded profile resume details and Gemini report
 */
export async function fetchResumeDetailsApi(): Promise<ResumeProfileData> {
    const res = await fetch(`${API_BASE}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to fetch resume details (${res.status})`);
    }
    return res.json();
}

/**
 * Upload resume PDF/DOCX directly to Cloudinary & user profile,
 * automatically executing Gemini AI analysis and storing the report.
 */
export async function uploadResumeApi(file: File): Promise<{
    success: boolean;
    message: string;
    resume: ResumeProfileData;
    report: GeminiAnalysisReport | null;
}> {
    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to upload and analyze resume (${res.status})`);
    }

    return res.json();
}

/**
 * Re-runs Gemini AI analysis on the user's currently uploaded profile resume
 */
export async function reAnalyzeResumeApi(): Promise<{
    success: boolean;
    message: string;
    report: GeminiAnalysisReport;
}> {
    const res = await fetch(`${API_BASE}/re-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to re-analyze resume (${res.status})`);
    }

    return res.json();
}

/**
 * Toggle whether the uploaded resume is publicly visible on the user's profile
 */
export async function toggleResumeVisibilityApi(isResumePublic: boolean): Promise<{
    success: boolean;
    isResumePublic: boolean;
}> {
    const res = await fetch(`${API_BASE}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isResumePublic }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to update visibility (${res.status})`);
    }

    return res.json();
}

/**
 * Delete the uploaded resume from Cloudinary and profile
 */
export async function deleteResumeApi(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to delete resume (${res.status})`);
    }

    return res.json();
}
