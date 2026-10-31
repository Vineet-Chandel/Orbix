// Backend/src/services/session/deviceParser.ts
import crypto from "crypto";
import type { Request } from "express";

export interface ParsedDeviceInfo {
    deviceName: string;
    deviceType: "desktop" | "laptop" | "mobile" | "tablet";
    browser: string;
    browserVersion: string | null;
    operatingSystem: string;
    operatingSystemVersion: string | null;
    userAgentSummary: string;
    rawUserAgent: string;
    deviceIdHash: string;
    ipAddressMasked: string;
    ipAddressHash: string;
    clientIp: string;
}

/**
 * Extract clean client IP handling standard trusted proxies (Cloudflare, AWS ALB, Nginx)
 */
export function extractClientIp(req: Request): string {
    const cfIp = req.headers["cf-connecting-ip"];
    if (typeof cfIp === "string" && cfIp.trim()) {
        return cfIp.trim();
    }

    const xForwardedFor = req.headers["x-forwarded-for"];
    if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
        const parts = xForwardedFor.split(",");
        const first = parts[0]?.trim();
        if (first) return first;
    }

    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
        return realIp.trim();
    }

    const socketIp = req.socket?.remoteAddress;
    if (socketIp) {
        if (socketIp.startsWith("::ffff:")) {
            return socketIp.substring(7);
        }
        return socketIp;
    }

    return req.ip || "127.0.0.1";
}

/**
 * Mask IP address for user-facing UI (e.g. 103.21.***.*** or 2405:201:****:****)
 */
export function maskIpAddress(ip: string): string {
    const clean = ip.trim();
    if (!clean || clean === "127.0.0.1" || clean === "::1") {
        return "127.0.***.***";
    }

    if (clean.includes(".")) {
        // IPv4
        const parts = clean.split(".");
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***`;
        }
        return `${parts.slice(0, 2).join(".")}.***.***`;
    }

    if (clean.includes(":")) {
        // IPv6
        const parts = clean.split(":");
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}:****:****`;
        }
        return `${clean.substring(0, 8)}:****`;
    }

    return "IP hidden";
}

/**
 * Parse User-Agent into clean device, OS, and browser metadata
 */
