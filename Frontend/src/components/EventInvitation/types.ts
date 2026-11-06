export type InvitationFormat = "portrait" | "story" | "landscape";
export type InvitationFace = "front" | "back";

export interface EventInvitationData {
    title: string;
    summary?: string;
    description?: string;
    startsAt: string;
    endsAt?: string;
    timezone?: string;
    venueOrLocation?: string;
    locationType?: "in_person" | "virtual" | "online" | "hybrid";
    registrationUrl?: string;
    coverImageUrl?: string;
    status?: "published" | "completed" | "draft" | "cancelled";
    clubName: string;
    clubLogoUrl?: string | null;
    collegeName: string;
    collegeId?: string | null;
    eventId?: string;
    slug?: string;
}

export interface FormattedEventSchedule {
    weekday: string;
    monthShort: string;
    dayNumber: string;
    year: string;
    timeRange: string;
    fullFormatted: string;
    isMultiDay: boolean;
    dateBadgeText: string;
    statusLabel: string;
    statusColor: {
        bg: string;
        text: string;
        dot: string;
    };
}
