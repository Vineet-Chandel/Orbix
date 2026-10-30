/**
 * Client API for Orbix Club Profile Management & Dynamic Public Profiles
 */

export interface ClubProfileData {
    id: string;
    name: string;
    slug: string;
    clubUsername?: string;
    category: string;
    collegeId?: string;
    collegeName: string;
    collegeCity: string;
    collegeState: string;
    collegeCountry: string;
    shortDescription: string | null;
    about: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    websiteUrl: string | null;
    publicEmail: string | null;
    contactPhone: string | null;
    socialLinks: {
        github?: string;
        linkedin?: string;
        instagram?: string;
        x?: string;
        twitter?: string;
        discord?: string;
        youtube?: string;
    } | null;
    foundedYear: number | null;
    operatingStatus: "active" | "recruiting" | "hiatus" | "inactive";
    mission: string | null;
    vision: string | null;
    focusAreas: string[];
    publicationStatus: "draft" | "published" | "hidden";
    profileVisibility: "public" | "unlisted" | "private";
    recruitmentStatus: "open" | "closed" | "upcoming";
    recruitmentAnnouncement: string | null;
    recruitmentUrl: string | null;
    isActive: boolean;
    verifiedAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface ClubCoordinator {
    id: string;
    clubId: string;
    linkedUserId?: string | null;
    name: string;
    department?: string | null;
    role: string;
    imageUrl?: string | null;
    isPrimary: boolean;
    displayOrder: number;
    isPublic: boolean;
    contactEmail?: string | null;
    linkedinUrl?: string | null;
    createdAt: string;
    updatedAt: string;
    linkedUsername?: string;
    linkedDisplayName?: string;
    linkedAvatarUrl?: string;
}

export interface ClubAchievement {
    id: string;
    clubId: string;
    title: string;
    description?: string | null;
    achievementDate?: string | null;
    issuer?: string | null;
    imageUrl?: string | null;
    externalLink?: string | null;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface ClubProfileResponse {
    success: boolean;
    club: ClubProfileData;
    coordinators: ClubCoordinator[];
    achievements: ClubAchievement[];
    stats: {
        upcoming_count: number;
        past_count: number;
        draft_count: number;
        total_count: number;
    };
    permissions: {
        clubId: string;
        clubName: string;
        clubSlug: string;
        userRole: string;
        isOwner: boolean;
        isAdmin: boolean;
        isTeamLead: boolean;
        canManageProfile: boolean;
    };
    completion: {
        percentage: number;
        completedItems: string[];
        missingItems: string[];
    };
}

export interface UploadSignatureConfig {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    publicId: string;
    folder: string;
    signature: string;
    uploadUrl: string;
}

export async function fetchClubFullProfile(clubId?: string): Promise<ClubProfileResponse> {
    const url = clubId ? `/api/club/profile?clubId=${encodeURIComponent(clubId)}` : "/api/club/profile";
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to fetch club profile.");
    }
    return data;
}

export async function updateClubProfile(payload: Record<string, any>, clubId?: string): Promise<ClubProfileResponse> {
    const url = clubId ? `/api/club/profile?clubId=${encodeURIComponent(clubId)}` : "/api/club/profile";
    const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update club profile.");
    }
    return data;
}

export async function requestClubUploadSignature(
    type: "logo" | "banner" | "coordinator" | "achievement",
    clubId?: string
): Promise<UploadSignatureConfig> {
    const res = await fetch("/api/club/profile/upload-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to generate upload signature.");
    }
    return data.uploadConfig;
}

