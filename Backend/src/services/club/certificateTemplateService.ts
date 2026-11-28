/**
 * Certificate Studio Template Management Service
 * Phase 2, Phase 4 & Phase 8 Implementation
 */
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { SYSTEM_CERTIFICATE_TEMPLATES } from "./systemCertificateTemplates.js";
import type { CertificateDesign, CertificateTemplateRecord } from "../../types/certificateStudio.js";

export class CertificateTemplateService {
    /**
     * Seeds system templates into the database if they do not yet exist
     */
    static async seedSystemTemplates(): Promise<void> {
        for (const tmpl of SYSTEM_CERTIFICATE_TEMPLATES) {
            const check = await query(
                `SELECT id FROM certificate_templates WHERE is_system = true AND name = $1 LIMIT 1;`,
                [tmpl.name]
            );

            if (!check.rows[0]) {
                await query(
                    `INSERT INTO certificate_templates (
                        club_id, is_system, name, category, design, background_fit,
                        orientation, page_width, page_height, version, status
                    ) VALUES (
                        NULL, true, $1, $2, $3::jsonb, $4, $5, $6, $7, 1, 'published'
                    );`,
                    [
                        tmpl.name,
                        tmpl.category,
                        JSON.stringify(tmpl.design),
                        tmpl.backgroundFit || "cover",
                        tmpl.orientation,
                        tmpl.pageWidth,
                        tmpl.pageHeight,
                    ]
                );
            } else {
                // Keep system templates updated with latest design definitions
                await query(
                    `UPDATE certificate_templates SET
                        category = $1,
                        design = $2::jsonb,
                        orientation = $3,
                        page_width = $4,
                        page_height = $5,
                        updated_at = NOW()
                    WHERE id = $6;`,
                    [
                        tmpl.category,
                        JSON.stringify(tmpl.design),
                        tmpl.orientation,
                        tmpl.pageWidth,
                        tmpl.pageHeight,
                        check.rows[0].id,
                    ]
                );
            }
        }

        // Invalidate Redis system templates cache (Phase 19 non-sensitive caching)
        if (redis && redis.status === "ready") {
            try {
                const keys = await redis.keys("orbix:cert:system_templates:*");
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } catch (err) {
                // Ignore cache invalidation error
            }
        }
    }

