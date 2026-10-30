import redis from "../client.js";

export interface PublicProfilePayload {
    id?: string;
    username: string;
    displayName: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    photoUrl?: string | null;
    coverImageUrl?: string;
    headline?: string;
    bio?: string;
    website?: string;
    linkedin?: string | null;
    github?: string | null;
    customLink?: string | null;
    links?: Array<{ label: string; url: string; platform?: string }>;
    location?: string;
    skills?: string[];
    isPublic: boolean;
    isEmailVerified?: boolean;
    isVerifiedCoder?: boolean;
    isVerified?: boolean;
    isOpenToWork?: boolean;
    isHireable?: boolean;
    resumeUrl?: string | null;
    resumeFilename?: string | null;
    resumeFilesize?: number | null;
    resumeUpdatedAt?: string | null;
    isResumePublic?: boolean;
    college?: {
        id: string;
        officialName: string;
        city?: string;
        state?: string;
        district?: string;
        institutionType?: string;
        aisheCode?: string;
        verificationStatus?: string;
    } | null;
    createdAt?: string;
    platforms: Array<{
        portal: string;
        portalUsername: string;
        link: string;
        verified: boolean;
        displayName?: string;
        avatarUrl?: string;
        stats: any[];
        lastSyncStatus?: string;
        lastSyncAt?: string;
    }>;
}

const PUBLIC_PROFILE_TTL = 10 * 60; // 10 minutes
const PRIVATE_PROFILE_TTL = 15 * 60; // 15 minutes

export const getCachedPublicProfile = async (username: string): Promise<PublicProfilePayload | null> => {
    try {
        if (!redis || redis.status !== "ready") return null;
        const key = `profile:public:${username.toLowerCase().trim()}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as PublicProfilePayload;
    } catch {
        return null;
    }
};

export const setCachedPublicProfile = async (username: string, profile: PublicProfilePayload): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `profile:public:${username.toLowerCase().trim()}`;
        await redis.set(key, JSON.stringify(profile), "EX", PUBLIC_PROFILE_TTL);
    } catch {
        // Safe fallback if redis fails
    }
};

export const invalidatePublicProfileCache = async (username: string): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `profile:public:${username.toLowerCase().trim()}`;
        await redis.del(key);
    } catch {
        // Safe fallback
    }
};

export const getCachedPrivateProfile = async (userId: string): Promise<any | null> => {
    try {
        if (!redis || redis.status !== "ready") return null;
        const key = `profile:private:${userId}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data);
    } catch {
        return null;
    }
};

export const setCachedPrivateProfile = async (userId: string, data: any): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `profile:private:${userId}`;
        await redis.set(key, JSON.stringify(data), "EX", PRIVATE_PROFILE_TTL);
    } catch {
        // Safe fallback
    }
};

export const invalidatePrivateProfileCache = async (userId: string): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `profile:private:${userId}`;
        await redis.del(key);
    } catch {
        // Safe fallback
    }
};

export const invalidateAllUserCaches = async (user: { id?: string | undefined; username?: string | undefined; gmail?: string | undefined; email?: string | undefined }): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const promises: Promise<any>[] = [];
        const identifiers = [user.username, user.gmail, user.email].filter(Boolean) as string[];

        for (const ident of identifiers) {
            const raw = ident.trim();
            const lower = raw.toLowerCase();
            const variants = Array.from(new Set([raw, lower]));

            for (const keyVar of variants) {
                promises.push(redis.del(`profile:public:${keyVar}`));
                promises.push(redis.del(`user:portals:${keyVar}`));
                promises.push(redis.del(`user:submissions:unified:${keyVar}`));
                promises.push(redis.del(`user:development:unified:${keyVar}`));
                promises.push(redis.del(`user:contests:unified:${keyVar}`));
                promises.push(redis.del(`user:badges:unified:${keyVar}`));
                promises.push(redis.del(`user:practice:analytics:${keyVar}`));
                promises.push(redis.del(`user:development:analytics:${keyVar}`));
                promises.push(redis.del(`resume:private:${keyVar}`));
                promises.push(redis.del(`resume:public:${keyVar}`));
            }
        }

        if (user.id) {
            promises.push(redis.del(`profile:private:${user.id}`));
            promises.push(redis.del(`user:portals:${user.id}`));
            promises.push(redis.del(`user:submissions:unified:${user.id}`));
            promises.push(redis.del(`user:development:unified:${user.id}`));
            promises.push(redis.del(`user:contests:unified:${user.id}`));
            promises.push(redis.del(`user:badges:unified:${user.id}`));
            promises.push(redis.del(`user:practice:analytics:${user.id}`));
            promises.push(redis.del(`user:development:analytics:${user.id}`));
            promises.push(redis.del(`resume:private:${user.id}`));
        }

        const emailTarget = user.email || user.gmail;
        if (emailTarget) {
            promises.push(redis.del(`auth:user:gmail:${emailTarget.toLowerCase().trim()}`));
        }

        await Promise.allSettled(promises);
    } catch {
        // Safe fallback
    }
};

const RESUME_PRIVATE_TTL = 30 * 60; // 30 minutes
const RESUME_PUBLIC_TTL = 60 * 60; // 60 minutes

export const getCachedResume = async (identifier: string): Promise<any | null> => {
    try {
        if (!redis || redis.status !== "ready") return null;
        const key = `resume:private:${identifier.toLowerCase().trim()}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data);
    } catch {
        return null;
    }
};

export const setCachedResume = async (
    identifier: string,
    data: any,
    ttlSeconds: number = RESUME_PRIVATE_TTL
): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `resume:private:${identifier.toLowerCase().trim()}`;
        await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
        // Safe fallback
    }
};

export const getCachedPublicResume = async (username: string): Promise<any | null> => {
    try {
        if (!redis || redis.status !== "ready") return null;
        const key = `resume:public:${username.toLowerCase().trim()}`;
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data);
    } catch {
        return null;
    }
};

export const setCachedPublicResume = async (
    username: string,
    data: any,
    ttlSeconds: number = RESUME_PUBLIC_TTL
): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `resume:public:${username.toLowerCase().trim()}`;
        await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
        // Safe fallback
    }
};

export const invalidateResumeCache = async (identifiers: {
    id?: string | null;
    username?: string | null;
}): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const keys: string[] = [];
        if (identifiers.id) {
            keys.push(`resume:private:${identifiers.id.toLowerCase().trim()}`);
        }
        if (identifiers.username) {
            const rawUser = identifiers.username.trim();
            const lowerUser = rawUser.toLowerCase();
            keys.push(`resume:private:${lowerUser}`);
            keys.push(`resume:public:${lowerUser}`);
            if (rawUser !== lowerUser) {
                keys.push(`resume:private:${rawUser}`);
                keys.push(`resume:public:${rawUser}`);
            }
        }
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch {
        // Safe fallback
    }
};
