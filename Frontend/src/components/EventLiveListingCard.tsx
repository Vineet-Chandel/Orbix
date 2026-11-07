import React from "react";
import {
    EventInvitationStudio,
    type EventInvitationStudioProps,
} from "./EventInvitation/EventInvitationStudio";
import type { InvitationFormat, InvitationFace } from "./EventInvitation/types";

export type { EventInvitationStudioProps };

export interface EventLiveListingCardProps {
    title: string;
    summary?: string;
    description?: string;
    startsAt: string;
    endsAt?: string;
    timezone?: string;
    venueOrLocation?: string;
    locationType?: "in_person" | "virtual" | "hybrid";
    registrationUrl?: string;
    coverImageUrl?: string;
    status?: "published" | "completed" | "draft" | "cancelled";
    clubName: string;
    clubLogoUrl?: string | null;
    collegeName: string;
    collegeId?: string | null;
    eventId?: string;
    slug?: string;
    className?: string;
    defaultFormat?: InvitationFormat;
    defaultFace?: InvitationFace;
}

/**
 * EventLiveListingCard
 * Official Orbix Premium Event Invitation & Sharing System
 * Renders an interactive 3D Editorial Event Poster & QR Registration Pass
 * with social export presets (Portrait 4:5, Story 9:16, Landscape Banner 1.91:1),
 * high-resolution PNG rendering, native sharing, and instant link copying.
 */
export const EventLiveListingCard: React.FC<EventLiveListingCardProps> = (props) => {
    return <EventInvitationStudio {...props} />;
};

export { EventInvitationStudio };
export { EventPosterFront } from "./EventInvitation/EventPosterFront";
export { EventRegistrationBack } from "./EventInvitation/EventRegistrationBack";
export type {
    InvitationFormat,
    InvitationFace,
    EventInvitationData,
    FormattedEventSchedule,
} from "./EventInvitation/types";
