export interface CollegeEventItem {
    id: string;
    clubId: string;
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string | null;
    registrationUrl: string | null;
    coverImageUrl: string | null;
    status: "published" | "draft" | "cancelled";
    publishedAt: string | null;
    createdAt: string;
    clubName: string;
    clubSlug: string;
    clubLogoUrl: string;
    clubBannerUrl: string;
    collegeName: string;
    collegeId?: string | null;
    clubCategory?: string;
    likesCount: number;
    hasLiked: boolean;
    isRegistered: boolean;
    registrationStatus: "registered" | "attended" | "waitlisted" | "cancelled" | null;
    ticketCode: string | null;
    registrationsCount: number;
}

export interface CollegeEventsResponse {
    success: boolean;
    collegeName: string;
    collegeId: string | null;
    events: CollegeEventItem[];
}

export interface ApplyForEventPayload {
    applicantName: string;
    applicantEmail: string;
    department?: string;
    yearOfStudy?: string;
    rollNumber?: string;
    phoneNumber?: string;
    notes?: string;
}

export interface StudentApplicationItem {
    id: string;
    eventId: string;
    clubId: string;
    status: "registered" | "attended" | "waitlisted" | "cancelled";
    registeredAt: string;
    checkedInAt: string | null;
    ticketCode: string;
    applicantName: string;
    applicantEmail: string;
    department: string | null;
    yearOfStudy: string | null;
    rollNumber: string | null;
    phoneNumber: string | null;
    notes: string | null;
    eventTitle: string;
    eventSlug: string;
    eventSummary: string | null;
    eventDescription: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string | null;
    coverImageUrl: string | null;
    eventStatus: string;
    clubName: string;
    clubSlug: string;
    clubLogoUrl: string;
    collegeName: string;
}

export interface ClubEventApplicantRow {
    id: string;
    userId: string;
    applicantName: string;
    applicantEmail: string;
    username: string;
    avatarUrl: string | null;
    department: string;
    yearOfStudy: string;
    rollNumber: string;
    phoneNumber: string;
    ticketCode: string;
    status: "registered" | "attended" | "waitlisted" | "cancelled";
    registeredAt: string;
    checkedInAt: string | null;
    notes: string;
}

export interface ClubEventApplicationsResponse {
    success: boolean;
    event: {
        id: string;
        title: string;
        startsAt: string;
        venue: string | null;
        clubName: string;
    };
    summary: {
        total: number;
        registered: number;
        attended: number;
        waitlisted: number;
        cancelled: number;
    };
    applications: ClubEventApplicantRow[];
}

/**
 * Fetch events for the student's college
 */
export async function fetchCollegeEvents(options?: {
    collegeId?: string;
    collegeName?: string;
    timeFilter?: "all" | "upcoming" | "today" | "past";
    clubId?: string;
    search?: string;
}): Promise<CollegeEventsResponse> {
    const params = new URLSearchParams();
    if (options?.collegeId) params.set("collegeId", options.collegeId);
    if (options?.collegeName) params.set("collegeName", options.collegeName);
    if (options?.timeFilter) params.set("timeFilter", options.timeFilter);
    if (options?.clubId) params.set("clubId", options.clubId);
    if (options?.search) params.set("search", options.search);

    const qs = params.toString();
    const res = await fetch(`/api/club/college-events${qs ? `?${qs}` : ""}`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to fetch college events.");
    }
    return data;
}

/**
 * Toggle heart / appreciation for an event
 */
export async function toggleEventLike(
    eventId: string
): Promise<{ liked: boolean; likesCount: number }> {
    const res = await fetch(`/api/club/events/${eventId}/like`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update event appreciation.");
    }
    return { liked: data.liked, likesCount: data.likesCount };
}

/**
 * Student applies / registers for an event
 */
export async function applyForEvent(
    eventId: string,
    payload: ApplyForEventPayload
): Promise<{ success: boolean; message: string; registration: any }> {
    const res = await fetch(`/api/club/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to register for event.");
    }
    return data;
}

/**
 * Student cancels registration for an event
 */
export async function cancelEventRegistration(eventId: string): Promise<void> {
    const res = await fetch(`/api/club/events/${eventId}/cancel`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to cancel event registration.");
    }
}

/**
 * Student fetches all their registered event applications
 */
export async function fetchStudentApplications(): Promise<StudentApplicationItem[]> {
    const res = await fetch("/api/club/user/applications", {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to retrieve your applications.");
    }
    return data.applications || [];
}

/**
 * Club staff fetches applicants for a specific event
 */
export async function fetchClubEventApplications(
    eventId: string
): Promise<ClubEventApplicationsResponse> {
    const res = await fetch(`/api/club/events/${eventId}/applications`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to retrieve event applications.");
    }
    return data;
}

/**
 * Club staff updates an applicant status
 */
export async function updateApplicantStatus(
    eventId: string,
    registrationId: string,
    status: "registered" | "attended" | "waitlisted" | "cancelled"
): Promise<void> {
    const res = await fetch(`/api/club/events/${eventId}/applications/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update applicant status.");
    }
}

/**
 * URL for exporting applications as CSV
 */
export function getEventApplicationsExportUrl(eventId: string): string {
    return `/api/club/events/${eventId}/applications/export`;
}

/**
 * Fetch a single public event by ID
 */
export async function fetchPublicEventById(eventId: string): Promise<CollegeEventItem | null> {
    const res = await fetch(`/api/club/public-events/${encodeURIComponent(eventId)}`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return null;
    }
    return data.event || null;
}
