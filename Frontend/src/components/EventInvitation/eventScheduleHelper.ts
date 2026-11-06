import type { FormattedEventSchedule } from "./types";

/**
 * Filter out leaked form placeholders, counter text, or meaningless boilerplate
 */
export function sanitizeEventText(text?: string | null): string {
    if (!text) return "";
    const trimmed = text.trim();
    // Exclude strings that look like form field titles or character counters (e.g. "Brief Summary (1-2 Sentences) 0/200")
    if (/^brief summary/i.test(trimmed) && (/\d+\/\d+/.test(trimmed) || trimmed.length < 35)) {
        return "";
    }
    if (/^provide event agenda/i.test(trimmed)) {
        return "";
    }
    if (/^untitled event/i.test(trimmed)) {
        return "";
    }
    return trimmed;
}

/**
 * Cleanly format event schedule with timezone support, multi-day handling, and fallback resilience
 */
export function formatEventSchedule(
    startsAt?: string,
    endsAt?: string,
    timezone = "Asia/Kolkata",
    status: "published" | "completed" | "draft" | "cancelled" = "published"
): FormattedEventSchedule {
    const validTz = timezone || "Asia/Kolkata";

    // Safe date parsing
    const startDate = startsAt ? new Date(startsAt) : null;
    const endDate = endsAt ? new Date(endsAt) : null;
    const isStartValid = startDate && !isNaN(startDate.getTime());
    const isEndValid = endDate && !isNaN(endDate.getTime());

    // Status styling
    let statusLabel = "● LIVE EVENT";
    let statusColor = {
        bg: "bg-[#A2FF86]",
        text: "text-black",
        dot: "#15803D",
    };

    if (status === "completed") {
        statusLabel = "✓ COMPLETED";
        statusColor = {
            bg: "bg-sky-200",
            text: "text-black",
            dot: "#0369A1",
        };
    } else if (status === "draft") {
        statusLabel = "✎ DRAFT PREVIEW";
        statusColor = {
            bg: "bg-[#FFE566]",
            text: "text-black",
            dot: "#B45309",
        };
    } else if (status === "cancelled") {
        statusLabel = "✕ CANCELLED";
        statusColor = {
            bg: "bg-rose-200",
            text: "text-black",
            dot: "#BE123C",
        };
    } else if (isStartValid && startDate.getTime() > Date.now()) {
        statusLabel = "● UPCOMING";
        statusColor = {
            bg: "bg-[#A2FF86]",
            text: "text-black",
            dot: "#15803D",
        };
    }

    if (!isStartValid || !startDate) {
        return {
            weekday: "TBA",
            monthShort: "TBA",
            dayNumber: "--",
            year: new Date().getFullYear().toString(),
            timeRange: "Schedule to be announced",
            fullFormatted: "Date & Time to be announced",
            isMultiDay: false,
            dateBadgeText: "Date & Time TBA",
            statusLabel,
            statusColor,
        };
    }

    const startWeekday = startDate.toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: validTz,
    });
    const startMonth = startDate.toLocaleDateString("en-IN", {
        month: "short",
        timeZone: validTz,
    });
    const startDay = startDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        timeZone: validTz,
    });
    const startYear = startDate.toLocaleDateString("en-IN", {
        year: "numeric",
        timeZone: validTz,
    });

    const startTime = startDate.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: validTz,
    });

    // Timezone suffix short code
    const tzSuffix = validTz === "Asia/Kolkata" ? "IST" : validTz.split("/").pop()?.replace(/_/g, " ") || "";

    let timeRange = `${startTime} ${tzSuffix}`.trim();
    let isMultiDay = false;
    let dateBadgeText = `${startWeekday}, ${startDay} ${startMonth} ${startYear} • ${timeRange}`;

    if (isEndValid && endDate) {
        const endTime = endDate.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: validTz,
        });

        // Check if multi-day
        const sameDay =
            startDate.getFullYear() === endDate.getFullYear() &&
            startDate.getMonth() === endDate.getMonth() &&
            startDate.getDate() === endDate.getDate();

        if (sameDay) {
            timeRange = `${startTime} – ${endTime} ${tzSuffix}`.trim();
            dateBadgeText = `${startWeekday}, ${startDay} ${startMonth} • ${timeRange}`;
        } else {
            isMultiDay = true;
            const endMonth = endDate.toLocaleDateString("en-IN", {
                month: "short",
                timeZone: validTz,
            });
            const endDay = endDate.toLocaleDateString("en-IN", {
                day: "2-digit",
                timeZone: validTz,
            });
            timeRange = `${startMonth} ${startDay} – ${endMonth} ${endDay} • ${startTime} ${tzSuffix}`.trim();
            dateBadgeText = `${timeRange}`;
        }
    }

    const fullFormatted = `${startWeekday}, ${startDay} ${startMonth} ${startYear} • ${timeRange}`;

    return {
        weekday: startWeekday,
        monthShort: startMonth,
        dayNumber: startDay,
        year: startYear,
        timeRange,
        fullFormatted,
        isMultiDay,
        dateBadgeText,
        statusLabel,
        statusColor,
    };
}

/**
 * Builds the canonical public event registration URL
 */
export function buildEventRegistrationUrl(
    eventId?: string,
    slug?: string,
    collegeName = "campus",
    explicitUrl?: string
): string {
    if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) {
        return explicitUrl;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "https://orbix.dev";
    const targetIdentifier = eventId || slug || "preview";
    return `${origin}/events?tab=college-events&eventId=${encodeURIComponent(
        targetIdentifier
    )}&college=${encodeURIComponent(collegeName || "campus")}`;
}
