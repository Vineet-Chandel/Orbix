export function resolveGitHubLinkReturnTo(returnTo: unknown, frontendUrl: string): string {
    const frontend = new URL(frontendUrl);
    const fallback = new URL("/onboarding", frontend);
    try {
        const destination = new URL(typeof returnTo === "string" ? returnTo : "/onboarding", frontend);
        const isSameOrigin = destination.origin === frontend.origin;
        const isCanonicalDomain =
            (destination.hostname === "theorbix.world" || destination.hostname === "www.theorbix.world") &&
            (frontend.hostname === "theorbix.world" || frontend.hostname === "www.theorbix.world") &&
            destination.protocol === "https:";
        if (!isSameOrigin && !isCanonicalDomain) return fallback.href;
        return destination.href;
    } catch {
        return fallback.href;
    }
}

export function assertGitHubLinkIdentity(targetUsername: string | undefined, authenticatedUsername: string | undefined): void {
    if (targetUsername && targetUsername.trim().toLowerCase() !== authenticatedUsername?.trim().toLowerCase()) {
        const error = new Error(`Sign in to GitHub as @${targetUsername.trim()} to verify this account.`) as Error & { statusCode: number; code: string };
        error.statusCode = 409;
        error.code = "IDENTITY_MISMATCH";
        throw error;
    }
}
