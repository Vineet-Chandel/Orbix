// Frontend/src/api/clubSettingsApi.ts

const API_BASE = "/api/club/settings";

function getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export interface ClubSettingsStatusResponse {
    success: boolean;
    club: {
        id: string;
        name: string;
        slug: string;
        category: string;
        college_name: string;
        college_city: string;
        college_state: string;
        college_country: string;
        short_description: string | null;
        about: string | null;
        mission: string | null;
        vision: string | null;
        founded_year: number | null;
        operating_status: string;
        focus_areas: string[];
        logo_url: string | null;
        cover_image_url: string | null;
        website_url: string | null;
        public_email: string | null;
        contact_phone: string | null;
        social_links: Record<string, string>;
        is_active: boolean;
        verified_at: string;
        created_at: string;
        updated_at: string;
        profile_visibility: "public" | "unlisted" | "private";
        publication_status: "draft" | "published" | "hidden";
        recruitment_status: "open" | "closed" | "upcoming";
        recruitment_announcement: string | null;
        recruitment_url: string | null;
        isPublic: boolean;
    };
    user: {
        id: string;
        username: string;
        gmail: string;
        displayName: string;
        primaryEmail: string;
        isEmailVerified: boolean;
        emailVerifiedAt: string | null;
        isTwoFactorEnabled: boolean;
        createdAt: string;
        phone?: string;
        isPhoneVerified?: boolean;
    };
    verification: {
        isVerifiedClub: boolean;
        verifiedAt: string;
        collegeName: string;
        category: string;
        standing: string;
        tier: string;
    };
    monthlyLimits: {
        email: {
            used: number;
            limit: number;
            remaining: number;
            canChange: boolean;
            nextResetAt: string;
        };
        username: {
            used: number;
            limit: number;
            remaining: number;
            canChange: boolean;
            nextResetAt: string;
        };
    };
    stats: {
        eventsCount: number;
        teamMembersCount: number;
        unreadInboxCount: number;
    };
}

export async function fetchClubSettingsStatus(): Promise<ClubSettingsStatusResponse> {
    const res = await fetch(`${API_BASE}/status`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to fetch club settings status (${res.status})`);
    }

    return data;
}

export async function updateClubPrivacy(params: {
    profileVisibility?: "public" | "unlisted" | "private";
    isPublic?: boolean;
    recruitmentStatus?: "open" | "closed" | "upcoming";
}) {
    const res = await fetch(`${API_BASE}/privacy`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to update club privacy (${res.status})`);
    }

    return data;
}

export async function changeClubPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword?: string;
}) {
    const res = await fetch(`${API_BASE}/password/change`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to update password (${res.status})`);
    }

    return data;
}

export async function sendClubEmailVerificationOtp(email?: string) {
    const res = await fetch(`${API_BASE}/verify-email/send`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to send verification code (${res.status})`);
    }

    return data;
}

export async function confirmClubEmailVerificationOtp(otp: string) {
    const res = await fetch(`${API_BASE}/verify-email/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ otp }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Failed to confirm verification code (${res.status})`);
    }

    return data;
}
