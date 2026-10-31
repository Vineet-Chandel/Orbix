// Frontend/src/api/helpApi.ts

const API_BASE = "/api";

export type HelpTicketCategory =
    | "bug_report"
    | "sync_issue"
    | "college_verification"
    | "feature_request"
    | "general_inquiry";

export type HelpTicketPriority = "low" | "normal" | "high" | "urgent";

export type HelpTicketStatus =
    | "open"
    | "acknowledged"
    | "in_progress"
    | "investigating"
    | "waiting_on_user"
    | "resolved"
    | "closed";

export interface HelpCategoryItem {
    id: HelpTicketCategory;
    label: string;
    description: string;
    icon: string;
}

export interface FAQItem {
    id: string;
    category: string;
    question: string;
    answer: string;
    helpfulCount?: number;
    unhelpfulCount?: number;
}

export interface SystemDiagnosticInfo {
    browser: string;
    os: string;
    viewport: string;
    devicePixelRatio: number;
    timezone: string;
    currentRoute: string;
    userAgent: string;
    clientTimestamp: string;
}

export interface HelpTicketItem {
    id: string;
    ticketNumber: string;
    category: HelpTicketCategory;
    subject: string;
    description: string;
    priority: HelpTicketPriority;
    status: HelpTicketStatus;
    contactEmail: string;
    attachmentUrl?: string | null;
    resolutionNote?: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string | null;
}

export interface HelpTicketMessage {
    id: string;
    senderType: "user" | "support" | "system";
    senderName: string;
    message: string;
    createdAt: string;
}

export interface HelpTicketDetail extends HelpTicketItem {
    systemInfo?: Record<string, any>;
    messages: HelpTicketMessage[];
}

export interface CreateTicketPayload {
    category: HelpTicketCategory;
    subject: string;
    description: string;
    priority?: HelpTicketPriority;
    contactEmail?: string;
    attachmentUrl?: string;
    systemInfo?: Record<string, any>;
}

/**
 * Automatically captures non-invasive device & client diagnostic telemetry
 * so users don't have to manually inspect their browser versions or OS.
 */
export function extractClientSystemInfo(): SystemDiagnosticInfo {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";

    // Detect browser
    let browser = "Unknown";
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

    // Detect OS
    let os = "Unknown";
    if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    const width = typeof window !== "undefined" ? window.innerWidth : 0;
    const height = typeof window !== "undefined" ? window.innerHeight : 0;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
    const route = typeof window !== "undefined" ? window.location.pathname : "/settings";

    return {
        browser,
        os,
        viewport: `${width}x${height}`,
        devicePixelRatio: dpr,
        timezone: tz,
        currentRoute: route,
        userAgent: ua,
        clientTimestamp: new Date().toISOString(),
    };
}

/**
 * Create a new help ticket
 */
export async function createHelpTicket(payload: CreateTicketPayload): Promise<{
    success: boolean;
    message: string;
    ticket: HelpTicketItem;
}> {
    const res = await fetch(`${API_BASE}/help/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to create ticket (${res.status})`);
    }

    return data;
}

/**
 * List all tickets for current authenticated user
 */
export async function fetchUserHelpTickets(): Promise<{
    success: boolean;
    stats: { total: number; open: number; resolved: number };
    tickets: HelpTicketItem[];
}> {
    const res = await fetch(`${API_BASE}/help/tickets`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch tickets (${res.status})`);
    }

    return data;
}

/**
 * Get ticket details with discussion messages
 */
export async function fetchHelpTicketDetail(ticketId: string): Promise<{
    success: boolean;
    ticket: HelpTicketDetail;
}> {
    const res = await fetch(`${API_BASE}/help/tickets/${encodeURIComponent(ticketId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch ticket detail (${res.status})`);
    }

    return data;
}

/**
 * Post follow-up message to an existing ticket
 */
export async function sendTicketReply(
    ticketId: string,
    message: string
): Promise<{
    success: boolean;
    message: string;
    reply: HelpTicketMessage;
}> {
    const res = await fetch(`${API_BASE}/help/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to send reply (${res.status})`);
    }

    return data;
}

/**
 * Fetch canonical help categories
 */
export async function fetchHelpCategories(): Promise<{
    success: boolean;
    categories: HelpCategoryItem[];
}> {
    const res = await fetch(`${API_BASE}/help/categories`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch categories (${res.status})`);
    }

    return data;
}

/**
 * Fetch knowledge base FAQs with optional category and search query filters
 */
export async function fetchHelpFAQs(params?: {
    category?: string;
    q?: string;
}): Promise<{
    success: boolean;
    faqs: FAQItem[];
}> {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== "all") {
        searchParams.append("category", params.category);
    }
    if (params?.q) {
        searchParams.append("q", params.q);
    }

    const queryStr = searchParams.toString();
    const url = `${API_BASE}/help/faqs${queryStr ? `?${queryStr}` : ""}`;

    const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch FAQs (${res.status})`);
    }

    return data;
}

/**
 * Submit helpful / not helpful rating for an FAQ article
 */
export async function submitFAQFeedback(
    faqId: string,
    isHelpful: boolean
): Promise<{
    success: boolean;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/help/faqs/${encodeURIComponent(faqId)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isHelpful }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to submit feedback (${res.status})`);
    }

    return data;
}
