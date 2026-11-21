/**
 * ORBIX PLATFORM VERIFICATION - ADAPTER REGISTRY
 * 
 * Central registry for Tier 1 verified platform adapters.
 * Unsupported platforms (Tier 2/3) return structured, explicit unsupported status.
 */

import type { PlatformAdapter } from "./adapterInterface.js";
import { LeetCodeAdapter } from "./leetcodeAdapter.js";
import { CodeforcesAdapter } from "./codeforcesAdapter.js";
import { HackerRankAdapter } from "./hackerrankAdapter.js";
import { GitHubAdapter } from "./githubAdapter.js";

class AdapterRegistry {
    private readonly adapters: Map<string, PlatformAdapter> = new Map();

    constructor() {
        this.register(new LeetCodeAdapter());
        this.register(new CodeforcesAdapter());
        this.register(new HackerRankAdapter());
        this.register(new GitHubAdapter());
    }

    public register(adapter: PlatformAdapter): void {
        this.adapters.set(adapter.portal.toLowerCase().trim(), adapter);
    }

    public getAdapter(portal: string): PlatformAdapter | undefined {
        if (!portal || typeof portal !== 'string') {
            return undefined;
        }
        return this.adapters.get(portal.toLowerCase().trim());
    }

    public isSupported(portal: string): boolean {
        return this.getAdapter(portal) !== undefined;
    }

    public getSupportedPortals(): string[] {
        return Array.from(this.adapters.keys());
    }

    public getUnsupportedResponse(portal: string): {
        success: false;
        error: string;
        code: 'UNSUPPORTED_PLATFORM';
        supportedPlatforms: string[];
    } {
        const cleanPortal = String(portal || "").trim();
        return {
            success: false,
            error: `Automated ownership verification is currently unsupported for platform '${cleanPortal}'. Supported Tier 1 platforms are: ${this.getSupportedPortals().join(', ')}.`,
            code: 'UNSUPPORTED_PLATFORM',
            supportedPlatforms: this.getSupportedPortals(),
        };
    }
}

export const platformAdapterRegistry = new AdapterRegistry();
export { platformAdapterRegistry as adapterRegistry, AdapterRegistry };

export function getSupportedPlatforms(): string[] {
    return platformAdapterRegistry.getSupportedPortals();
}

export function normalizePlatformName(name: string): string {
    return (name || "").toLowerCase().trim();
}
