/**
 * Certificate Studio Template Management Service
 * Phase 2, Phase 4 & Phase 8 Implementation
 */
import { query } from "../../database/client.js";
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
    }

    /**
     * Lists templates: system templates and club-specific templates
     */
    static async getTemplates(clubId: string, filterCategory?: string): Promise<{
        systemTemplates: CertificateTemplateRecord[];
        clubTemplates: CertificateTemplateRecord[];
    }> {
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
        clubQuery += ` ORDER BY t.updated_at DESC;`;

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
            systemTemplates: sysRes.rows.map(formatRow),
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
            sourceTemplateId?: string | undefined;
        }
    ): Promise<CertificateTemplateRecord> {
        const orientation = data.orientation || data.design?.page?.orientation || "landscape";
        const pageWidth = data.pageWidth || (orientation === "portrait" ? 595 : 842);
        const pageHeight = data.pageHeight || (orientation === "portrait" ? 842 : 595);

        const insertRes = await query(
            `INSERT INTO certificate_templates (
                club_id, is_system, name, category, design, background_asset_url,
                background_fit, orientation, page_width, page_height, version, status, created_by
            ) VALUES (
                $1, false, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 1, 'published', $10
            ) RETURNING *;`,
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
                userId,
            ]
        );

        const r = insertRes.rows[0];
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
        // Verify ownership and not system template
        const current = await this.getTemplateById(templateId, clubId);
        if (!current) throw new Error("Template not found.");
        if (current.isSystem) throw new Error("Security Alert: System templates cannot be modified directly.");

        // Check if template has already been used to issue certificates
        const usageCheck = await query(
            `SELECT COUNT(*)::int AS count FROM club_certificates WHERE template_id = $1;`,
            [templateId]
        );
        const usedCount = usageCheck.rows[0]?.count || 0;
        const newVersion = usedCount > 0 ? current.version + 1 : current.version;

        const orientation = data.design?.page?.orientation || current.orientation;
        const pageWidth = data.design?.page?.width || current.pageWidth;
        const pageHeight = data.design?.page?.height || current.pageHeight;

        const updateRes = await query(
            `UPDATE certificate_templates SET
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                design = COALESCE($3::jsonb, design),
                background_asset_url = COALESCE($4, background_asset_url),
                background_fit = COALESCE($5, background_fit),
                orientation = $6,
                page_width = $7,
                page_height = $8,
                version = $9,
                status = COALESCE($10, status),
                updated_at = NOW()
            WHERE id = $11 AND club_id = $12
            RETURNING *;`,
            [
                data.name?.trim() || null,
                data.category || null,
                data.design ? JSON.stringify(data.design) : null,
                data.backgroundAssetUrl !== undefined ? data.backgroundAssetUrl : null,
                data.backgroundFit || null,
                orientation,
                pageWidth,
                pageHeight,
                newVersion,
                data.status || null,
                templateId,
                clubId,
            ]
        );

        const r = updateRes.rows[0];
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
        customName?: string
    ): Promise<CertificateTemplateRecord> {
        const source = await this.getTemplateById(sourceTemplateId, clubId);
        if (!source) throw new Error("Source template not found.");

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
            sourceTemplateId,
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
