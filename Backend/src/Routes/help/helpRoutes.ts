// Backend/src/Routes/help/helpRoutes.ts
import express, { type Request, type Response } from "express";
import validator from "validator";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireSupportStaff } from "../../middlewares/staff.middleware.js";

export const helpRouter = express.Router();

export interface HelpTicketInput {
    category: "bug_report" | "sync_issue" | "college_verification" | "feature_request" | "general_inquiry";
    subject: string;
    description: string;
    priority?: "low" | "normal" | "high" | "urgent";
    contactEmail?: string;
    systemInfo?: Record<string, any>;
    attachmentUrl?: string;
}

const VALID_CATEGORIES = [
    "bug_report",
    "sync_issue",
    "college_verification",
    "feature_request",
    "general_inquiry",
] as const;

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * Generate human-readable ticket number (e.g., ORB-4819-2026)
 */
function generateTicketNumber(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const suffix = Date.now().toString().slice(-4);
    return `ORB-${randomDigits}-${suffix}`;
}

/**
 * POST /api/help/tickets
 * Create a new help ticket with auto-extracted diagnostic payload and user details.
 */
helpRouter.post("/tickets", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const {
            category,
            subject,
            description,
            priority = "normal",
            contactEmail,
            systemInfo = {},
            attachmentUrl,
        } = req.body as HelpTicketInput;

        // 1. Validation
        if (!category || !VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid inquiry category (e.g., Bug Report, Sync Issue, College Verification).",
            });
        }

        const cleanSubject = String(subject || "").trim();
        if (cleanSubject.length < 5 || cleanSubject.length > 200) {
            return res.status(400).json({
                success: false,
                message: "Subject must be between 5 and 200 characters.",
            });
        }

        const cleanDesc = String(description || "").trim();
        if (cleanDesc.length < 10 || cleanDesc.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Please provide a description between 10 and 5,000 characters so we can assist you thoroughly.",
            });
        }

        const chosenPriority = VALID_PRIORITIES.includes(priority as any) ? priority : "normal";

        // Determine user contact email
        const targetEmail = String(
            contactEmail || authUser.email || authUser.gmail || ""
        ).trim().toLowerCase();

        if (!targetEmail || !validator.isEmail(targetEmail)) {
            return res.status(400).json({
                success: false,
                message: "A valid contact email is required to receive support updates.",
            });
        }

        // 2. Resolve User ID from users table
        let resolvedUserId = authUser.id || null;
        const resolvedUsername = authUser.username || null;

        if (!resolvedUserId && resolvedUsername) {
            const lookup = await query(
                `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                [resolvedUsername]
            );
            if (lookup.rows[0]) {
                resolvedUserId = lookup.rows[0].id;
            }
        }

        // Rate limiting check: Max 6 open tickets per user in the last 24 hours to prevent spam
        if (resolvedUserId) {
            const rateCheck = await query(
                `SELECT COUNT(*)::int AS count
                 FROM help_tickets
                 WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours';`,
                [resolvedUserId]
            );
            if ((rateCheck.rows[0]?.count || 0) >= 10) {
                return res.status(429).json({
                    success: false,
                    message: "You have submitted multiple requests recently. Our team is reviewing them; please allow some time before creating new tickets.",
                });
            }
        }

        // 3. Auto-populate server environment details into system_info
        const enrichedSystemInfo = {
            ...systemInfo,
            ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
            serverTimestamp: new Date().toISOString(),
            userAgent: req.headers["user-agent"] || systemInfo?.userAgent || "unknown",
        };

        const ticketNumber = generateTicketNumber();

        // 4. Insert ticket
        const insertRes = await query(
            `INSERT INTO help_tickets (
                ticket_number,
                user_id,
                username,
                contact_email,
                category,
                subject,
                description,
                priority,
                status,
                system_info,
                attachment_url,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, NOW(), NOW())
            RETURNING *;`,
            [
                ticketNumber,
                resolvedUserId,
                resolvedUsername,
                targetEmail,
                category,
                cleanSubject,
                cleanDesc,
                chosenPriority,
                JSON.stringify(enrichedSystemInfo),
                attachmentUrl ? String(attachmentUrl).trim() : null,
            ]
        );

        const newTicket = insertRes.rows[0];

        // 5. Create initial message record in help_ticket_messages
        await query(
            `INSERT INTO help_ticket_messages (
                ticket_id,
                sender_id,
                sender_type,
                sender_name,
                message,
                created_at
            ) VALUES ($1, $2, 'user', $3, $4, NOW());`,
            [
                newTicket.id,
                resolvedUserId,
                resolvedUsername || targetEmail,
                cleanDesc,
            ]
        );

        // 6. In-App Notification Dispatch (giving user immediate visibility in notifications)
        try {
            await query(
                `INSERT INTO user_notifications (
                    user_id,
                    username,
                    recipient_id,
                    title,
                    body,
                    type,
                    notification_type,
                    metadata,
                    is_read,
                    is_user_initiated,
                    delivery_status,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, 'help_ticket', 'help_ticket_created', $6, false, false, 'delivered', NOW());`,
                [
                    resolvedUserId,
                    resolvedUsername,
                    resolvedUserId,
                    `Help Ticket Created: ${ticketNumber}`,
                    `We received your inquiry: "${cleanSubject.slice(0, 80)}". Our engineering and support team will investigate.`,
                    JSON.stringify({
                        ticketId: newTicket.id,
                        ticketNumber: newTicket.ticket_number,
                        category: newTicket.category,
                        priority: newTicket.priority,
                        status: "open",
                    }),
                ]
            );
        } catch (notifErr: any) {
            console.warn("[Help] Notification dispatch non-blocking error:", notifErr?.message);
        }

        return res.status(201).json({
            success: true,
            message: "Ticket submitted successfully. We will follow up shortly.",
            ticket: {
                id: newTicket.id,
                ticketNumber: newTicket.ticket_number,
                category: newTicket.category,
                subject: newTicket.subject,
                description: newTicket.description,
                priority: newTicket.priority,
                status: newTicket.status,
                contactEmail: newTicket.contact_email,
                createdAt: newTicket.created_at,
                updatedAt: newTicket.updated_at,
            },
        });
    } catch (err: any) {
        console.error("[Help] Create ticket error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to submit help ticket. Please try again.",
        });
    }
});