    /**
     * Lists templates: system templates and club-specific templates
     */
    static async getTemplates(clubId: string, filterCategory?: string): Promise<{
        systemTemplates: CertificateTemplateRecord[];
        clubTemplates: CertificateTemplateRecord[];
    }> {
        const sysCacheKey = `orbix:cert:system_templates:branded:${filterCategory || "all"}`;
        let sysRows: any[] | null = null;

        // Check Redis non-sensitive system templates cache (Phase 19)
        if (redis && redis.status === "ready") {
            try {
                const cached = await redis.get(sysCacheKey);
                if (cached) {
                    sysRows = JSON.parse(cached);
                }
            } catch (err) {
                // Ignore Redis errors gracefully
            }
        }

        if (!sysRows) {
            // Ensure system templates exist
            await this.seedSystemTemplates();

            let sysQuery = `
                SELECT
                    t.*,
                    'Orbix Official' AS owner_club_name,
                    'Orbix Design Senate' AS creator_name,
                    COALESCE((SELECT COUNT(*)::int FROM club_certificates cc WHERE cc.template_id = t.id), 0) AS usage_count
                FROM certificate_templates t
                WHERE t.is_system = true AND t.status = 'published'`;
            const sysParams: any[] = [];
            if (filterCategory && filterCategory !== "all") {
                sysParams.push(filterCategory);
                sysQuery += ` AND t.category = $1`;
            }
            sysQuery += ` ORDER BY t.created_at ASC;`;

            const sysRes = await query(sysQuery, sysParams);
            sysRows = sysRes.rows;

            if (redis && redis.status === "ready") {
                try {
                    await redis.setex(sysCacheKey, 3600, JSON.stringify(sysRows)); // 1 hour TTL
                } catch (err) {
                    // Ignore cache set error
                }
            }
        }

        let clubQuery = `
            SELECT
                t.*,
                COALESCE(vc.name, 'Your Club') AS owner_club_name,
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username, 'Club Staff') AS creator_name,
                COALESCE((SELECT COUNT(*)::int FROM club_certificates cc WHERE cc.template_id = t.id), 0) AS usage_count
            FROM certificate_templates t
            LEFT JOIN verified_clubs vc ON vc.id = t.club_id
            LEFT JOIN users u ON u.id = t.created_by
            WHERE t.club_id = $1 AND t.status != 'archived'`;
        const clubParams: any[] = [clubId];
        if (filterCategory && filterCategory !== "all") {
            clubParams.push(filterCategory);
            clubQuery += ` AND t.category = $2`;
        }
        clubQuery += ` ORDER BY t.updated_at DESC, t.id;`;

        const clubRes = await query(clubQuery, clubParams);

        const formatRow = (r: any): CertificateTemplateRecord => {
            const design = typeof r.design === "string" ? JSON.parse(r.design) : r.design;
            const orientation = r.orientation || "landscape";
            const pWidth = r.page_width || 842;
            const pHeight = r.page_height || 595;
            const sizeLabel = pWidth === 842 || pHeight === 842 ? "A4" : pWidth === 792 || pHeight === 792 ? "US Letter" : "Custom";

            return {
                id: r.id,
                clubId: r.club_id,
                ownerClubName: r.owner_club_name || (r.is_system ? "Orbix Official" : "Your Club"),
                creatorName: r.creator_name || (r.is_system ? "Orbix Design Senate" : "Club Staff"),
                usageCount: Number(r.usage_count) || 0,
                pageSizeLabel: `${pWidth} × ${pHeight} pt (${sizeLabel})`,
                isSystem: r.is_system,
                name: r.name,
                category: r.category,
                subcategory: design?.subcategory || r.category,
                style: design?.style || "classic",
                aspectRatio: design?.aspectRatio || (orientation === "portrait" ? "1:1.414 (A4)" : "1.414:1 (A4)"),
                design,
                backgroundAssetUrl: r.background_asset_url,
                backgroundFit: r.background_fit || "cover",
                orientation,
                pageWidth: pWidth,
                pageHeight: pHeight,
                version: r.version,
                status: r.status,
                thumbnailUrl: r.thumbnail_url,
                createdBy: r.created_by,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
            };
        };

        return {
            systemTemplates: sysRows.map(formatRow),
            clubTemplates: clubRes.rows.map(formatRow),
        };
    }