export function parseUserAgentAndDevice(req: Request): ParsedDeviceInfo {
    const rawUserAgent = String(req.headers["user-agent"] || "").trim() || "Unknown Browser";
    const clientIp = extractClientIp(req);
    const ipAddressMasked = maskIpAddress(clientIp);
    const ipAddressHash = crypto.createHash("sha256").update(clientIp).digest("hex");

    let operatingSystem = "Unknown OS";
    let operatingSystemVersion: string | null = null;
    let deviceType: "desktop" | "laptop" | "mobile" | "tablet" = "desktop";
    let deviceName = "Personal Computer";

    const ua = rawUserAgent;

    // Detect OS & Device Type
    if (/iPhone/i.test(ua)) {
        operatingSystem = "iOS";
        deviceType = "mobile";
        deviceName = "iPhone";
        const vMatch = ua.match(/OS (\d+[_\d]*)/);
        if (vMatch && vMatch[1]) operatingSystemVersion = vMatch[1].replace(/_/g, ".");
    } else if (/iPad/i.test(ua)) {
        operatingSystem = "iPadOS";
        deviceType = "tablet";
        deviceName = "iPad";
        const vMatch = ua.match(/OS (\d+[_\d]*)/);
        if (vMatch && vMatch[1]) operatingSystemVersion = vMatch[1].replace(/_/g, ".");
    } else if (/Android/i.test(ua)) {
        operatingSystem = "Android";
        deviceType = /Tablet|SM-T|TAB/i.test(ua) ? "tablet" : "mobile";
        const modelMatch = ua.match(/;\s*([^;]+)\s+Build\//);
        deviceName = modelMatch && modelMatch[1] ? modelMatch[1].trim() : "Android Device";
        const vMatch = ua.match(/Android\s+([0-9.]+)/i);
        if (vMatch && vMatch[1]) operatingSystemVersion = vMatch[1];
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
        operatingSystem = "macOS";
        deviceType = "laptop";
        deviceName = "MacBook Pro"; // canonical friendly name for Apple Silicon/macOS devices
        const vMatch = ua.match(/Mac OS X (\d+[_\d]*)/);
        if (vMatch && vMatch[1]) operatingSystemVersion = vMatch[1].replace(/_/g, ".");
    } else if (/Windows NT/i.test(ua)) {
        operatingSystem = "Windows";
        deviceType = "desktop";
        if (/Windows NT 10.0/i.test(ua)) {
            // Chrome UA doesn't differentiate Win 10 vs 11 directly without Client Hints
            operatingSystemVersion = "10/11";
            deviceName = "Windows PC";
        } else if (/Windows NT 6.3/i.test(ua)) {
            operatingSystemVersion = "8.1";
            deviceName = "Windows PC";
        } else if (/Windows NT 6.1/i.test(ua)) {
            operatingSystemVersion = "7";
            deviceName = "Windows PC";
        } else {
            deviceName = "Windows PC";
        }
    } else if (/CrOS/i.test(ua)) {
        operatingSystem = "ChromeOS";
        deviceType = "laptop";
        deviceName = "Chromebook";
    } else if (/Linux/i.test(ua)) {
        operatingSystem = "Linux";
        deviceType = "desktop";
        if (/Ubuntu/i.test(ua)) {
            deviceName = "Ubuntu Workstation";
        } else if (/Fedora/i.test(ua)) {
            deviceName = "Fedora Workstation";
        } else {
            deviceName = "Linux Workstation";
        }
    }

    // Detect Browser & Version
    let browser = "Web Browser";
    let browserVersion: string | null = null;

    if (/Edg\/([0-9.]+)/i.test(ua)) {
        browser = "Edge";
        browserVersion = ua.match(/Edg\/([0-9.]+)/i)?.[1] || null;
    } else if (/OPR\/([0-9.]+)/i.test(ua) || /Opera/i.test(ua)) {
        browser = "Opera";
        browserVersion = ua.match(/OPR\/([0-9.]+)/i)?.[1] || null;
    } else if (/Brave/i.test(ua)) {
        browser = "Brave";
        browserVersion = ua.match(/Chrome\/([0-9.]+)/i)?.[1] || null;
    } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
        browser = "Chrome";
        browserVersion = ua.match(/Chrome\/([0-9.]+)/i)?.[1] || null;
    } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
        browser = "Firefox";
        browserVersion = ua.match(/Firefox\/([0-9.]+)/i)?.[1] || null;
    } else if (/Version\/([0-9.]+).*Safari/i.test(ua)) {
        browser = "Safari";
        browserVersion = ua.match(/Version\/([0-9.]+)/i)?.[1] || null;
    }

    // Create readable summary
    const cleanBrowserVer = browserVersion ? browserVersion.split(".")[0] : "";
    const userAgentSummary = `${browser}${cleanBrowserVer ? ` ${cleanBrowserVer}` : ""} · ${operatingSystem}`;

    // First-party Device Fingerprint Identifier
    // We prioritize client-provided first-party device identifier header or cookie,
    // combined with operating system and browser family for stable recognition.
    const explicitDeviceId =
        (req.headers["x-orbix-device-id"] as string) ||
        (req.cookies?.["orbix_did"] as string) ||
        "";

    const fingerprintPayload = explicitDeviceId
        ? `${explicitDeviceId}:${operatingSystem}:${browser}`
        : `${clientIp.split(".").slice(0, 2).join(".")}:${operatingSystem}:${browser}:${rawUserAgent}`;

    const deviceIdHash = crypto
        .createHash("sha256")
        .update(`orbix-device-salt:${fingerprintPayload}`)
        .digest("hex");

    return {
        deviceName,
        deviceType,
        browser,
        browserVersion,
        operatingSystem,
        operatingSystemVersion,
        userAgentSummary,
        rawUserAgent,
        deviceIdHash,
        ipAddressMasked,
        ipAddressHash,
        clientIp,
    };
}
