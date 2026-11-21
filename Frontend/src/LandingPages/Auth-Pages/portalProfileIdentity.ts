interface ProfileIdentity {
    success: boolean;
    portal: string;
    username: string;
}

export function matchesPortalProfileIdentity(profile: ProfileIdentity | null | undefined, portalId: string, username: string): boolean {
    const normalizedPortal = portalId.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    return Boolean(profile?.success && normalizedPortal && normalizedUsername &&
        profile.portal?.trim().toLowerCase() === normalizedPortal &&
        profile.username?.trim().toLowerCase() === normalizedUsername);
}
