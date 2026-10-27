// Backend/src/Routes/help/helpRoutes.ts
import express, { type Request, type Response } from "express";
import validator from "validator";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

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
 * GET /api/help/faqs
 * Production knowledge base / FAQs for instant self-help.
 */
helpRouter.get("/faqs", (_req: Request, res: Response) => {
    const faqs = [
        {
            id: "sync-frequency",
            category: "Platform Sync",
            question: "How often does Orbix refresh my platform stats (LeetCode, Codeforces, GitHub)?",
            answer:
                "Orbix triggers automatic daily syncs for all connected profiles. You can also trigger an instant live refresh by visiting your Developer Profile or Onboarding hub and clicking 'Sync'.",
        },
        {
            id: "college-update-rule",
            category: "College & Identity",
            question: "Why is my College Name locked or on cooldown?",
            answer:
                "To ensure leaderboard integrity and prevent gaming college standings during contest seasons, college identity updates have a 3-day verification cooldown. You can change your college once every 3 days.",
        },
        {
            id: "orbix-score",
            category: "Orbix Score",
            question: "How is the Orbix Score calculated?",
            answer:
                "Orbix Score is a weighted composite algorithm taking into account algorithm problem counts across platforms (40%), rated contest performance (35%), active weekly streak consistency (15%), and verified open-source GitHub contributions (10%).",
        },
        {
            id: "club-verification",
            category: "Clubs & Onboarding",
            question: "What is required to verify a student developer club?",
            answer:
                "Clubs must submit institutional proof (official college portal link or faculty advisor contact). Once submitted, the Orbix verification queue reviews the request within 24-48 business hours.",
        },
        {
            id: "private-profile",
            category: "Privacy",
            question: "What happens when I toggle my profile to Private?",
            answer:
                "A private profile hides your stats, contest history, and resume from public URLs and global explore searches. Only essential identity information (name and handle) remains visible to confirmed connections.",
        },
    ];

    return res.json({ success: true, faqs });
});