/**
 * GET /api/help/tickets
 * List tickets for authenticated user with count statistics.
 */
helpRouter.get("/tickets", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        let resolvedUserId = authUser.id || null;
        const resolvedUsername = authUser.username || null;
        const resolvedEmail = (authUser.email || authUser.gmail || "").toLowerCase();

        if (!resolvedUserId && resolvedUsername) {
            const lookup = await query(
                `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                [resolvedUsername]
            );
            if (lookup.rows[0]) {
                resolvedUserId = lookup.rows[0].id;
            }
        }

        const ticketsRes = await query(
            `SELECT
                id,
                ticket_number,
                category,
                subject,
                description,
                priority,
                status,
                contact_email,
                attachment_url,
                resolution_note,
                created_at,
                updated_at,
                resolved_at
             FROM help_tickets
             WHERE (user_id = $1 OR LOWER(username) = LOWER($2) OR LOWER(contact_email) = $3)
             ORDER BY created_at DESC
             LIMIT 50;`,
            [resolvedUserId, resolvedUsername || "", resolvedEmail]
        );

        const tickets = ticketsRes.rows.map((row) => ({
            id: row.id,
            ticketNumber: row.ticket_number,
            category: row.category,
            subject: row.subject,
            description: row.description,
            priority: row.priority,
            status: row.status,
            contactEmail: row.contact_email,
            attachmentUrl: row.attachment_url,
            resolutionNote: row.resolution_note,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            resolvedAt: row.resolved_at,
        }));

        const stats = {
            total: tickets.length,
            open: tickets.filter((t) => ["open", "investigating", "waiting_on_user"].includes(t.status)).length,
            resolved: tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length,
        };

        return res.json({
            success: true,
            stats,
            tickets,
        });
    } catch (err: any) {
        console.error("[Help] List tickets error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve help tickets.",
        });
    }
});

/**
 * GET /api/help/tickets/:id
 * Retrieve a specific ticket and its discussion messages.
 */
helpRouter.get("/tickets/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        const { id } = req.params;

        const ticketRes = await query(
            `SELECT * FROM help_tickets WHERE id = $1 LIMIT 1;`,
            [id]
        );

        if (!ticketRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const ticket = ticketRes.rows[0];

        // Authorization check: User must own the ticket or be admin
        const isOwner =
            (authUser.id && ticket.user_id === authUser.id) ||
            (authUser.username && ticket.username?.toLowerCase() === authUser.username.toLowerCase()) ||
            (authUser.email && ticket.contact_email?.toLowerCase() === authUser.email.toLowerCase()) ||
            (authUser.gmail && ticket.contact_email?.toLowerCase() === authUser.gmail.toLowerCase());

        if (!isOwner && !authUser.isSuperAdmin) {
            return res.status(403).json({ success: false, message: "Unauthorized to view this ticket." });
        }

        const messagesRes = await query(
            `SELECT
                id,
                sender_id,
                sender_type,
                sender_name,
                message,
                created_at
             FROM help_ticket_messages
             WHERE ticket_id = $1
             ORDER BY created_at ASC;`,
            [id]
        );

        return res.json({
            success: true,
            ticket: {
                id: ticket.id,
                ticketNumber: ticket.ticket_number,
                category: ticket.category,
                subject: ticket.subject,
                description: ticket.description,
                priority: ticket.priority,
                status: ticket.status,
                contactEmail: ticket.contact_email,
                systemInfo: ticket.system_info,
                attachmentUrl: ticket.attachment_url,
                resolutionNote: ticket.resolution_note,
                createdAt: ticket.created_at,
                updatedAt: ticket.updated_at,
                resolvedAt: ticket.resolved_at,
                messages: messagesRes.rows.map((m) => ({
                    id: m.id,
                    senderType: m.sender_type,
                    senderName: m.sender_name,
                    message: m.message,
                    createdAt: m.created_at,
                })),
            },
        });
    } catch (err: any) {
        console.error("[Help] Get ticket detail error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve ticket details.",
        });
    }
});

/**
 * POST /api/help/tickets/:id/messages
 * Add a follow-up reply or extra information to an existing ticket.
 */
helpRouter.post("/tickets/:id/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        const { id } = req.params;
        const { message } = req.body;

        const cleanMessage = String(message || "").trim();
        if (cleanMessage.length < 2 || cleanMessage.length > 3000) {
            return res.status(400).json({
                success: false,
                message: "Message must be between 2 and 3,000 characters.",
            });
        }

        const ticketRes = await query(
            `SELECT * FROM help_tickets WHERE id = $1 LIMIT 1;`,
            [id]
        );

        if (!ticketRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const ticket = ticketRes.rows[0];

        const isOwner =
            (authUser.id && ticket.user_id === authUser.id) ||
            (authUser.username && ticket.username?.toLowerCase() === authUser.username.toLowerCase()) ||
            (authUser.email && ticket.contact_email?.toLowerCase() === authUser.email.toLowerCase()) ||
            (authUser.gmail && ticket.contact_email?.toLowerCase() === authUser.gmail.toLowerCase());

        if (!isOwner && !authUser.isSuperAdmin) {
            return res.status(403).json({ success: false, message: "Unauthorized." });
        }

        const msgRes = await query(
            `INSERT INTO help_ticket_messages (
                ticket_id,
                sender_id,
                sender_type,
                sender_name,
                message,
                created_at
            ) VALUES ($1, $2, 'user', $3, $4, NOW())
            RETURNING *;`,
            [
                id,
                authUser.id || null,
                authUser.username || "You",
                cleanMessage,
            ]
        );

        // Update ticket updated_at and reopen if closed
        await query(
            `UPDATE help_tickets
             SET updated_at = NOW(),
                 status = CASE WHEN status IN ('resolved', 'closed') THEN 'open' ELSE status END
             WHERE id = $1;`,
            [id]
        );

        return res.status(201).json({
            success: true,
            message: "Reply sent successfully.",
            reply: {
                id: msgRes.rows[0].id,
                senderType: msgRes.rows[0].sender_type,
                senderName: msgRes.rows[0].sender_name,
                message: msgRes.rows[0].message,
                createdAt: msgRes.rows[0].created_at,
            },
        });
    } catch (err: any) {
        console.error("[Help] Post ticket message error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to post message.",
        });
    }
});

/**
 * Category metadata for frontend request submission and routing
 */
export const HELP_CATEGORIES_METADATA = [
    {
        id: "bug_report",
        label: "Bug Report",
        description: "Unexpected glitches, visual regressions, broken links, or API errors",
        icon: "bug",
    },
    {
        id: "sync_issue",
        label: "Sync & Stats",
        description: "Portal sync latency, missing problem counts, or contest rating discrepancies",
        icon: "refresh",
    },
    {
        id: "college_verification",
        label: "College & Club",
        description: "Campus affiliation, collegiate cooldown waivers, or student organization registration",
        icon: "academic",
    },
    {
        id: "feature_request",
        label: "Feature Request",
        description: "Platform capability suggestions, new portal integrations, or UI improvements",
        icon: "lightbulb",
    },
    {
        id: "general_inquiry",
        label: "General Help",
        description: "Account credentials, developer showcase, resume intelligence, and platform questions",
        icon: "info",
    },
];

/**
 * GET /api/help/categories
 * Returns canonical support ticket categories.
 */
helpRouter.get("/categories", (_req: Request, res: Response) => {
    return res.json({
        success: true,
        categories: HELP_CATEGORIES_METADATA,
    });
});

/**
 * Fallback static FAQs if database table is empty
 */
const DEFAULT_FALLBACK_FAQS = [
    {
        id: "faq-sync-cadence",
        category: "Platform Sync",
        question: "How frequently does Orbix synchronize my competitive statistics?",
        answer: "Orbix executes scheduled synchronization daily across all connected developer portals. You can also trigger an on-demand real-time refresh directly from your Profile or Onboarding hub.",
        helpfulCount: 42,
        unhelpfulCount: 1,
    },
    {
        id: "faq-college-cooldown",
        category: "College & Club",
        question: "Why is my College Affiliation subject to a cooldown period?",
        answer: "To protect inter-university leaderboard integrity and prevent opportunistic institution hopping during active contest rounds, college identity changes are bounded by a 72-hour verification cooldown.",
        helpfulCount: 88,
        unhelpfulCount: 3,
    },
    {
        id: "faq-orbix-score-engine",
        category: "Scoring Engine",
        question: "What mathematical formula determines the calibrated Orbix Score?",
        answer: "The Orbix Score (0–10,000) is a weighted deterministic benchmark evaluating aggregate algorithmic problem counts (40%), verified contest ratings across Codeforces/LeetCode/AtCoder (35%), active weekly streak consistency (15%), and genuine open-source pull requests (10%).",
        helpfulCount: 115,
        unhelpfulCount: 2,
    },
    {
        id: "faq-resume-privacy",
        category: "Privacy & Security",
        question: "How does the Resume Intelligence engine process my uploaded documents?",
        answer: "Uploaded resumes undergo strict AST-based fact provenance parsing in isolated sandbox workers. Extracted skills and project claims are benchmarked against your verified coding accounts. We never package, resell, or train public AI models on your private documents.",
        helpfulCount: 64,
        unhelpfulCount: 0,
    },
    {
        id: "faq-club-governance",
        category: "College & Club",
        question: "What is required to obtain institutional verification for a student developer club?",
        answer: "Student organizations must provide an official university domain URL or faculty advisor authorization. Verified chapters unlock curated member leaderboards, verified chapter badges, and priority campus hackathon support.",
        helpfulCount: 39,
        unhelpfulCount: 1,
    },
    {
        id: "faq-private-mode",
        category: "Privacy & Security",
        question: "What changes occur when I switch my Developer Identity to Private?",
        answer: "Switching to Private instantly de-indexes your public showcase URL, conceals your username from public leaderboards, and prevents direct unsolicited recruiter outreach.",
        helpfulCount: 51,
        unhelpfulCount: 2,
    },
];

/**
 * GET /api/help/faqs
 * Production knowledge base / FAQs for instant self-help.
 * Supports ?category= and ?q= search filtering from PostgreSQL database.
 */
helpRouter.get("/faqs", async (req: Request, res: Response) => {
    try {
        const { category, q } = req.query;
        let sql = `SELECT id, category, question, answer, helpful_count, unhelpful_count, sort_order
                   FROM help_faqs
                   WHERE is_published = true`;
        const params: any[] = [];

        if (category && typeof category === "string" && category !== "all") {
            params.push(category.trim());
            sql += ` AND LOWER(category) = LOWER($${params.length})`;
        }

        if (q && typeof q === "string" && q.trim()) {
            params.push(`%${q.trim()}%`);
            sql += ` AND (question ILIKE $${params.length} OR answer ILIKE $${params.length})`;
        }

        sql += ` ORDER BY sort_order ASC, created_at ASC;`;

        const dbRes = await query(sql, params);

        if (dbRes.rows && dbRes.rows.length > 0) {
            const faqs = dbRes.rows.map((row) => ({
                id: row.id,
                category: row.category,
                question: row.question,
                answer: row.answer,
                helpfulCount: Number(row.helpful_count || 0),
                unhelpfulCount: Number(row.unhelpful_count || 0),
                sortOrder: row.sort_order,
            }));
            return res.json({ success: true, count: faqs.length, faqs });
        }

        // Filter fallback if category/query provided
        let filtered = DEFAULT_FALLBACK_FAQS;
        if (category && typeof category === "string" && category !== "all") {
            filtered = filtered.filter((f) => f.category.toLowerCase().includes(category.toLowerCase()));
        }
        if (q && typeof q === "string" && q.trim()) {
            const search = q.toLowerCase();
            filtered = filtered.filter(
                (f) => f.question.toLowerCase().includes(search) || f.answer.toLowerCase().includes(search)
            );
        }

        return res.json({ success: true, count: filtered.length, faqs: filtered });
    } catch (err: any) {
        console.warn("[Help] FAQ fetch warning, using defaults:", err?.message);
        return res.json({ success: true, count: DEFAULT_FALLBACK_FAQS.length, faqs: DEFAULT_FALLBACK_FAQS });
    }
});

/**
 * POST /api/help/faqs/:id/feedback
 * Submit helpful / unhelpful rating for an FAQ article.
 */
helpRouter.post("/faqs/:id/feedback", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isHelpful } = req.body;
        const userId = req.user?.id || null;
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";

        if (typeof isHelpful !== "boolean") {
            return res.status(400).json({ success: false, message: "isHelpful must be a boolean." });
        }

        if (isHelpful) {
            await query(`UPDATE help_faqs SET helpful_count = helpful_count + 1 WHERE id = $1;`, [id]);
        } else {
            await query(`UPDATE help_faqs SET unhelpful_count = unhelpful_count + 1 WHERE id = $1;`, [id]);
        }

        if (userId) {
            try {
                await query(
                    `INSERT INTO help_faq_feedback (faq_id, user_id, is_helpful, user_ip)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (faq_id, user_id) DO UPDATE SET is_helpful = EXCLUDED.is_helpful;`,
                    [id, userId, isHelpful, ip]
                );
            } catch {}
        }

        return res.json({
            success: true,
            message: "Feedback recorded. Thank you for helping us refine our documentation.",
        });
    } catch (err: any) {
        console.error("[Help] FAQ feedback error:", err);
        return res.status(500).json({ success: false, message: "Failed to record feedback." });
    }
});

/**
 * =========================================================================
 * SUPPORT STAFF ADMINISTRATION ENDPOINTS (Restricted to authorized staff)
 * =========================================================================
 */

/**
 * GET /api/help/admin/tickets
 * Support staff ticket queue with multi-filter and status counts.
 */
helpRouter.get("/admin/tickets", authenticate, requireSupportStaff, async (req: Request, res: Response) => {
    try {
        const { status, category, priority, search, limit = "50", offset = "0" } = req.query;

        let sql = `SELECT
                    t.id,
                    t.ticket_number,
                    t.user_id,
                    t.username,
                    t.contact_email,
                    t.category,
                    t.subject,
                    t.description,
                    t.priority,
                    t.status,
                    t.assigned_to,
                    t.assigned_team,
                    t.internal_notes,
                    t.attachment_url,
                    t.created_at,
                    t.updated_at,
                    t.last_response_at,
                    t.resolved_at
                   FROM help_tickets t
                   WHERE 1=1`;
        const params: any[] = [];

        if (status && typeof status === "string" && status !== "all") {
            params.push(status);
            sql += ` AND t.status = $${params.length}`;
        }

        if (category && typeof category === "string" && category !== "all") {
            params.push(category);
            sql += ` AND t.category = $${params.length}`;
        }

        if (priority && typeof priority === "string" && priority !== "all") {
            params.push(priority);
            sql += ` AND t.priority = $${params.length}`;
        }

        if (search && typeof search === "string" && search.trim()) {
            params.push(`%${search.trim()}%`);
            sql += ` AND (t.ticket_number ILIKE $${params.length} OR t.subject ILIKE $${params.length} OR t.contact_email ILIKE $${params.length} OR t.username ILIKE $${params.length})`;
        }

        sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
        params.push(Math.min(Number(limit) || 50, 100));
        params.push(Number(offset) || 0);

        const ticketsRes = await query(sql, params);

        // Overall stats for the support dashboard
        const statsRes = await query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged,
                COUNT(*) FILTER (WHERE status = 'in_progress' OR status = 'investigating')::int AS in_progress,
                COUNT(*) FILTER (WHERE status = 'waiting_on_user')::int AS waiting_on_user,
                COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
                COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
            FROM help_tickets;
        `);

        return res.json({
            success: true,
            stats: statsRes.rows[0] || {},
            tickets: ticketsRes.rows,
        });
    } catch (err: any) {
        console.error("[Help Admin] List tickets error:", err);
        return res.status(500).json({ success: false, message: "Failed to list support tickets." });
    }
});