export function uploadClubImageToCloudinary(
    config: UploadSignatureConfig,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ secureUrl: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        secureUrl: response.secure_url,
                        publicId: response.public_id || config.publicId,
                    });
                } catch {
                    reject(new Error("Failed to parse Cloudinary response."));
                }
            } else {
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    reject(new Error(errRes.error?.message || `Upload failed with HTTP ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed with HTTP ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Network connection error during image upload."));
        });

        xhr.addEventListener("abort", () => {
            reject(new Error("Image upload was cancelled."));
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", config.apiKey);
        formData.append("timestamp", String(config.timestamp));
        formData.append("signature", config.signature);
        formData.append("public_id", config.publicId);

        xhr.open("POST", config.uploadUrl);
        xhr.send(formData);
    });
}

// =========================================================================
// COORDINATOR API
// =========================================================================

export async function addCoordinator(
    coordinator: {
        name: string;
        department?: string;
        role: string;
        imageUrl?: string;
        isPrimary?: boolean;
        isPublic?: boolean;
        contactEmail?: string;
        linkedinUrl?: string;
        linkedUserId?: string;
    },
    clubId?: string
): Promise<ClubCoordinator> {
    const res = await fetch("/api/club/profile/coordinators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...coordinator, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to add coordinator.");
    }
    return data.coordinator;
}

export async function updateCoordinator(
    id: string,
    updates: Partial<ClubCoordinator>,
    clubId?: string
): Promise<ClubCoordinator> {
    const res = await fetch(`/api/club/profile/coordinators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...updates, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update coordinator.");
    }
    return data.coordinator;
}

export async function deleteCoordinator(id: string, clubId?: string): Promise<void> {
    const url = clubId ? `/api/club/profile/coordinators/${id}?clubId=${encodeURIComponent(clubId)}` : `/api/club/profile/coordinators/${id}`;
    const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to delete coordinator.");
    }
}

export async function reorderCoordinators(coordinatorIds: string[], clubId?: string): Promise<void> {
    const res = await fetch("/api/club/profile/coordinators/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ coordinatorIds, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to reorder coordinators.");
    }
}

// =========================================================================
// ACHIEVEMENT API
// =========================================================================

export async function addAchievement(
    achievement: {
        title: string;
        description?: string;
        achievementDate?: string;
        issuer?: string;
        imageUrl?: string;
        externalLink?: string;
    },
    clubId?: string
): Promise<ClubAchievement> {
    const res = await fetch("/api/club/profile/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...achievement, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to add achievement.");
    }
    return data.achievement;
}

export async function updateAchievement(
    id: string,
    updates: Partial<ClubAchievement>,
    clubId?: string
): Promise<ClubAchievement> {
    const res = await fetch(`/api/club/profile/achievements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...updates, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update achievement.");
    }
    return data.achievement;
}

export async function deleteAchievement(id: string, clubId?: string): Promise<void> {
    const url = clubId ? `/api/club/profile/achievements/${id}?clubId=${encodeURIComponent(clubId)}` : `/api/club/profile/achievements/${id}`;
    const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to delete achievement.");
    }
}

export async function reorderAchievements(achievementIds: string[], clubId?: string): Promise<void> {
    const res = await fetch("/api/club/profile/achievements/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ achievementIds, clubId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to reorder achievements.");
    }
}

export interface CollegeClubItem extends ClubProfileData {
    memberCount: number;
    eventsCount: number;
    achievementsCount: number;
    coordinatorsCount: number;
    isCurrentClub: boolean;
    coordinators: ClubCoordinator[];
    achievements: ClubAchievement[];
}

export interface CollegeClubsResponse {
    success: boolean;
    collegeName: string;
    collegeId: string | null;
    totalClubs: number;
    clubs: CollegeClubItem[];
}

export async function fetchCollegeClubs(options?: {
    collegeId?: string;
    collegeName?: string;
    clubId?: string;
}): Promise<CollegeClubsResponse> {
    const params = new URLSearchParams();
    if (options?.collegeId) params.set("collegeId", options.collegeId);
    if (options?.collegeName) params.set("collegeName", options.collegeName);
    if (options?.clubId) params.set("clubId", options.clubId);

    const qs = params.toString();
    const url = `/api/club/college-clubs${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to retrieve college clubs.");
    }
    return data;
}
