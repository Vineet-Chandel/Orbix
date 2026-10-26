import type {
    ResumeContent,
    ResumeDocument,
    ResumeVersion,
    AnalysisReport,
    JobMatchReport,
    ProfileImportSummary,
    ExportValidationResult,
} from "../../../Backend/src/services/resume/resumeTypes";

const API_BASE = "/api/profile/resume";

export async function fetchProfileDataForResume(): Promise<ProfileImportSummary> {
    const res = await fetch(`${API_BASE}/builder/profile-data`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to import profile data (${res.status})`);
    }
    return res.json();
}

export async function fetchResumeDocuments(): Promise<ResumeDocument[]> {
    const res = await fetch(`${API_BASE}/documents`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to fetch resumes (${res.status})`);
    }
    const data = await res.json();
    return data.documents || [];
}

export async function fetchResumeDocumentById(id: string): Promise<{
    document: ResumeDocument;
    versions: ResumeVersion[];
    analyses: AnalysisReport[];
}> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to fetch resume document (${res.status})`);
    }
    return res.json();
}

export async function createResumeDocument(payload: {
    title: string;
    targetRole: string;
    templateId: string;
    content: ResumeContent;
    completenessScore: number;
    isPrimary?: boolean;
}): Promise<ResumeDocument> {
    const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to create resume (${res.status})`);
    }
    const data = await res.json();
    return data.document;
}

export async function updateResumeDocument(
    id: string,
    payload: {
        title?: string;
        targetRole?: string;
        templateId?: string;
        content?: ResumeContent;
        completenessScore?: number;
        isPrimary?: boolean;
    }
): Promise<ResumeDocument> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to save resume (${res.status})`);
    }
    const data = await res.json();
    return data.document;
}

export async function deleteResumeDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to delete resume (${res.status})`);
    }
}

export async function createResumeVersion(
    resumeId: string,
    payload: {
        versionLabel: string;
        targetRole?: string;
        companyName?: string;
        jobDescription?: string;
        content: ResumeContent;
    }
): Promise<ResumeVersion> {
    const res = await fetch(`${API_BASE}/documents/${resumeId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to save version (${res.status})`);
    }
    const data = await res.json();
    return data.version;
}

export async function analyzeResumeApi(payload: {
    resumeId?: string;
    versionId?: string;
    content: ResumeContent;
    fileSizeMb?: number;
}): Promise<AnalysisReport> {
    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Analysis failed (${res.status})`);
    }
    const data = await res.json();
    return data.report;
}

export async function runJobMatchApi(payload: {
    content: ResumeContent;
    targetRole: string;
    companyName?: string;
    jobDescription?: string;
}): Promise<JobMatchReport> {
    const res = await fetch(`${API_BASE}/job-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Job match failed (${res.status})`);
    }
    const data = await res.json();
    return data.matchReport;
}

export async function downloadResumePdf(
    content: ResumeContent,
    templateId: string = "ats_clean_single",
    filename?: string
): Promise<{ blob: Blob; validation: ExportValidationResult }> {
    const res = await fetch(`${API_BASE}/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, templateId, filename }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `PDF export failed (${res.status})`);
    }

    const validation: ExportValidationResult = {
        success: res.headers.get("X-Orbix-Validation-Success") === "true",
        format: "pdf",
        filesizeBytes: Number(res.headers.get("X-Orbix-Filesize-Bytes") || 0),
        filesizeMb: Number(res.headers.get("X-Orbix-Filesize-Bytes") || 0) / (1024 * 1024),
        pageCount: Number(res.headers.get("X-Orbix-Page-Count") || 1),
        isUnder5Mb: true,
        extractedCharacters: 1,
        textIntegrityPassed: true,
        verifiedTokensFound: [],
        missingTokens: [],
        warnings: [],
    };

    const blob = await res.blob();
    return { blob, validation };
}

export async function downloadResumeDocx(
    content: ResumeContent,
    templateId: string = "ats_clean_single",
    filename?: string
): Promise<{ blob: Blob; validation: ExportValidationResult }> {
    const res = await fetch(`${API_BASE}/export/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, templateId, filename }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `DOCX export failed (${res.status})`);
    }

    const validation: ExportValidationResult = {
        success: res.headers.get("X-Orbix-Validation-Success") === "true",
        format: "docx",
        filesizeBytes: Number(res.headers.get("X-Orbix-Filesize-Bytes") || 0),
        filesizeMb: Number(res.headers.get("X-Orbix-Filesize-Bytes") || 0) / (1024 * 1024),
        pageCount: 1,
        isUnder5Mb: true,
        extractedCharacters: 1,
        textIntegrityPassed: true,
        verifiedTokensFound: [],
        missingTokens: [],
        warnings: [],
    };

    const blob = await res.blob();
    return { blob, validation };
}

export async function uploadAndAnalyzeResumeFile(file: File): Promise<{
    filename: string;
    filesizeBytes: number;
    pageCount: number;
    detectedSections: string[];
    rawTextPreview: string;
    parsedDraft: ResumeContent;
    report: AnalysisReport;
}> {
    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch(`${API_BASE}/upload-analyze`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Upload analysis failed (${res.status})`);
    }

    return res.json();
}
