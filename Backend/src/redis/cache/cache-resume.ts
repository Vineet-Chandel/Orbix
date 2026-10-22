import redis from "../client.js";
import crypto from "node:crypto";

export interface ResumePayload {
    hasResume: boolean;
    resumeUrl: string | null;
    viewUrl: string;
    downloadUrl: string;
    signedUrl: string | null;
    rawUrl: string | null;
    resumeFilename: string | null;
    resumeFilesize: number | null;
    resumeUpdatedAt: string | null;
    isResumePublic: boolean;
    checks: any[];
    metadata: any;
}

const RESUME_METADATA_TTL = 30 * 60; // 30 minutes
const RESUME_PUBLIC_TTL = 60 * 60; // 1 hour
const RESUME_PDF_BUFFER_TTL = 24 * 60 * 60; // 24 hours
const MAX_CACHABLE_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Clean and normalize cache keys
 */
const normalizeKey = (key: string): string => key.trim().toLowerCase();

/**
 * Fetch cached resume metadata for authenticated user
 */
export const getCachedResumeMetadata = async (identifier: string): Promise<ResumePayload | null> => {
    try {
        if (!redis || redis.status !== "ready" || !identifier) return null;
        const key = `resume:meta:private:${normalizeKey(identifier)}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as ResumePayload;
    } catch {
        return null;
    }
};

/**
 * Save resume metadata for authenticated user in Redis
 */
export const setCachedResumeMetadata = async (
    identifier: string,
    payload: ResumePayload,
    ttlSeconds: number = RESUME_METADATA_TTL
): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready" || !identifier) return;
        const key = `resume:meta:private:${normalizeKey(identifier)}`;
        await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
    } catch {
        // Safe fallback
    }
};

/**
 * Fetch cached public resume metadata by username
 */
export const getCachedPublicResumeMetadata = async (username: string): Promise<ResumePayload | null> => {
    try {
        if (!redis || redis.status !== "ready" || !username) return null;
        const key = `resume:meta:public:${normalizeKey(username)}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as ResumePayload;
    } catch {
        return null;
    }
};

/**
 * Save public resume metadata in Redis
 */
export const setCachedPublicResumeMetadata = async (
    username: string,
    payload: ResumePayload,
    ttlSeconds: number = RESUME_PUBLIC_TTL
): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready" || !username) return;
        const key = `resume:meta:public:${normalizeKey(username)}`;
        await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
    } catch {
        // Safe fallback
    }
};

/**
 * Invalidate all resume caches across private, public, and binary stores
 */
export const invalidateAllResumeCaches = async (identifiers: {
    id?: string | null;
    username?: string | null;
    publicId?: string | null;
}): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const keys: string[] = [];

        if (identifiers.id) {
            keys.push(`resume:meta:private:${normalizeKey(identifiers.id)}`);
        }

        if (identifiers.username) {
            const normalized = normalizeKey(identifiers.username);
            keys.push(`resume:meta:private:${normalized}`);
            keys.push(`resume:meta:public:${normalized}`);
        }

        if (identifiers.publicId) {
            const safePublicId = identifiers.publicId.replace(/[^a-zA-Z0-9_-]/g, "_");
            keys.push(`resume:bin:pdf:${safePublicId}`);
            keys.push(`resume:bin:meta:${safePublicId}`);
        }

        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch {
        // Safe fallback
    }
};

/**
 * Get cached PDF binary buffer and ETag
 */
export const getCachedPdfBuffer = async (
    publicId: string
): Promise<{ buffer: Buffer; etag: string; contentType: string } | null> => {
    try {
        if (!redis || redis.status !== "ready" || !publicId) return null;
        const safePublicId = publicId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const metaKey = `resume:bin:meta:${safePublicId}`;
        const binKey = `resume:bin:pdf:${safePublicId}`;

        const [metaRaw, buffer] = await Promise.all([
            redis.get(metaKey),
            redis.getBuffer(binKey),
        ]);

        if (!metaRaw || !buffer) return null;

        const meta = JSON.parse(metaRaw);
        return {
            buffer,
            etag: meta.etag || `"${crypto.createHash("md5").update(buffer).digest("hex")}"`,
            contentType: meta.contentType || "application/pdf",
        };
    } catch {
        return null;
    }
};

/**
 * Cache PDF binary buffer and ETag in Redis
 */
export const setCachedPdfBuffer = async (
    publicId: string,
    buffer: Buffer,
    etag?: string,
    contentType: string = "application/pdf"
): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready" || !publicId || !buffer) return;
        if (buffer.length > MAX_CACHABLE_PDF_BYTES) return; // Only cache up to 5 MB

        const safePublicId = publicId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const metaKey = `resume:bin:meta:${safePublicId}`;
        const binKey = `resume:bin:pdf:${safePublicId}`;

        const effectiveEtag = etag || `"${crypto.createHash("md5").update(buffer).digest("hex")}"`;

        const meta = {
            etag: effectiveEtag,
            contentType,
            size: buffer.length,
            cachedAt: Date.now(),
        };

        const pipeline = redis.pipeline();
        pipeline.set(binKey, buffer, "EX", RESUME_PDF_BUFFER_TTL);
        pipeline.set(metaKey, JSON.stringify(meta), "EX", RESUME_PDF_BUFFER_TTL);
        await pipeline.exec();
    } catch {
        // Safe fallback
    }
};
