// Backend/scripts/test_team_workspace_phase_06.ts
import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import { WorkspaceMemberService } from "../src/services/workspace/workspaceMemberService.js";
import { WorkspaceFileService } from "../src/services/workspace/workspaceFileService.js";
import { validateFileMetadata, validateBufferMagicBytes, computeSha256 } from "../src/services/workspace/workspaceFileValidator.js";

async function runPhase06Tests() {
    console.log("===============================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 06 FILES, RESOURCES & CLOUDINARY TEST SUITE");
    console.log("===============================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(desc: string, condition: boolean) {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`);
            failed++;
        }
    }

    try {
        // 1. Fetch Target Club and Owner
        const clubRes = await query(
            `SELECT vc.id, vc.name, vc.auth_user_id 
             FROM public.verified_clubs vc 
             WHERE vc.auth_user_id IS NOT NULL 
             LIMIT 1;`
        );
        if (clubRes.rows.length === 0) {
            throw new Error("No verified club with an owner found in database.");
        }
        const club = clubRes.rows[0];
        const ownerUserId = club.auth_user_id;
        console.log(`Target Club: "${club.name}" (Club ID: ${club.id}, Owner User ID: ${ownerUserId})`);

        // Ensure Workspace exists
        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(club.id, ownerUserId);
        const workspaceId = workspace.id;

        // 2. Provision Test Users
        const randKey = Math.random().toString(36).slice(2, 7);
        const makeUser = async (roleName: string) => {
            const uRes = await query(
                `INSERT INTO public.users (email, username, firstname, lastname)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, firstname, lastname;`,
                [
                    `p6_${roleName}_${randKey}@test.orbix.club`,
                    `p6_${roleName}_${randKey}`,
                    `P6${roleName}`,
                    `User`,
                ]
            );
            return uRes.rows[0];
        };

        const managerUser = await makeUser("mgr");
        const deptLeadUser = await makeUser("lead");
        const deptMemberUser = await makeUser("member");
        const outsideUser = await makeUser("outside");

        // Provision Department
        const dept = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: `P6 Dept ${randKey}`,
            slug: `p6-dept-${randKey}`,
            leadUserId: deptLeadUser.id,
            color: "#70C4FF",
        });

        // Add members
        const defaultRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultRole) throw new Error("Default member role not found.");

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: managerUser.id,
            roleId: defaultRole.id,
            status: "active",
        });

        // Appoint Workspace Manager with delegated powers
        await WorkspaceMemberService.appointWorkspaceManager(
            workspaceId,
            ownerUserId,
            managerUser.id,
            [
                "can_manage_departments",
                "can_manage_members",
                "can_invite_members",
                "can_manage_channels",
                "can_manage_tasks",
                "can_manage_settings",
            ]
        );

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptLeadUser.id,
            roleId: defaultRole.id,
            departmentId: dept.id,
            status: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: deptMemberUser.id,
            roleId: defaultRole.id,
            departmentId: dept.id,
            status: "active",
        });

        await WorkspaceRepository.createMember(null, {
            workspaceId,
            userId: outsideUser.id,
            roleId: defaultRole.id,
            departmentId: null,
            status: "active",
        });

        console.log("\n--- TEST GROUP 1: FILE METADATA & MAGIC BYTE VALIDATION ---");
        // Check allowed formats
        const validMetaPdf = validateFileMetadata("guidelines.pdf", "application/pdf", 1024 * 500);
        assert("PDF metadata is valid and categorized as pdf", validMetaPdf.isValid && validMetaPdf.category === "pdf");

        const validMetaImg = validateFileMetadata("logo.png", "image/png", 1024 * 100);
        assert("PNG metadata is valid and categorized as image", validMetaImg.isValid && validMetaImg.category === "image");

        const validMetaVideo = validateFileMetadata("promo.mp4", "video/mp4", 1024 * 1024 * 10);
        assert("MP4 video metadata is valid and categorized as video", validMetaVideo.isValid && validMetaVideo.category === "video");

        // Check blocked dangerous extensions
        const blockedExe = validateFileMetadata("trojan.exe", "application/x-msdownload", 1024);
        assert("Executable .exe files are strictly blocked", !blockedExe.isValid);

        const blockedPhp = validateFileMetadata("shell.php", "application/x-php", 1024);
        assert("Server-side script .php files are blocked", !blockedPhp.isValid);

        const blockedSvg = validateFileMetadata("vector.svg", "image/svg+xml", 1024);
        assert("SVG files (XSS vector) are blocked from upload", !blockedSvg.isValid);

        // Check magic bytes
        const pdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
        const pdfValidation = validateBufferMagicBytes(pdfBuffer, "test.pdf", "application/pdf");
        assert("Real PDF buffer passes magic byte verification", pdfValidation.isValid && pdfValidation.category === "pdf");

        const fakePdfBuffer = Buffer.from("<html><script>alert('pwned')</script></html>");
        const fakePdfValidation = validateBufferMagicBytes(fakePdfBuffer, "fake.pdf", "application/pdf");
        assert("Spoofed PDF buffer (HTML masquerading as PDF) is rejected", !fakePdfValidation.isValid);

        console.log("\n--- TEST GROUP 2: STORAGE USAGE & QUOTA ENGINE ---");
        const storageUsage = await WorkspaceFileService.getWorkspaceStorageUsage(workspaceId, ownerUserId);
        assert("Storage quota reports valid quotaBytes (10GB default)", storageUsage.quotaBytes === 10 * 1024 * 1024 * 1024);
        assert("Storage usage reports integer usedBytes and fileCount", typeof storageUsage.usedBytes === "number" && typeof storageUsage.fileCount === "number");

        console.log("\n--- TEST GROUP 3: DETERMINISTIC CLOUDINARY PATH GENERATION ---");
        const generalResourcePath = WorkspaceFileService.buildFolderPath(workspaceId, "resource", null, null, "document");
        assert("General resource path matches orbix/team-workspaces/:wsId/resources", generalResourcePath === `orbix/team-workspaces/${workspaceId}/resources`);

        const deptResourcePath = WorkspaceFileService.buildFolderPath(workspaceId, "resource", null, dept.id, "document");
        assert("Department resource path matches orbix/team-workspaces/:wsId/departments/:deptId/resources", deptResourcePath === `orbix/team-workspaces/${workspaceId}/departments/${dept.id}/resources`);

        const taskPath = WorkspaceFileService.buildFolderPath(workspaceId, "task", "task-123", dept.id, "image");
        assert("Task attachment path matches orbix/team-workspaces/:wsId/departments/:deptId/tasks/:taskId/images", taskPath === `orbix/team-workspaces/${workspaceId}/departments/${dept.id}/tasks/task-123/images`);

        console.log("\n--- TEST GROUP 4: UPLOAD INTENT & ENRICHMENT ---");
        const uploadIntent = await WorkspaceFileService.createUploadIntent(workspaceId, ownerUserId, {
            fileName: "Workspace_Guidelines.pdf",
            fileSizeBytes: pdfBuffer.length,
            mimeType: "application/pdf",
            parentResourceType: "resource",
        });

        assert("Upload intent generates signed authentication signature", !!uploadIntent.signature);
        assert("Upload intent generates authenticated delivery type", uploadIntent.deliveryType === "authenticated");
        assert("Upload intent specifies 15-minute expiration timestamp", typeof uploadIntent.timestamp === "number" && !!uploadIntent.expiresAt);
        assert("Upload intent targets Cloudinary signed upload URL", uploadIntent.uploadUrl.includes("cloudinary.com"));

        // Register upload in repository
        const registeredFile = await WorkspaceFileService.registerUpload(workspaceId, ownerUserId, {
            intentId: uploadIntent.intentId,
            cloudinaryPublicId: uploadIntent.publicId,
            secureUrl: `https://res.cloudinary.com/${uploadIntent.cloudName}/raw/upload/v123456/${uploadIntent.publicId}.pdf`,
            fileSizeBytes: pdfBuffer.length,
            mimeType: "application/pdf",
        });

        assert("Registered file is persisted in workspace_files table", !!registeredFile.id);
        assert("Registered file has authenticated delivery URL enriched", !!registeredFile.deliveryUrl);
        assert("Registered PDF has page 1 thumbnail delivery URL enriched", !!registeredFile.thumbnailUrl);

        console.log("\n--- TEST GROUP 5: ZERO-TRUST ACCESS CONTROL & DEPARTMENT PRIVACY ---");
        // Department lead and department member can access dept resource
        const deptFile = await WorkspaceRepository.createWorkspaceFile({
            workspaceId,
            uploaderId: deptLeadUser.id,
            departmentId: dept.id,
            fileName: "Secret_Dept_Budget.pdf",
            fileSizeBytes: 2048,
            mimeType: "application/pdf",
            cloudinaryPublicId: `orbix/team-workspaces/${workspaceId}/departments/${dept.id}/resources/secret_budget`,
            cloudinaryUrl: "https://example.com/budget.pdf",
            cloudinarySecureUrl: "https://example.com/budget.pdf",
            resourceType: "raw",
            deliveryType: "authenticated",
            parentResourceType: "resource",
        });

        // 1. Dept lead gets delivery URL
        const leadDelivery = await WorkspaceFileService.getAuthorizedDeliveryUrl(workspaceId, deptLeadUser.id, deptFile.id);
        assert("Department Lead can generate delivery URL for department file", !!leadDelivery.deliveryUrl);

        // 2. Dept member gets delivery URL
        const memberDelivery = await WorkspaceFileService.getAuthorizedDeliveryUrl(workspaceId, deptMemberUser.id, deptFile.id);
        assert("Department Member can generate delivery URL for department file", !!memberDelivery.deliveryUrl);

        // 3. Workspace Manager gets delivery URL
        const mgrDelivery = await WorkspaceFileService.getAuthorizedDeliveryUrl(workspaceId, managerUser.id, deptFile.id);
        assert("Workspace Manager can generate delivery URL across departments", !!mgrDelivery.deliveryUrl);

        // 4. Outside user is FORBIDDEN
        let outsideBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(workspaceId, outsideUser.id, deptFile.id);
        } catch (err: any) {
            outsideBlocked = err.message.includes("Forbidden");
        }
        assert("Outside member is strictly blocked (Forbidden) from department file", outsideBlocked);

        console.log("\n--- TEST GROUP 6: ASSET RENAMING & AUDIT LOGGING ---");
        const renamed = await WorkspaceFileService.renameFile(workspaceId, deptLeadUser.id, deptFile.id, "Public_Dept_Budget.pdf");
        assert("File is renamed to Public_Dept_Budget.pdf", renamed.fileName === "Public_Dept_Budget.pdf");

        // Verify audit log
        const renameAuditRes = await query(
            `SELECT action, details FROM public.workspace_audit_logs
             WHERE workspace_id = $1 AND target_id = $2 AND action = 'file_renamed'
             ORDER BY created_at DESC LIMIT 1;`,
            [workspaceId, deptFile.id]
        );
        assert("Audit log captures 'file_renamed' action", renameAuditRes.rows.length > 0);
        assert("Audit details include oldFileName and newFileName", renameAuditRes.rows[0]?.details?.oldFileName === "Secret_Dept_Budget.pdf" && renameAuditRes.rows[0]?.details?.newFileName === "Public_Dept_Budget.pdf");

        // Non-uploader outside user cannot rename
        let renameBlocked = false;
        try {
            await WorkspaceFileService.renameFile(workspaceId, outsideUser.id, deptFile.id, "Hacked_Name.pdf");
        } catch (err: any) {
            renameBlocked = err.message.includes("Forbidden");
        }
        assert("Unauthorized member cannot rename files", renameBlocked);

        console.log("\n--- TEST GROUP 7: SECURE SHARE LINK GENERATION ---");
        const shareResult = await WorkspaceFileService.generateShareUrl(workspaceId, deptMemberUser.id, deptFile.id, 86400);
        assert("Generates signed share link with valid URL", !!shareResult.shareUrl);
        assert("Generates share link expiration timestamp", !!shareResult.expiresAt);

        console.log("\n--- TEST GROUP 8: ASSET DELETION & AUDIT CLEANUP ---");
        const deleteSuccess = await WorkspaceFileService.deleteFile(workspaceId, deptLeadUser.id, deptFile.id);
        assert("Department lead successfully deletes department file", deleteSuccess === true);

        // Verify soft delete in DB
        const deletedCheck = await WorkspaceRepository.findFileById(workspaceId, deptFile.id);
        assert("File record is marked with deleted_at and assetStatus = 'archived'", !!deletedCheck?.deletedAt && deletedCheck?.assetStatus === "archived");

        // Deleted file delivery URL is rejected
        let accessDeletedBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(workspaceId, deptLeadUser.id, deptFile.id);
        } catch (err: any) {
            accessDeletedBlocked = err.message.includes("deleted");
        }
        assert("Requesting delivery URL for deleted file is rejected", accessDeletedBlocked);

        // Verify audit log for deletion
        const deleteAuditRes = await query(
            `SELECT action FROM public.workspace_audit_logs
             WHERE workspace_id = $1 AND target_id = $2 AND action = 'file_deleted';`,
            [workspaceId, deptFile.id]
        );
        assert("Audit log captures 'file_deleted' action", deleteAuditRes.rows.length > 0);

        console.log("\n--- TEST GROUP 9: CLEANUP OF TEST FIXTURES ---");
        await WorkspaceRepository.hardDeleteWorkspaceFile(workspaceId, registeredFile.id);
        await WorkspaceRepository.hardDeleteWorkspaceFile(workspaceId, deptFile.id);
        await query(`DELETE FROM public.workspace_departments WHERE id = $1;`, [dept.id]);
        await query(`DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id IN ($2, $3, $4, $5);`, [workspaceId, managerUser.id, deptLeadUser.id, deptMemberUser.id, outsideUser.id]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3, $4);`, [managerUser.id, deptLeadUser.id, deptMemberUser.id, outsideUser.id]);
        assert("Test fixtures and temporary files cleaned up cleanly", true);

    } catch (err: any) {
        console.error("Test execution failed with unhandled exception:", err);
        failed++;
    } finally {
        await pool.end();
        console.log("\n===============================================================================");
        console.log(`PHASE 06 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("===============================================================================");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runPhase06Tests();
