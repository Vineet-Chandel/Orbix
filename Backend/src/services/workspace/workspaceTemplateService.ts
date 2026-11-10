// Backend/src/services/workspace/workspaceTemplateService.ts
import { pool, query } from "../../database/client.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";

export interface WorkspaceTemplateRole {
    name: string;
    description: string;
    rank: number;
    color: string;
    permissions: string[];
}

export interface WorkspaceTemplateDepartment {
    name: string;
    slug: string;
    description: string;
    icon: string;
    color: string;
}

export interface WorkspaceTemplateChannel {
    name: string;
    slug: string;
    topic: string;
    channelType: "text" | "announcement" | "forum";
}

export interface WorkspaceTemplateCategory {
    name: string;
    channels: WorkspaceTemplateChannel[];
}

export interface WorkspaceTemplateDefinition {
    id: string;
    name: string;
    description: string;
    departments: WorkspaceTemplateDepartment[];
    roles: WorkspaceTemplateRole[];
    categories: WorkspaceTemplateCategory[];
}

export const WORKSPACE_TEMPLATES: Record<string, WorkspaceTemplateDefinition> = {
    technical: {
        id: "technical",
        name: "Technical Club",
        description: "Engineered for engineering chapters, robotics labs, hardware prototypes, and technical research.",
        departments: [
            {
                name: "Hardware & Embedded Systems",
                slug: "hardware-embedded",
                description: "PCB design, microcontrollers, sensor integration, and circuitry testing.",
                icon: "cpu",
                color: "#2563eb",
            },
            {
                name: "Robotics & Automation",
                slug: "robotics-automation",
                description: "Mechanical assembly, ROS, motor controllers, and autonomous navigation.",
                icon: "bot",
                color: "#0284c7",
            },
            {
                name: "Technical Projects & R&D",
                slug: "tech-projects-rnd",
                description: "Engineering research papers, competition capstones, and innovation sprints.",
                icon: "wrench",
                color: "#4f46e5",
            },
            {
                name: "Lab Safety & Logistics",
                slug: "lab-safety-logistics",
                description: "Component procurement, inventory audits, 3D printers, and lab access protocol.",
                icon: "shield-alert",
                color: "#d97706",
            },
        ],
        roles: [
            {
                name: "Technical Lead",
                description: "Oversees lab projects, architecture reviews, and technical milestones.",
                rank: 750,
                color: "#2563eb",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "Lab Coordinator",
                description: "Manages physical workshop access, tooling safety, and hardware inventory.",
                rank: 600,
                color: "#059669",
                permissions: ["tasks:create", "tasks:assign", "files:upload"],
            },
            {
                name: "Hardware Specialist",
                description: "Core contributor working on circuit design and firmware execution.",
                rank: 500,
                color: "#0284c7",
                permissions: ["tasks:create", "files:upload"],
            },
        ],
        categories: [
            {
                name: "Club-Wide",
                channels: [
                    { name: "general", slug: "general", topic: "Technical club discussions", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Official technical chapter notices", channelType: "announcement" },
                    { name: "lab-status", slug: "lab-status", topic: "Lab equipment availability and maintenance updates", channelType: "text" },
                ],
            },
            {
                name: "Engineering & Hardware",
                channels: [
                    { name: "circuits-pcb", slug: "circuits-pcb", topic: "Schematics, Gerber reviews, and soldering help", channelType: "text" },
                    { name: "robotics-builds", slug: "robotics-builds", topic: "Bot chassis, drivetrains, and actuators", channelType: "text" },
                    { name: "firmware-code", slug: "firmware-code", topic: "C++, Rust, Arduino, and embedded firmware", channelType: "text" },
                    { name: "rfcs-architecture", slug: "rfcs-architecture", topic: "Engineering RFCs and peer critique", channelType: "forum" },
                ],
            },
            {
                name: "Procurement & Safety",
                channels: [
                    { name: "parts-requests", slug: "parts-requests", topic: "Component orders and bill of materials", channelType: "forum" },
                ],
            },
        ],
    },

    coding: {
        id: "coding",
        name: "Coding Club",
        description: "Tailored for software engineering, competitive programming, web/mobile app dev, and hackathons.",
        departments: [
            {
                name: "Competitive Programming",
                slug: "competitive-programming",
                description: "Algorithms, data structures, Codeforces, and contest preparation.",
                icon: "binary",
                color: "#8b5cf6",
            },
            {
                name: "Web & Mobile Development",
                slug: "web-mobile-dev",
                description: "Full-stack apps, React, Node.js, Flutter, and cloud deployment.",
                icon: "code",
                color: "#2563eb",
            },
            {
                name: "AI & Machine Learning",
                slug: "ai-ml",
                description: "PyTorch, deep learning, NLP, computer vision, and model deployment.",
                icon: "sparkles",
                color: "#ec4899",
            },
            {
                name: "Open Source & Systems",
                slug: "open-source-systems",
                description: "Linux kernel, DevOps, Rust, and public GitHub repository contributions.",
                icon: "git-pull-request",
                color: "#059669",
            },
        ],
        roles: [
            {
                name: "Coding Lead",
                description: "Coordinates programming competitions, sprint architecture, and repo standards.",
                rank: 750,
                color: "#8b5cf6",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "Contest Master",
                description: "Curates problem sets, contest leaderboards, and algorithmic workshops.",
                rank: 650,
                color: "#ec4899",
                permissions: ["tasks:create", "tasks:assign", "files:upload"],
            },
            {
                name: "Full-Stack Mentor",
                description: "Reviews student pull requests and guides project teams.",
                rank: 600,
                color: "#2563eb",
                permissions: ["tasks:create", "tasks:review", "files:upload"],
            },
        ],
        categories: [
            {
                name: "Club-Wide",
                channels: [
                    { name: "general", slug: "general", topic: "Developer chat and campus updates", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Hackathon announcements and notices", channelType: "announcement" },
                    { name: "dev-talk", slug: "dev-talk", topic: "Languages, tooling, and tech news", channelType: "text" },
                ],
            },
            {
                name: "Development",
                channels: [
                    { name: "frontend", slug: "frontend", topic: "React, Vue, Tailwind, and client state", channelType: "text" },
                    { name: "backend-apis", slug: "backend-apis", topic: "PostgreSQL, Express, microservices, and databases", channelType: "text" },
                    { name: "code-reviews", slug: "code-reviews", topic: "PR reviews and peer debugging", channelType: "forum" },
                    { name: "showcase", slug: "showcase", topic: "Share live project demos and GitHub repos", channelType: "text" },
                ],
            },
            {
                name: "Competitive Prep",
                channels: [
                    { name: "problem-of-the-day", slug: "problem-of-the-day", topic: "Daily algorithmic problems and solutions", channelType: "forum" },
                    { name: "contest-strategy", slug: "contest-strategy", topic: "ICPC, LeetCode, and contest tips", channelType: "text" },
                ],
            },
        ],
    },

    design: {
        id: "design",
        name: "Design Club",
        description: "Optimized for visual creatives, UI/UX researchers, brand stylists, and motion designers.",
        departments: [
            {
                name: "UI/UX & Product Design",
                slug: "ui-ux-design",
                description: "Wireframes, user experience research, Figma designs, and design systems.",
                icon: "layout",
                color: "#ec4899",
            },
            {
                name: "Visual Identity & Branding",
                slug: "visual-branding",
                description: "Logos, brand guidelines, color palettes, and club merchandise.",
                icon: "palette",
                color: "#8b5cf6",
            },
            {
                name: "Motion & 3D Design",
                slug: "motion-3d",
                description: "Blender, After Effects, kinetic typography, and 3D renders.",
                icon: "film",
                color: "#f59e0b",
            },
        ],
        roles: [
            {
                name: "Creative Director",
                description: "Directs visual standards, brand cohesion, and design reviews.",
                rank: 750,
                color: "#ec4899",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "UI/UX Lead",
                description: "Oversees component libraries, prototypes, and user testing.",
                rank: 650,
                color: "#8b5cf6",
                permissions: ["tasks:create", "tasks:assign", "files:upload"],
            },
            {
                name: "Brand Custodian",
                description: "Maintains official vector assets, typography, and poster guidelines.",
                rank: 600,
                color: "#f59e0b",
                permissions: ["tasks:create", "files:upload"],
            },
        ],
        categories: [
            {
                name: "Club-Wide",
                channels: [
                    { name: "general", slug: "general", topic: "General design talk", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Design sprints and workshop notices", channelType: "announcement" },
                    { name: "inspiration", slug: "inspiration", topic: "Dribbble, Mobbin, and design references", channelType: "text" },
                ],
            },
            {
                name: "Design Studio",
                channels: [
                    { name: "figma-collab", slug: "figma-collab", topic: "Active file links and canvas cooperation", channelType: "text" },
                    { name: "design-critiques", slug: "design-critiques", topic: "Constructive feedback and reviews", channelType: "forum" },
                    { name: "brand-assets", slug: "brand-assets", topic: "Logos, typography, and vectors", channelType: "text" },
                ],
            },
        ],
    },

    photography: {
        id: "photography",
        name: "Photography Club",
        description: "Built for shutterbugs, videographers, lighting technicians, and digital editors.",
        departments: [
            {
                name: "Event Photography",
                slug: "event-photo",
                description: "On-campus festivals, stage coverage, sports, and guest lectures.",
                icon: "camera",
                color: "#f59e0b",
            },
            {
                name: "Studio & Portraiture",
                slug: "studio-portraits",
                description: "Studio lighting, strobe setups, headshots, and editorial shoots.",
                icon: "sun",
                color: "#ef4444",
            },
            {
                name: "Videography & Reels",
                slug: "videography-reels",
                description: "Cinematography, promotional trailers, drone footage, and social clips.",
                icon: "video",
                color: "#3b82f6",
            },
            {
                name: "Post-Production & Grading",
                slug: "post-production",
                description: "Lightroom presets, RAW workflow, color grading, and archival.",
                icon: "sliders",
                color: "#10b981",
            },
        ],
        roles: [
            {
                name: "Lead Photographer",
                description: "Coordinates photo assignments, camera allocations, and live coverage.",
                rank: 750,
                color: "#f59e0b",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "Studio Manager",
                description: "Supervises lighting gear, lenses, backdrop setup, and equipment checkout.",
                rank: 650,
                color: "#ef4444",
                permissions: ["tasks:create", "tasks:assign", "files:upload"],
            },
            {
                name: "Head Video Editor",
                description: "Oversees DaVinci Resolve timelines and final video exports.",
                rank: 600,
                color: "#3b82f6",
                permissions: ["tasks:create", "files:upload"],
            },
        ],
        categories: [
            {
                name: "Club-Wide",
                channels: [
                    { name: "general", slug: "general", topic: "Photo & video chats", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Event schedules and shoot calls", channelType: "announcement" },
                    { name: "gear-inventory", slug: "gear-inventory", topic: "Cameras, lenses, SD cards, and lighting status", channelType: "text" },
                ],
            },
            {
                name: "Media Labs",
                channels: [
                    { name: "event-coverage", slug: "event-coverage", topic: "Assignments and live shot coordination", channelType: "text" },
                    { name: "photo-critique", slug: "photo-critique", topic: "Composition, exposure, and color critiques", channelType: "forum" },
                    { name: "gallery-showcase", slug: "gallery-showcase", topic: "Best shots and festival highlights", channelType: "text" },
                ],
            },
        ],
    },

    entrepreneurship: {
        id: "entrepreneurship",
        name: "Entrepreneurship Club",
        description: "Engineered for startup incubators, case competitions, corporate sponsorships, and venture funding.",
        departments: [
            {
                name: "Startup Incubation & Ideation",
                slug: "startup-incubation",
                description: "Problem validation, customer discovery, MVPs, and business models.",
                icon: "rocket",
                color: "#10b981",
            },
            {
                name: "Pitch & Competitions",
                slug: "pitch-competitions",
                description: "Pitch deck reviews, elevator pitches, and case competition teams.",
                icon: "award",
                color: "#6366f1",
            },
            {
                name: "Corporate & Sponsor Relations",
                slug: "corporate-relations",
                description: "Industry partnerships, corporate sponsorship packages, and guest speakers.",
                icon: "briefcase",
                color: "#3b82f6",
            },
            {
                name: "Venture Finance & Grants",
                slug: "venture-finance",
                description: "Seed grants, venture debt, financial models, and budget auditing.",
                icon: "dollar-sign",
                color: "#d97706",
            },
        ],
        roles: [
            {
                name: "Incubation Director",
                description: "Oversees student startup cohorts, venture milestones, and pitch readiness.",
                rank: 750,
                color: "#10b981",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "Venture Lead",
                description: "Coordinates pitch practice sessions and mentor connects.",
                rank: 650,
                color: "#6366f1",
                permissions: ["tasks:create", "tasks:assign", "files:upload"],
            },
            {
                name: "Corporate Liaison",
                description: "Handles sponsor outreach, deliverables, and MoU agreements.",
                rank: 600,
                color: "#3b82f6",
                permissions: ["tasks:create", "files:upload"],
            },
        ],
        categories: [
            {
                name: "Club-Wide",
                channels: [
                    { name: "general", slug: "general", topic: "Entrepreneurial discussions and ideas", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Venture competitions and grant deadlines", channelType: "announcement" },
                    { name: "founder-connect", slug: "founder-connect", topic: "Meet co-founders and team formation", channelType: "text" },
                ],
            },
            {
                name: "Venture Desk",
                channels: [
                    { name: "pitch-deck-clinic", slug: "pitch-deck-clinic", topic: "Slide deck reviews and feedback", channelType: "forum" },
                    { name: "sponsor-outreach", slug: "sponsor-outreach", topic: "Sponsorship pipeline and agreements", channelType: "text" },
                    { name: "market-research", slug: "market-research", topic: "Market sizing, surveys, and competitive analysis", channelType: "text" },
                ],
            },
        ],
    },

    general: {
        id: "general",
        name: "General Student Club",
        description: "Standard balanced workspace with general channels and operational departments for all campus organizations.",
        departments: [
            {
                name: "Operations & Logistics",
                slug: "operations-logistics",
                description: "Venue permissions, equipment setup, calendar scheduling, and supplies.",
                icon: "settings",
                color: "#3b82f6",
            },
            {
                name: "Public Relations & Outreach",
                slug: "pr-outreach",
                description: "Social media, student announcements, campus posters, and newsletters.",
                icon: "megaphone",
                color: "#f59e0b",
            },
            {
                name: "Cultural & Events",
                slug: "cultural-events",
                description: "Festivals, workshops, speaker sessions, and annual gatherings.",
                icon: "calendar",
                color: "#8b5cf6",
            },
            {
                name: "Finance & Accounts",
                slug: "finance-accounts",
                description: "Budget management, member dues, invoices, and expense claims.",
                icon: "credit-card",
                color: "#10b981",
            },
        ],
        roles: [
            {
                name: "Operations Coordinator",
                description: "Leads event logistics, inventory management, and space booking.",
                rank: 700,
                color: "#3b82f6",
                permissions: ["tasks:create", "tasks:assign", "tasks:review", "departments:manage", "files:manage"],
            },
            {
                name: "Publicity Officer",
                description: "Curates social campaigns and student engagement.",
                rank: 600,
                color: "#f59e0b",
                permissions: ["tasks:create", "files:upload"],
            },
            {
                name: "Event Lead",
                description: "Coordinates volunteers, stage setup, and schedules.",
                rank: 600,
                color: "#8b5cf6",
                permissions: ["tasks:create", "files:upload"],
            },
        ],
        categories: [
            {
                name: "General",
                channels: [
                    { name: "general", slug: "general", topic: "General club collaboration", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Official club notices and milestones", channelType: "announcement" },
                    { name: "events-calendar", slug: "events-calendar", topic: "Upcoming events and meetings", channelType: "text" },
                ],
            },
            {
                name: "Operations",
                channels: [
                    { name: "meeting-minutes", slug: "meeting-minutes", topic: "Notes from executive and general meetings", channelType: "text" },
                    { name: "volunteer-desk", slug: "volunteer-desk", topic: "Duty assignments and volunteer coordination", channelType: "forum" },
                ],
            },
        ],
    },

    custom: {
        id: "custom",
        name: "Custom Workspace",
        description: "Empty canvas with standard baseline channels, ready for bespoke organizational tailoring.",
        departments: [],
        roles: [],
        categories: [
            {
                name: "General",
                channels: [
                    { name: "general", slug: "general", topic: "General club collaboration", channelType: "text" },
                    { name: "announcements", slug: "announcements", topic: "Official announcements", channelType: "announcement" },
                ],
            },
        ],
    },
};

// Aliases for backward compatibility
WORKSPACE_TEMPLATES.tech = { ...WORKSPACE_TEMPLATES.technical!, id: "tech" };
WORKSPACE_TEMPLATES.business = { ...WORKSPACE_TEMPLATES.entrepreneurship!, id: "business" };
WORKSPACE_TEMPLATES.standard = { ...WORKSPACE_TEMPLATES.general!, id: "standard" };
WORKSPACE_TEMPLATES.media = { ...WORKSPACE_TEMPLATES.design!, id: "media" };

export class WorkspaceTemplateService {
    /**
     * Lists the 7 standard available workspace templates
     */
    static getAvailableTemplates(): WorkspaceTemplateDefinition[] {
        const canonicalKeys = ["technical", "coding", "design", "photography", "entrepreneurship", "general", "custom"];
        return canonicalKeys.map((k) => WORKSPACE_TEMPLATES[k]!);
    }

    /**
     * Applies a chosen template to a workspace.
     * Provisions departments, customizable roles, and channels idempotently.
     */
    static async applyTemplate(
        workspaceId: string,
        actorUserId: string,
        templateId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<{
        template: WorkspaceTemplateDefinition;
        departmentsCreated: number;
        categoriesCreated: number;
        channelsCreated: number;
        rolesCreated: number;
    }> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager && !ctx.permissions.includes("workspace:manage_settings"))) {
            throw new Error("Unauthorized: Only workspace administrators can apply templates.");
        }

        const template = WORKSPACE_TEMPLATES[templateId.toLowerCase()] || WORKSPACE_TEMPLATES.general;
        if (!template) {
            throw new Error(`Unknown template '${templateId}'. Available templates: technical, coding, design, photography, entrepreneurship, general, custom.`);
        }

        let departmentsCreated = 0;
        let categoriesCreated = 0;
        let channelsCreated = 0;
        let rolesCreated = 0;

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // 1. Provision template departments
            const existingDepts = await WorkspaceRepository.listDepartments(workspaceId, true);
            const existingDeptSlugs = new Set(existingDepts.map((d) => d.slug));

            for (let i = 0; i < template.departments.length; i++) {
                const deptDef = template.departments[i]!;
                if (!existingDeptSlugs.has(deptDef.slug)) {
                    await WorkspaceRepository.createDepartment(client, {
                        workspaceId,
                        name: deptDef.name,
                        slug: deptDef.slug,
                        description: deptDef.description,
                        icon: deptDef.icon,
                        color: deptDef.color,
                        displayOrder: existingDepts.length + i,
                    });
                    departmentsCreated++;
                }
            }

            // 2. Provision template roles (custom, fully customizable)
            if (template.roles && template.roles.length > 0) {
                const existingRoles = await WorkspaceRepository.listRoles(workspaceId);
                const existingRoleNames = new Set(existingRoles.map((r) => r.name.toLowerCase()));

                for (const roleDef of template.roles) {
                    if (!existingRoleNames.has(roleDef.name.toLowerCase())) {
                        const baseSlug = roleDef.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
                        await WorkspaceRepository.createRole(client, {
                            workspaceId,
                            name: roleDef.name,
                            slug: `${baseSlug}-${workspaceId.slice(0, 4)}`,
                            description: roleDef.description,
                            rank: Math.min(roleDef.rank, 799),
                            isSystem: false,
                            color: roleDef.color,
                            permissions: roleDef.permissions,
                        });
                        rolesCreated++;
                    }
                }
            }

            // 3. Provision template categories and channels
            const existingCategories = await WorkspaceRepository.listCategories(workspaceId);
            const existingCatNames = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));

            for (let cIdx = 0; cIdx < template.categories.length; cIdx++) {
                const catDef = template.categories[cIdx]!;
                let categoryId = existingCatNames.get(catDef.name.toLowerCase());

                if (!categoryId) {
                    const catRes = await client.query(
                        `INSERT INTO public.workspace_channel_categories (workspace_id, name, display_order)
                         VALUES ($1, $2, $3)
                         RETURNING id;`,
                        [workspaceId, catDef.name, existingCategories.length + cIdx]
                    );
                    const createdCatId = catRes.rows[0].id as string;
                    categoryId = createdCatId;
                    existingCatNames.set(catDef.name.toLowerCase(), createdCatId);
                    categoriesCreated++;
                }

                // Check existing channels in this workspace
                const chRes = await client.query(
                    `SELECT slug FROM public.workspace_channels WHERE workspace_id = $1;`,
                    [workspaceId]
                );
                const existingChannelSlugs = new Set(chRes.rows.map((r: any) => r.slug));

                for (let chIdx = 0; chIdx < catDef.channels.length; chIdx++) {
                    const chDef = catDef.channels[chIdx]!;
                    if (!existingChannelSlugs.has(chDef.slug)) {
                        await client.query(
                            `INSERT INTO public.workspace_channels (
                                workspace_id, category_id, name, slug, topic, channel_type, is_private, created_by
                            ) VALUES ($1, $2, $3, $4, $5, $6, false, $7);`,
                            [
                                workspaceId,
                                categoryId,
                                chDef.name,
                                chDef.slug,
                                chDef.topic,
                                chDef.channelType,
                                actorUserId,
                            ]
                        );
                        channelsCreated++;
                        existingChannelSlugs.add(chDef.slug);
                    }
                }
            }

            // Update workspace settings with applied template
            await client.query(
                `UPDATE public.team_workspaces
                 SET settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{template}', to_jsonb($2::text)),
                     updated_at = NOW()
                 WHERE id = $1;`,
                [workspaceId, template.id]
            );

            // Audit log
            await WorkspaceRepository.logAudit(client, {
                workspaceId,
                actorId: actorUserId,
                action: "template_applied",
                targetType: "workspace",
                targetId: workspaceId,
                details: {
                    templateId: template.id,
                    templateName: template.name,
                    departmentsCreated,
                    rolesCreated,
                    categoriesCreated,
                    channelsCreated,
                },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await client.query("COMMIT;");

            // Invalidate workspace caches
            await WorkspaceRedisService.invalidateWorkspace(ctx.workspace.clubId);
            await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);

            return {
                template,
                departmentsCreated,
                rolesCreated,
                categoriesCreated,
                channelsCreated,
            };
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }
}
