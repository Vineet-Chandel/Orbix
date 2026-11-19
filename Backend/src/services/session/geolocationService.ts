// Backend/src/services/session/geolocationService.ts
import redis from "../../redis/client.js";

export interface GeoLocationResult {
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    locationSummary: string;
}

// In-memory LRU cache to prevent hammering external providers
const localCache = new Map<string, { data: GeoLocationResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if IP is private or local loopback
 */
function isPrivateOrLocalIp(ip: string): boolean {
    const clean = ip.trim().toLowerCase();
    if (
        clean === "127.0.0.1" ||
        clean === "::1" ||
        clean === "localhost" ||
        clean.startsWith("192.168.") ||
        clean.startsWith("10.") ||
        clean.startsWith("172.16.") ||
        clean.startsWith("172.17.") ||
        clean.startsWith("172.18.") ||
        clean.startsWith("172.19.") ||
        clean.startsWith("172.20.") ||
        clean.startsWith("172.21.") ||
        clean.startsWith("172.22.") ||
        clean.startsWith("172.23.") ||
        clean.startsWith("172.24.") ||
        clean.startsWith("172.25.") ||
        clean.startsWith("172.26.") ||
        clean.startsWith("172.27.") ||
        clean.startsWith("172.28.") ||
        clean.startsWith("172.29.") ||
        clean.startsWith("172.30.") ||
        clean.startsWith("172.31.") ||
        clean.startsWith("fc00:") ||
        clean.startsWith("fe80:")
    ) {
        return true;
    }
    return false;
}

/**
 * Approximate server-side IP geolocation
 * Always non-blocking, fast timeout (1500ms max), resilient fallback
 */
export async function resolveApproximateLocation(ip: string): Promise<GeoLocationResult> {
    const fallback: GeoLocationResult = {
        city: null,
        region: null,
        country: null,
        countryCode: null,
        locationSummary: "Location unavailable",
    };

    if (!ip || typeof ip !== "string") {
        return fallback;
    }

    const cleanIp = ip.trim();

    // 1. Private / Localhost check
    if (isPrivateOrLocalIp(cleanIp)) {
        return {
            city: "Localhost",
            region: "Development",
            country: "Local Network",
            countryCode: "DEV",
            locationSummary: "Local Development Environment",
        };
    }

    // 2. In-memory Cache check
    const cached = localCache.get(cleanIp);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    // 3. Redis Cache check
    try {
        if (redis && redis.status === "ready") {
            const redisVal = await redis.get(`geoip:${cleanIp}`);
            if (redisVal) {
                const parsed = JSON.parse(redisVal);
                localCache.set(cleanIp, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
                return parsed;
            }
        }
    } catch {
        // Non-blocking cache error
    }

    // 4. External IP Geolocation with strict 1500ms timeout
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        // Using free, open IP lookup endpoint with fallback
        const response = await fetch(`https://ipwho.is/${cleanIp}`, {
            signal: controller.signal,
            headers: { "User-Agent": "Orbix-Security-Engine/2.4" },
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data: any = await response.json();
            if (data && data.success !== false) {
                const city = data.city || null;
                const region = data.region || null;
                const country = data.country || null;
                const countryCode = data.country_code || null;

                const summaryParts = [city, region, country].filter(Boolean);
                const locationSummary = summaryParts.length > 0 ? summaryParts.join(", ") : "Location unavailable";

                const result: GeoLocationResult = {
                    city,
                    region,
                    country,
                    countryCode,
                    locationSummary,
                };

                // Store in memory & Redis
                localCache.set(cleanIp, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
                if (redis && redis.status === "ready") {
                    await redis.set(`geoip:${cleanIp}`, JSON.stringify(result), "EX", 60 * 60 * 48).catch(() => {});
                }

                return result;
            }
        }
    } catch {
        // Network timeout or external provider offline - fail silently to fallback
    }

    return fallback;
}
