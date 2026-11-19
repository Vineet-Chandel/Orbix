// Club & Student Certificates API Client

export interface CertificateItem {
    id: string;
    clubId: string;
    clubName: string;
    clubSlug: string;
    clubLogoUrl?: string;
    collegeName?: string;
    eventId?: string | null;
    eventTitle?: string | null;
    eventDate?: string | null;
    title: string;
    certificateType: "participation" | "excellence" | "merit" | "contributor" | "organizer" | "appreciation";
    recipientName: string;
    recipientEmail?: string;
    description: string;
    credentialCode: string;
    signerName?: string;
    signerRole?: string;
    issueDate: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface EligibleRecipient {
    id: string;
    name: string;
    username: string;
    email: string;
    avatarUrl?: string;
    collegeId?: string;
    collegeName?: string;
    isSameCollege: boolean;
    eventsAttendedCount: number;
    eventsRegisteredCount: number;
    isTeamMember: boolean;
    teamRole?: string | null;
    latestEventTitle?: string | null;
    latestEventDate?: string | null;
    existingCertsCount: number;
    credibilityCategory: "event_attendee" | "team_member" | "event_registered" | "campus_student";
    credibilityBadge: string;
    credibilityRank: number;
}

export interface EventRecipientItem {
    registrationId: string;
    userId: string;
    name: string;
    email: string;
    username: string;
    avatarUrl?: string;
    status: "registered" | "attended" | "waitlisted" | "cancelled" | "blocked";
    ticketCode: string;
    checkedInAt?: string | null;
    department?: string;
    yearOfStudy?: string;
    rollNumber?: string;
    alreadyHasCert: boolean;
}

export interface CertificateEventItem {
    id: string;
    title: string;
    slug: string;
    startsAt: string;
    status: string;
    venueOrLocation?: string | null;
    attendeesCount: number;
    registrationsCount: number;
    certificatesIssuedCount: number;
}

export interface IssueCertificatesPayload {
    recipientUserIds: string[];
    eventId?: string | null;
    title: string;
    certificateType: "participation" | "excellence" | "merit" | "contributor" | "organizer" | "appreciation";
    description?: string;
    signerName?: string;
    signerRole?: string;
}

/**
 * Student retrieves all certificates awarded to them
 */
export async function fetchStudentCertificates(): Promise<CertificateItem[]> {
    const res = await fetch("/api/club/user/certificates", {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to retrieve certificates.");
    }
    return data.certificates || [];
}

/**
 * Public verification of a certificate by credential code
 */
export async function verifyCertificate(credentialCode: string): Promise<CertificateItem> {
    const res = await fetch(`/api/club/certificates/verify/${encodeURIComponent(credentialCode)}`, {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Certificate verification failed.");
    }
    return data.certificate;
}

/**
 * Club fetches eligible connected students (Perspective 2)
 */
export async function fetchClubEligibleRecipients(
    category = "all",
    search = ""
): Promise<EligibleRecipient[]> {
    const params = new URLSearchParams();
    if (category && category !== "all") params.append("category", category);
    if (search.trim()) params.append("search", search.trim());

    const res = await fetch(`/api/club/certificates/eligible-recipients?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load eligible students.");
    }
    return data.recipients || [];
}

/**
 * Club fetches participants of a specific event (Perspective 1)
 */
export async function fetchClubEventRecipients(
    eventId: string
): Promise<{ event: { id: string; title: string; starts_at: string }; recipients: EventRecipientItem[] }> {
    const res = await fetch(`/api/club/certificates/event/${eventId}/recipients`, {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load event participants.");
    }
    return { event: data.event, recipients: data.recipients || [] };
}

/**
 * Club fetches all club events for selection in Perspective 1
 */
export async function fetchClubEventsForCertificates(): Promise<CertificateEventItem[]> {
    const res = await fetch("/api/club/certificates/events", {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load club events.");
    }
    return data.events || [];
}

/**
 * Club issues certificates in batch with strict eligibility enforcement
 */
export async function issueClubCertificates(payload: IssueCertificatesPayload): Promise<{
    issuedCount: number;
    skippedCount: number;
    message: string;
}> {
    const res = await fetch("/api/club/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to issue certificates.");
    }
    return data;
}

/**
 * Club fetches all issued certificates
 */
export async function fetchIssuedClubCertificates(): Promise<CertificateItem[]> {
    const res = await fetch("/api/club/certificates/issued", {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load issued certificates.");
    }
    return data.certificates || [];
}

/**
 * Club revokes/deletes an issued certificate
 */
export async function revokeClubCertificate(certificateId: string): Promise<void> {
    const res = await fetch(`/api/club/certificates/${certificateId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Failed to revoke certificate.");
    }
}