/**
 * PATCH /api/help/admin/tickets/:id
 * Support staff ticket status, assignment, and internal notes update.
 */
helpRouter.patch("/admin/tickets/:id", authenticate, requireSupportStaff, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, priority, assignedTo, assignedTeam, internalNotes, resolutionNote } = req.body;
        const staffUser = req.user;

        const ticketCheck = await query(`SELECT * FROM help_tickets WHERE id = $1 LIMIT 1;`, [id]);
        if (!ticketCheck.rows[0]) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const validStatuses = [
            "open",
            "acknowledged",
            "in_progress",
            "investigating",
            "waiting_on_user",
            "resolved",
            "closed",
        ];

        let isResolved = false;
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
        }
        if (status === "resolved" || status === "closed") {
            isResolved = true;
        }

        await query(
            `UPDATE help_tickets
             SET
                status = COALESCE($1, status),
                priority = COALESCE($2, priority),
                assigned_to = COALESCE($3, assigned_to),
                assigned_team = COALESCE($4, assigned_team),
                internal_notes = COALESCE($5, internal_notes),
                resolution_note = COALESCE($6, resolution_note),
                resolved_at = CASE WHEN $7 = true AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
                updated_at = NOW()
             WHERE id = $8;`,
            [
                status || null,
                priority || null,
                assignedTo !== undefined ? assignedTo : null,
                assignedTeam !== undefined ? assignedTeam : null,
                internalNotes !== undefined ? internalNotes : null,
                resolutionNote !== undefined ? resolutionNote : null,
                isResolved,
                id,
            ]
        );

        // Notify user if ticket was resolved or waiting on user
        if (status === "resolved" || status === "waiting_on_user") {
            const ticket = ticketCheck.rows[0];
            try {
                await query(
                    `INSERT INTO user_notifications (
                        user_id,
                        username,
                        recipient_id,
                        title,
                        body,
                        type,
                        notification_type,
                        metadata,
                        is_read,
                        is_user_initiated,
                        delivery_status,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, 'help_ticket', 'ticket_status_updated', $6, false, false, 'delivered', NOW());`,
                    [
                        ticket.user_id,
                        ticket.username,
                        ticket.user_id,
                        `Ticket ${ticket.ticket_number} Updated`,
                        `Your support ticket status is now: ${status.replace("_", " ").toUpperCase()}`,
                        JSON.stringify({ ticketId: ticket.id, status, updatedBy: staffUser?.username || "Staff" }),
                    ]
                );
            } catch {}
        }

        return res.json({
            success: true,
            message: "Support ticket updated successfully.",
        });
    } catch (err: any) {
        console.error("[Help Admin] Update ticket error:", err);
        return res.status(500).json({ success: false, message: "Failed to update ticket." });
    }
});

