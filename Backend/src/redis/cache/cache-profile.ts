import redis from "../client.js";

export interface PublicProfilePayload {
    id?: string;
    username: string;
    displayName: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    headline?: string;
    bio?: string;
    website?: string;
    location?: string;
    skills?: string[];
    isPublic: boolean;
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

export const invalidateAllUserCaches = async (user: { id?: string; username?: string; gmail?: string }): Promise<void> => {
    try {
        if (!redis || redis.status !== "ready") return;
        const promises: Promise<any>[] = [];
        if (user.username) {
            promises.push(redis.del(`profile:public:${user.username.toLowerCase().trim()}`));
            promises.push(redis.del(`user:portals:${user.username.toLowerCase().trim()}`));
        }
        if (user.id) {
            promises.push(redis.del(`profile:private:${user.id}`));
        }
        if (user.gmail) {
            promises.push(redis.del(`user:portals:${user.gmail.toLowerCase().trim()}`));
            promises.push(redis.del(`auth:user:gmail:${user.gmail.toLowerCase().trim()}`));
        }
        await Promise.allSettled(promises);
    } catch {
        // Safe fallback
    }
};
