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
    status: "published" | "completed" | "draft" | "cancelled";
    scope?: "PAN_INDIA" | "CAMPUS";
    isTeamEvent?: boolean;
    minTeamSize?: number;
    maxTeamSize?: number;
    teamId?: string | null;
    teamRole?: "leader" | "member" | null;
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
    sharesCount?: number;
    hasLiked: boolean;
    isRegistered: boolean;
    isPending?: boolean;
    registrationStatus: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled" | null;
    ticketCode: string | null;
    registrationsCount: number;
    totalApplicationsCount?: number;
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
    institutionId?: string;
    institutionName?: string;
    universityName?: string;
    campusName?: string;
    institutionCity?: string;
    institutionState?: string;
    isUnlistedInstitution?: boolean;
    isAttendeeUnder18?: boolean;
    guardianName?: string;
    guardianEmail?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
}

export interface StudentApplicationItem {
    id: string;
    eventId: string;
    clubId: string;
    status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled";
    registeredAt: string;
    checkedInAt: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    ticketCode: string | null;
    applicantName: string;
    applicantEmail: string;
    department: string | null;
    yearOfStudy: string | null;
    rollNumber: string | null;
    phoneNumber: string | null;
    institutionName?: string | null;
    universityName?: string | null;
    institutionCity?: string | null;
    institutionState?: string | null;
    institutionVerificationStatus?: string | null;
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
    scope?: "PAN_INDIA" | "CAMPUS";
    isTeamEvent?: boolean;
    minTeamSize?: number;
    maxTeamSize?: number;
    teamId?: string | null;
    teamRole?: "leader" | "member" | null;
    teamName?: string | null;
    teamCode?: string | null;
    teamMembersCount?: number;
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
    teamId?: string | null;
    teamRole?: "leader" | "member" | null;
    teamName?: string | null;
    teamCode?: string | null;
    status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled";
    registeredAt: string;
    checkedInAt: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    notes: string;
    isAttendeeUnder18?: boolean;
    guardianName?: string | null;
    guardianEmail?: string | null;
    guardianPhone?: string | null;
    guardianRelationship?: string | null;
    guardianConsentStatus?: "not_required" | "pending_verification" | "verified" | "rejected" | "withdrawn";
    guardianConsentVerifiedAt?: string | null;
    institutionId?: string | null;
    institutionName?: string | null;
    universityName?: string | null;
    campusName?: string | null;
    institutionCity?: string | null;
    institutionState?: string | null;
    institutionVerificationStatus?: string | null;
    isUnlistedInstitution?: boolean;
    answers?: Record<string, any>;
    formResponse?: Record<string, any>;
    fileAttachments?: Array<{
        questionId: string;
        questionTitle?: string;
        fileName: string;
        fileUrl: string;
        filePublicId: string;
        fileSize: number;
        mimeType: string;
    }>;
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
    formStructure?: any;
    formSettings?: any;
    summary: {
        total: number;
        pending: number;
        registered: number;
        attended: number;
        waitlisted: number;
        rejected: number;
        cancelled: number;
    };
    applications: ClubEventApplicantRow[];
}

function getAuthHeaders(includeJson = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Fetch events for the student's college
 */
export async function fetchCollegeEvents(options?: {
    collegeId?: string;
    collegeName?: string;
    timeFilter?: "all" | "live" | "upcoming" | "today" | "completed" | "past";
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(true),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
    status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled",
    reviewNotes?: string
): Promise<void> {
    const res = await fetch(`/api/club/events/${eventId}/applications/${registrationId}`, {
        method: "PATCH",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({ status, reviewNotes }),
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
        headers: getAuthHeaders(),
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return null;
    }
    return data.event || null;
}

export interface VerifiedAttendeeData {
    registrationId: string;
    eventId: string;
    clubId: string;
    userId: string;
    status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled" | "blocked";
    ticketCode: string;
    registeredAt: string;
    checkedInAt: string | null;
    department: string | null;
    yearOfStudy: string | null;
    rollNumber: string | null;
    phoneNumber: string | null;
    notes: string | null;
    reviewedAt: string | null;
    reviewNotes: string | null;
    username: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    coverImageUrl: string | null;
    headline: string | null;
    bio: string | null;
    location: string | null;
    collegeName: string | null;
    website: string | null;
    linkedin: string | null;
    github: string | null;
    customLink: string | null;
    links: any[] | null;
    skills: any[] | null;
    phone: string | null;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    memberSince: string;
}

export interface CheckinVerifyResponse {
    success: boolean;
    actionTaken: "checked_in" | "already_checked_in" | "pending" | "invalid_status";
    message: string;
    attendee: VerifiedAttendeeData;
}

/**
 * Club staff scans or pastes an attendee ticket code for live identity verification & check-in
 */
export async function verifyEventTicketAndCheckin(
    eventId: string,
    ticketCode: string,
    forceCheckIn: boolean = false
): Promise<CheckinVerifyResponse> {
    const res = await fetch(`/api/club/events/${eventId}/checkin-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketCode, forceCheckIn }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to verify entry ticket.");
    }
    return data;
}