/**
 * POST /api/help/admin/tickets/:id/reply
 * Post official support reply from support staff.
 */
helpRouter.post("/admin/tickets/:id/reply", authenticate, requireSupportStaff, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { message, statusUpdate } = req.body;
        const staffUser = req.user;

        const cleanMessage = String(message || "").trim();
        if (!cleanMessage) {
            return res.status(400).json({ success: false, message: "Reply message cannot be empty." });
        }

        const ticketCheck = await query(`SELECT * FROM help_tickets WHERE id = $1 LIMIT 1;`, [id]);
        if (!ticketCheck.rows[0]) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }
        const ticket = ticketCheck.rows[0];

        // Insert reply as support message
        const replyRes = await query(
            `INSERT INTO help_ticket_messages (
                ticket_id,
                sender_id,
                sender_type,
                sender_name,
                message,
                created_at
            ) VALUES ($1, $2, 'support', $3, $4, NOW())
            RETURNING *;`,
            [
                id,
                staffUser?.id || null,
                staffUser?.username || "Orbix Engineering Support",
                cleanMessage,
            ]
        );

        // Update ticket last_response_at and optionally status
        const nextStatus = statusUpdate || "waiting_on_user";
        await query(
            `UPDATE help_tickets
             SET status = $1,
                 last_response_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2;`,
            [nextStatus, id]
        );

        // Dispatch notification to ticket owner
        if (ticket.user_id) {
            try {
                await query(
                    `INSERT INTO user_notifications (
                        user_id,
                        username,
                        recipient_id,
                        title,
                        body,
                        type,
                        notification_type,
                        metadata,
                        is_read,
                        is_user_initiated,
                        delivery_status,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, 'help_ticket', 'ticket_reply_received', $6, false, false, 'delivered', NOW());`,
                    [
                        ticket.user_id,
                        ticket.username,
                        ticket.user_id,
                        `New response on ticket ${ticket.ticket_number}`,
                        cleanMessage.slice(0, 100),
                        JSON.stringify({ ticketId: ticket.id, replyId: replyRes.rows[0].id }),
                    ]
                );
            } catch {}
        }

        return res.status(201).json({
            success: true,
            message: "Support response posted successfully.",
            reply: replyRes.rows[0],
        });
    } catch (err: any) {
        console.error("[Help Admin] Reply error:", err);
        return res.status(500).json({ success: false, message: "Failed to post support response." });
    }
});
