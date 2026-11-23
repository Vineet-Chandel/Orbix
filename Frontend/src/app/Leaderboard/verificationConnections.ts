export interface VerificationConnection { portal: string; username: string; verified: boolean }

/** Ownership must come from the server's explicit status, never a profile sync flag. */
export function getVerificationConnections(platforms: Array<Record<string, unknown>> = []): VerificationConnection[] {
    const connections = new Map<string, VerificationConnection>();
    for (const platform of platforms) {
        const portal = String(platform.portal || "").trim().toLowerCase();
        const username = String(platform.portalUsername || platform.portal_username || platform.username || "").trim();
        if (!portal || !username) continue;
        connections.set(portal, {
            portal, username,
            verified: (platform.ownershipStatus || platform.ownership_status) === "VERIFIED",
        });
    }
    return [...connections.values()];
}