    /**
     * Fetches a single template by ID
     */
    static async getTemplateById(templateId: string, clubId: string): Promise<CertificateTemplateRecord | null> {
        const res = await query(
            `SELECT
                t.*,
                COALESCE(vc.name, 'Orbix Official') AS owner_club_name,
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username, 'Orbix System') AS creator_name,
                COALESCE((SELECT COUNT(*)::int FROM club_certificates cc WHERE cc.template_id = t.id), 0) AS usage_count
             FROM certificate_templates t
             LEFT JOIN verified_clubs vc ON vc.id = t.club_id
             LEFT JOIN users u ON u.id = t.created_by
             WHERE t.id = $1 AND (t.is_system = true OR t.club_id = $2)
             LIMIT 1;`,
            [templateId, clubId]
        );

        if (!res.rows[0]) return null;
        const r = res.rows[0];
        const design = typeof r.design === "string" ? JSON.parse(r.design) : r.design;
        const orientation = r.orientation || "landscape";
        const pWidth = r.page_width || 842;
        const pHeight = r.page_height || 595;
        const sizeLabel = pWidth === 842 || pHeight === 842 ? "A4" : pWidth === 792 || pHeight === 792 ? "US Letter" : "Custom";

        return {
            id: r.id,
            clubId: r.club_id,
            ownerClubName: r.owner_club_name || (r.is_system ? "Orbix Official" : "Your Club"),
            creatorName: r.creator_name || (r.is_system ? "Orbix Design Senate" : "Club Staff"),
            usageCount: Number(r.usage_count) || 0,
            pageSizeLabel: `${pWidth} × ${pHeight} pt (${sizeLabel})`,
            isSystem: r.is_system,
            name: r.name,
            category: r.category,
            subcategory: design?.subcategory || r.category,
            style: design?.style || "classic",
            aspectRatio: design?.aspectRatio || (orientation === "portrait" ? "1:1.414 (A4)" : "1.414:1 (A4)"),
            design,
            backgroundAssetUrl: r.background_asset_url,
            backgroundFit: r.background_fit || "cover",
            orientation,
            pageWidth: pWidth,
            pageHeight: pHeight,
            version: r.version,
            status: r.status,
            thumbnailUrl: r.thumbnail_url,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    /**
     * Creates a new club template (from scratch, from upload, or duplicated from system)
     */
    static async createTemplate(
        clubId: string,
        userId: string,
        data: {
            name: string;
            category?: string | undefined;
            design: CertificateDesign;
            backgroundAssetUrl?: string | null | undefined;
            backgroundFit?: "cover" | "contain" | "stretch" | undefined;
            orientation?: "landscape" | "portrait" | undefined;
            pageWidth?: number | undefined;
            pageHeight?: number | undefined;
            officialTemplateId?: string | null | undefined;
            starterCopy?: boolean | undefined;
            creationKey?: string | undefined;
            status?: "draft" | "published" | "archived" | undefined;
        }
    ): Promise<CertificateTemplateRecord> {
        const orientation = data.orientation || data.design?.page?.orientation || "landscape";
        const pageWidth = data.pageWidth || (orientation === "portrait" ? 595 : 842);
        const pageHeight = data.pageHeight || (orientation === "portrait" ? 842 : 595);
        const status = data.status || "published";

        const conflictClause = data.starterCopy
            ? `ON CONFLICT (club_id, official_template_id) WHERE is_starter_copy AND status <> 'archived'
               DO UPDATE SET last_used_at = NOW()`
            : `ON CONFLICT (club_id, creation_key) DO UPDATE
               SET creation_key = certificate_templates.creation_key
               WHERE certificate_templates.created_by = EXCLUDED.created_by AND certificate_templates.status <> 'archived'`;
        const insertRes = await query(
            `INSERT INTO certificate_templates (
                club_id, is_system, name, category, design, background_asset_url,
                background_fit, orientation, page_width, page_height, version, status, created_by,
                official_template_id, is_starter_copy, creation_key, last_used_at
            ) VALUES (
                $1, false, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, $14, CASE WHEN $13 THEN NOW() END
            ) ${conflictClause} RETURNING *;`,
            [
                clubId,
                data.name.trim(),
                data.category || "event",
                JSON.stringify(data.design),
                data.backgroundAssetUrl || null,
                data.backgroundFit || "cover",
                orientation,
                pageWidth,
                pageHeight,
                status,
                userId,
                data.officialTemplateId || null,
                data.starterCopy || false,
                data.creationKey || null,
            ]
        );

        const r = insertRes.rows[0];
        if (!r) throw new Error("Template could not be saved.");
        const resDesign = typeof r.design === "string" ? JSON.parse(r.design) : r.design;
        return {
            id: r.id,
            clubId: r.club_id,
            isSystem: r.is_system,
            name: r.name,
            category: r.category,
            subcategory: resDesign?.subcategory || r.category,
            style: resDesign?.style || "classic",
            aspectRatio: resDesign?.aspectRatio || (r.orientation === "portrait" ? "1:1.414 (A4)" : "1.414:1 (A4)"),
            design: resDesign,
            backgroundAssetUrl: r.background_asset_url,
            backgroundFit: r.background_fit || "cover",
            orientation: r.orientation,
            pageWidth: r.page_width,
            pageHeight: r.page_height,
            version: r.version,
            status: r.status,
            thumbnailUrl: r.thumbnail_url,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    /**
     * Updates an existing club-owned template
     * Increments version if already used in issuance, ensuring immutability of past credentials
     */
    static async updateTemplate(
        templateId: string,
        clubId: string,
        userId: string,
        data: {
            name?: string;
            category?: string;
            design?: CertificateDesign;
            backgroundAssetUrl?: string | null;
            backgroundFit?: "cover" | "contain" | "stretch";
            status?: "draft" | "published" | "archived";
        }
    ): Promise<CertificateTemplateRecord> {
        const updateRes = await query(
            `UPDATE certificate_templates SET
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                design = COALESCE($3::jsonb, design),
                background_asset_url = COALESCE($4, background_asset_url),
                background_fit = COALESCE($5, background_fit),
                orientation = COALESCE($6, orientation),
                page_width = COALESCE($7, page_width),
                page_height = COALESCE($8, page_height),
                version = version + CASE WHEN $3::jsonb IS DISTINCT FROM design AND $3::jsonb IS NOT NULL AND EXISTS (
                    SELECT 1 FROM club_certificates WHERE template_id = $10
                ) THEN 1 ELSE 0 END,
                status = COALESCE($9, status),
                updated_at = NOW()
            WHERE id = $10 AND club_id = $11 AND NOT is_system AND (status <> 'archived' OR $9 IS NOT NULL)
            RETURNING *;`,
            [
                data.name?.trim() || null,
                data.category || null,
                data.design ? JSON.stringify(data.design) : null,
                data.backgroundAssetUrl !== undefined ? data.backgroundAssetUrl : null,
                data.backgroundFit || null,
                data.design?.page?.orientation || null,
                data.design?.page?.width || null,
                data.design?.page?.height || null,
                data.status || null,
                templateId,
                clubId,
            ]
        );

        const r = updateRes.rows[0];
        if (!r) throw new Error("Template not found or cannot be modified.");
        const resDesign = typeof r.design === "string" ? JSON.parse(r.design) : r.design;
        return {
            id: r.id,
            clubId: r.club_id,
            isSystem: r.is_system,
            name: r.name,
            category: r.category,
            subcategory: resDesign?.subcategory || r.category,
            style: resDesign?.style || "classic",
            aspectRatio: resDesign?.aspectRatio || (r.orientation === "portrait" ? "1:1.414 (A4)" : "1.414:1 (A4)"),
            design: resDesign,
            backgroundAssetUrl: r.background_asset_url,
            backgroundFit: r.background_fit || "cover",
            orientation: r.orientation,
            pageWidth: r.page_width,
            pageHeight: r.page_height,
            version: r.version,
            status: r.status,
            thumbnailUrl: r.thumbnail_url,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    /**
     * Duplicates any template (system or club) into a new club-owned editable template
     */
    static async duplicateTemplate(
        sourceTemplateId: string,
        clubId: string,
        userId: string,
        customName?: string,
        reuseOfficial = false,
    ): Promise<CertificateTemplateRecord> {
        const source = await this.getTemplateById(sourceTemplateId, clubId);
        if (!source || source.status === "archived" || (source.isSystem && source.status !== "published")) {
            throw new Error("Source template not found.");
        }

        const lineage = await query("SELECT official_template_id FROM certificate_templates WHERE id = $1;", [source.id]);

        const newName = customName?.trim() || `${source.name} (Copy)`;

        return this.createTemplate(clubId, userId, {
            name: newName,
            category: source.category,
            design: source.design,
            backgroundAssetUrl: source.backgroundAssetUrl,
            backgroundFit: source.backgroundFit,
            orientation: source.orientation,
            pageWidth: source.pageWidth,
            pageHeight: source.pageHeight,
            officialTemplateId: source.isSystem ? source.id : lineage.rows[0]?.official_template_id,
            starterCopy: source.isSystem && reuseOfficial,
        });
    }

    /**
     * Renames a club-owned template
     */
    static async renameTemplate(templateId: string, clubId: string, newName: string): Promise<CertificateTemplateRecord> {
        return this.updateTemplate(templateId, clubId, "", { name: newName.trim() });
    }

    /**
     * Soft archives a club-owned template
     */
    static async archiveTemplate(templateId: string, clubId: string): Promise<void> {
        const delRes = await query(
            `UPDATE certificate_templates SET status = 'archived', updated_at = NOW()
             WHERE id = $1 AND club_id = $2 AND is_system = false RETURNING id;`,
            [templateId, clubId]
        );

        if (!delRes.rows[0]) {
            throw new Error("Template not found or cannot be archived.");
        }
    }
}
