import redis from "../client.js";

const CLUB_PUBLIC_CACHE_PREFIX = "cache:club:public:";

export async function getCachedPublicClubProfile(slug: string): Promise<any | null> {
    try {
        if (!redis || redis.status !== "ready") return null;
        const key = `${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`;
        const raw = await redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function setCachedPublicClubProfile(slug: string, data: any, ttlSeconds = 600): Promise<void> {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`;
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
        // Non-fatal cache write failure
    }
}

export async function invalidateClubProfileCache(slug?: string, otherSlugs: string[] = []): Promise<void> {
    try {
        if (!redis || redis.status !== "ready") return;
        const keysToDelete: string[] = [];
        if (slug) {
            keysToDelete.push(`${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`);
        }
        for (const s of otherSlugs) {
            if (s) keysToDelete.push(`${CLUB_PUBLIC_CACHE_PREFIX}${s.toLowerCase()}`);
        }

        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
        }
    } catch {
        // Non-fatal cache invalidation failure
    }
}
