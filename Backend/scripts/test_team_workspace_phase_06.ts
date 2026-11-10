// Backend/scripts/test_team_workspace_phase_06.ts
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { pool, query } from "../src/database/client.js";
import { WorkspaceService } from "../src/services/workspace/workspaceService.js";
import { WorkspaceFileService } from "../src/services/workspace/workspaceFileService.js";
import { WorkspaceTaskService } from "../src/services/workspace/workspaceTaskService.js";
import { WorkspaceDepartmentService } from "../src/services/workspace/workspaceDepartmentService.js";
import { WorkspaceRepository } from "../src/repositories/workspaceRepository.js";
import {
    validateFileMetadata,
    validateBufferMagicBytes,
    computeSha256,
} from "../src/services/workspace/workspaceFileValidator.js";

let testsPassed = 0;
let testsFailed = 0;

function assert(description: string, condition: boolean, extra?: any) {
    if (condition) {
        testsPassed++;
        console.log(`  ✅ [PASS] ${description}`);
    } else {
        testsFailed++;
        console.error(`  ❌ [FAIL] ${description}`, extra || "");
    }
}

async function runPhase06Tests() {
    console.log("================================================================================");
    console.log("ORBIX TEAM WORKSPACE — PHASE 06 ACCEPTANCE TEST SUITE");
    console.log("CLOUDINARY MEDIA & SECURE DOCUMENT MANAGEMENT");
    console.log("================================================================================\n");

    const runId = Math.random().toString(36).substring(2, 8);
    const leadUserId = "00000000-0000-0000-0000-000000000602";
    const memberUserId = "00000000-0000-0000-0000-000000000603";
    const foreignUserId = "00000000-0000-0000-0000-000000000604";

    try {
        // SETUP: Identify Club and Provision Root Workspace
        const clubRes = await query(`
            SELECT id, auth_user_id, name, slug 
            FROM public.verified_clubs 
            ORDER BY created_at ASC 
            LIMIT 1;
        `);

        if (clubRes.rows.length === 0) {
            throw new Error("No verified club found for test execution.");
        }

        const club = clubRes.rows[0];
        const ownerId = club.auth_user_id;

        // Clean any existing test data from previous runs
        await query(`DELETE FROM public.workspace_files WHERE uploader_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_file_upload_intents WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_task_activity WHERE actor_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_tasks WHERE creator_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_department_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_departments WHERE lead_user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.workspace_members WHERE user_id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);
        await query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [leadUserId, memberUserId, foreignUserId]);

        // 1. Create test users
        await query(
            `INSERT INTO public.users (id, email, username, firstname, lastname, password)
             VALUES
             ($1, $4, $5, 'Design', 'Lead', 'TestPass123!'),
             ($2, $6, $7, 'General', 'Member', 'TestPass123!'),
             ($3, $8, $9, 'Foreign', 'User', 'TestPass123!');`,
            [
                leadUserId,
                memberUserId,
                foreignUserId,
                `ws_lead_${runId}@orbix.test`,
                `lead_${runId}`,
                `ws_member_${runId}@orbix.test`,
                `member_${runId}`,
                `foreign_${runId}@orbix.test`,
                `foreign_${runId}`,
            ]
        );

        const { workspace } = await WorkspaceService.getOrCreateWorkspaceForClub(
            club.id,
            ownerId
        );

        console.log(`[Setup] Identified Club ID: ${club.id}, Workspace ID: ${workspace.id}`);

        const roles = await WorkspaceRepository.listRoles(workspace.id);
        const deptLeadRole = roles.find((r) => r.slug === "department_lead") || roles.find((r) => r.slug === "admin") || roles[0];
        const memberRole = roles.find((r) => r.slug === "member") || roles[roles.length - 1];

        // 4. Create a Department (Design Dept)
        const designDept = await WorkspaceDepartmentService.createDepartment(workspace.id, ownerId, {
            name: `Design & UX ${runId}`,
            description: "Design and multimedia team",
            icon: "Palette",
            color: "#8B5CF6",
            leadUserId: leadUserId,
        });

        // 3. Add members & roles
        const leadMember = await WorkspaceRepository.createMember(null, {
            workspaceId: workspace.id,
            userId: leadUserId,
            roleId: deptLeadRole.id,
            roleTitle: "Lead Designer",
            departmentId: designDept.id,
        });

        const generalMember = await WorkspaceRepository.createMember(null, {
            workspaceId: workspace.id,
            userId: memberUserId,
            roleId: memberRole.id,
            roleTitle: "Staff Member",
        });

        await WorkspaceDepartmentService.addMemberToDepartment(
            workspace.id,
            ownerId,
            designDept.id,
            leadMember.id,
            "lead",
            "Lead UX Designer"
        );

        // 5. Create a Task inside the Design Dept
        const task = await WorkspaceTaskService.createTask(workspace.id, ownerId, {
            title: "Brand Identity Guidelines PDF",
            description: "Prepare and review final vector logo assets and PDF brand guidelines.",
            departmentId: designDept.id,
            priority: "high",
        });

        console.log("\n--- TEST GROUP 1: FILE VALIDATION & MALICIOUS PAYLOAD DEFENSE (XSS/SVG/HTML) ---");

        // 1.1 Valid PNG metadata & magic numbers
        const validPngBuffer = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
        ]);
        const pngRes = validateBufferMagicBytes(validPngBuffer, "brand_logo.png", "image/png");
        assert("Valid PNG passes magic byte and metadata inspection", pngRes.isValid === true && pngRes.category === "image");

        // 1.2 Valid JPEG magic numbers
        const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
        const jpgRes = validateBufferMagicBytes(validJpgBuffer, "hero_banner.jpg", "image/jpeg");
        assert("Valid JPEG passes magic byte inspection", jpgRes.isValid === true && jpgRes.category === "image");

        // 1.3 Valid PDF header
        const validPdfBuffer = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
        const pdfRes = validateBufferMagicBytes(validPdfBuffer, "brand_guidelines.pdf", "application/pdf");
        assert("Valid PDF passes magic byte inspection and maps to pdf category", pdfRes.isValid === true && pdfRes.category === "pdf");

        // 1.4 Valid MP4 video header
        const validMp4Buffer = Buffer.from([
            0x00, 0x00, 0x00, 0x20, // size
            0x66, 0x74, 0x79, 0x70, // 'ftyp'
            0x69, 0x73, 0x6f, 0x6d, // 'isom'
            0x00, 0x00, 0x02, 0x00,
            0x6d, 0x70, 0x34, 0x31,
        ]);
        const mp4Res = validateBufferMagicBytes(validMp4Buffer, "promo_teaser.mp4", "video/mp4");
        assert("Valid MP4 passes video container inspection", mp4Res.isValid === true && mp4Res.category === "video");

        // 1.5 Malicious SVG rejection (Stored XSS vector)
        const svgMetadata = validateFileMetadata("malicious_icon.svg", "image/svg+xml", 1024);
        assert("SVG file extension is strictly rejected", svgMetadata.isValid === false && svgMetadata.error?.includes("prohibited"));

        // 1.6 Malicious HTML rejection
        const htmlMetadata = validateFileMetadata("stealth_xss.html", "text/html", 2048);
        assert("HTML file extension and MIME type are strictly rejected", htmlMetadata.isValid === false);

        // 1.7 Disguised SVG file named innocent.png (Magic byte & markup scanner)
        const disguisedSvgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>');
        const disguisedSvgRes = validateBufferMagicBytes(disguisedSvgBuffer, "innocent.png", "image/png");
        assert(
            "Disguised SVG disguised as PNG is detected and blocked by content inspector",
            disguisedSvgRes.isValid === false && disguisedSvgRes.error?.includes("malicious HTML/SVG")
        );

        // 1.8 Disguised HTML file named readme.txt (Payload scanner)
        const disguisedHtmlBuffer = Buffer.from("<!DOCTYPE html><html><body><script>fetch('http://attacker.com')</script></body></html>");
        const disguisedHtmlRes = validateBufferMagicBytes(disguisedHtmlBuffer, "notes.txt", "text/plain");
        assert(
            "Disguised HTML in text file is detected and blocked",
            disguisedHtmlRes.isValid === false && disguisedHtmlRes.error?.includes("malicious HTML/SVG")
        );

        // 1.9 Oversized image rejection (> 10MB)
        const oversizedImage = validateFileMetadata("giant_photo.png", "image/png", 11 * 1024 * 1024);
        assert("Image exceeding 10MB limit is rejected", oversizedImage.isValid === false && oversizedImage.error?.includes("exceeds maximum allowed size"));

        // 1.10 Oversized document rejection (> 25MB)
        const oversizedDoc = validateFileMetadata("massive_manual.pdf", "application/pdf", 30 * 1024 * 1024);
        assert("PDF exceeding 25MB limit is rejected", oversizedDoc.isValid === false && oversizedDoc.error?.includes("exceeds maximum allowed size"));

        console.log("\n--- TEST GROUP 2: DETERMINISTIC CLOUDINARY FOLDER HIERARCHY ---");

        // 2.1 Task Document folder
        const taskDocFolder = WorkspaceFileService.buildFolderPath(
            workspace.id,
            "task",
            task.id,
            designDept.id,
            "document"
        );
        assert(
            "Deterministic task document folder matches specification",
            taskDocFolder === `orbix/team-workspaces/${workspace.id}/departments/${designDept.id}/tasks/${task.id}/documents`
        );

        // 2.2 Task PDF folder
        const taskPdfFolder = WorkspaceFileService.buildFolderPath(
            workspace.id,
            "task",
            task.id,
            designDept.id,
            "pdf"
        );
        assert(
            "Deterministic task PDF folder matches specification",
            taskPdfFolder === `orbix/team-workspaces/${workspace.id}/departments/${designDept.id}/tasks/${task.id}/pdfs`
        );

        // 2.3 Task Image folder
        const taskImageFolder = WorkspaceFileService.buildFolderPath(
            workspace.id,
            "task",
            task.id,
            designDept.id,
            "image"
        );
        assert(
            "Deterministic task image folder matches specification",
            taskImageFolder === `orbix/team-workspaces/${workspace.id}/departments/${designDept.id}/tasks/${task.id}/images`
        );

        // 2.4 Channel attachment folder
        const channelAttachmentFolder = WorkspaceFileService.buildFolderPath(
            workspace.id,
            "channel",
            "c0000000-0000-0000-0000-000000000001",
            null,
            "image"
        );
        assert(
            "Deterministic channel attachment folder matches specification",
            channelAttachmentFolder === `orbix/team-workspaces/${workspace.id}/channels/c0000000-0000-0000-0000-000000000001/attachments`
        );

        // 2.5 Department resources folder
        const deptResourceFolder = WorkspaceFileService.buildFolderPath(
            workspace.id,
            "resource",
            null,
            designDept.id,
            "document"
        );
        assert(
            "Deterministic department resource folder matches specification",
            deptResourceFolder === `orbix/team-workspaces/${workspace.id}/departments/${designDept.id}/resources`
        );

        console.log("\n--- TEST GROUP 3: UPLOAD INTENT & SHORT-LIVED SIGNED AUTHORIZATION ---");

        // 3.1 Request upload intent for a PDF task attachment
        const uploadIntent = await WorkspaceFileService.createUploadIntent(
            workspace.id,
            leadUserId,
            {
                fileName: "brand_specs_v1.pdf",
                fileSizeBytes: 1024 * 500, // 500 KB
                mimeType: "application/pdf",
                departmentId: designDept.id,
                parentResourceType: "task",
                parentResourceId: task.id,
            }
        );

        assert("Upload intent successfully created with UUID", typeof uploadIntent.intentId === "string" && uploadIntent.intentId.length > 0);
        assert("Signed authorization contains server-generated publicId", uploadIntent.publicId.startsWith(`orbix/team-workspaces/${workspace.id}`));
        assert("Signed authorization has authenticated deliveryType", uploadIntent.deliveryType === "authenticated");
        assert("Signed authorization includes valid Cloudinary signature", typeof uploadIntent.signature === "string" && uploadIntent.signature.length > 10);
        assert("Authorization TTL is 15 minutes", new Date(uploadIntent.expiresAt).getTime() > Date.now());

        // 3.2 Unauthorized upload intent request (user not in department)
        let unauthorizedDeptIntentFailed = false;
        try {
            await WorkspaceFileService.createUploadIntent(
                workspace.id,
                memberUserId, // general member not in designDept
                {
                    fileName: "unauthorized_design_leak.pdf",
                    fileSizeBytes: 1024 * 100,
                    mimeType: "application/pdf",
                    departmentId: designDept.id,
                    parentResourceType: "task",
                    parentResourceId: task.id,
                }
            );
        } catch (err: any) {
            unauthorizedDeptIntentFailed = true;
            assert("Non-department member is denied upload intent for departmental task", err.message.includes("Forbidden"));
        }
        assert("Unauthorized upload intent was rejected", unauthorizedDeptIntentFailed);

        // 3.3 Register completed upload using the intent
        const registeredFile = await WorkspaceFileService.registerUpload(
            workspace.id,
            leadUserId,
            {
                intentId: uploadIntent.intentId,
                cloudinaryPublicId: uploadIntent.publicId,
                cloudinaryAssetId: "c_asset_001_" + runId,
                secureUrl: `https://res.cloudinary.com/bh1mhiwb/image/authenticated/s--dummy--/${uploadIntent.publicId}.pdf`,
                format: "pdf",
                fileSizeBytes: 1024 * 500,
                mimeType: "application/pdf",
                checksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            }
        );

        assert("File is successfully registered in workspace_files", typeof registeredFile.id === "string");
        assert("Registered file correctly references departmentId", registeredFile.departmentId === designDept.id);
        assert("Registered file correctly references taskId", registeredFile.taskId === task.id);
        assert("Registered file deliveryType is authenticated", registeredFile.deliveryType === "authenticated");
        assert("Registered file has SHA-256 checksum", typeof registeredFile.checksum === "string");

        // 3.4 Single-use upload intent enforcement (Replay attack prevention)
        let replayAttemptBlocked = false;
        try {
            await WorkspaceFileService.registerUpload(
                workspace.id,
                leadUserId,
                {
                    intentId: uploadIntent.intentId,
                    cloudinaryPublicId: uploadIntent.publicId,
                    secureUrl: `https://res.cloudinary.com/bh1mhiwb/image/authenticated/s--dummy--/${uploadIntent.publicId}.pdf`,
                    fileSizeBytes: 1024 * 500,
                    mimeType: "application/pdf",
                }
            );
        } catch (err: any) {
            replayAttemptBlocked = true;
            assert("Replay of previously registered intent is strictly rejected", err.message.includes("registered"));
        }
        assert("Single-use intent enforcement confirmed", replayAttemptBlocked);

        // 3.5 Intent theft prevention: Actor mismatch
        const anotherIntent = await WorkspaceFileService.createUploadIntent(
            workspace.id,
            ownerId,
            {
                fileName: "confidential_roadmap.pdf",
                fileSizeBytes: 1024 * 200,
                mimeType: "application/pdf",
                parentResourceType: "attachment",
            }
        );

        let actorMismatchBlocked = false;
        try {
            await WorkspaceFileService.registerUpload(
                workspace.id,
                memberUserId, // different user attempts to claim owner's intent
                {
                    intentId: anotherIntent.intentId,
                    cloudinaryPublicId: anotherIntent.publicId,
                    secureUrl: `https://res.cloudinary.com/bh1mhiwb/image/authenticated/s--dummy--/${anotherIntent.publicId}.pdf`,
                    fileSizeBytes: 1024 * 200,
                    mimeType: "application/pdf",
                }
            );
        } catch (err: any) {
            actorMismatchBlocked = true;
            assert("Registering an upload intent issued to another user is rejected", err.message.includes("Forbidden") || err.message.includes("mismatch"));
        }
        assert("Upload intent owner theft prevention confirmed", actorMismatchBlocked);

        console.log("\n--- TEST GROUP 4: RESTRICTED DELIVERY URLS & PDF THUMBNAILS ---");

        // 4.1 Authorized delivery URL generation
        const deliveryRes = await WorkspaceFileService.getAuthorizedDeliveryUrl(
            workspace.id,
            leadUserId,
            registeredFile.id
        );

        assert("Delivery URL generated for authorized lead", typeof deliveryRes.deliveryUrl === "string");
        assert("Delivery URL is authenticated Cloudinary URL", deliveryRes.deliveryUrl.includes("/authenticated/"));
        assert("First-class PDF generates page-1 JPEG thumbnail URL", typeof deliveryRes.thumbnailUrl === "string" && deliveryRes.thumbnailUrl.includes("pg_1"));

        // 4.2 Elevated workspace manager / owner can access departmental file
        const ownerDeliveryRes = await WorkspaceFileService.getAuthorizedDeliveryUrl(
            workspace.id,
            ownerId,
            registeredFile.id
        );
        assert("Workspace Owner can obtain authorized delivery URL for departmental file", typeof ownerDeliveryRes.deliveryUrl === "string");

        // 4.3 Unauthorized departmental access blocked
        let unauthorizedFileAccessBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(
                workspace.id,
                memberUserId, // member not in design dept
                registeredFile.id
            );
        } catch (err: any) {
            unauthorizedFileAccessBlocked = true;
            assert("Non-department member cannot obtain delivery URL for departmental file", err.message.includes("Forbidden"));
        }
        assert("Restricted departmental delivery URL enforcement confirmed", unauthorizedFileAccessBlocked);

        // 4.4 Cross-workspace tenant isolation
        let foreignUserBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(
                workspace.id,
                foreignUserId, // belongs to no workspace
                registeredFile.id
            );
        } catch (err: any) {
            foreignUserBlocked = true;
            assert("Foreign user with no workspace membership is blocked from generating delivery URL", err.message.includes("Unauthorized"));
        }
        assert("Tenant isolation verified: Foreign users cannot access assets", foreignUserBlocked);

        // 4.5 Immediate access revocation on member suspension
        await WorkspaceService.setMemberSuspension(workspace.id, leadUserId, ownerId, true, "Testing revocation");
        let suspendedAccessBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(
                workspace.id,
                leadUserId,
                registeredFile.id
            );
        } catch (err: any) {
            suspendedAccessBlocked = true;
            assert("Suspended member is immediately blocked from generating delivery URLs", err.message.includes("Unauthorized"));
        }
        assert("Suspension revocation check confirmed", suspendedAccessBlocked);

        // Unsuspend lead for subsequent tests
        await WorkspaceService.setMemberSuspension(workspace.id, leadUserId, ownerId, false);

        console.log("\n--- TEST GROUP 5: STORAGE QUOTA & ASSET DELETION LIFECYCLE ---");

        // 5.1 Storage usage computation
        const storageUsage = await WorkspaceFileService.getWorkspaceStorageUsage(workspace.id, ownerId);
        assert("Storage usage calculates total active bytes accurately", storageUsage.usedBytes >= 1024 * 500);
        assert("Storage quota reflects 10GB workspace limit", storageUsage.quotaBytes === 10 * 1024 * 1024 * 1024);
        assert("Storage usage tracks fileCount", storageUsage.fileCount >= 1);

        // 5.2 Task activity log verifies attachment added
        const activities = await WorkspaceTaskService.getActivity(workspace.id, ownerId, task.id);
        const hasAttachmentActivity = activities.some((a) => a.action === "attachment_added");
        assert("Task activity automatically recorded attachment_added event", hasAttachmentActivity === true);

        // 5.3 Unauthorized deletion blocked
        let unauthorizedDeleteBlocked = false;
        try {
            await WorkspaceFileService.deleteFile(workspace.id, memberUserId, registeredFile.id);
        } catch (err: any) {
            unauthorizedDeleteBlocked = true;
            assert("Unauthorized member cannot delete another member's file", err.message.includes("Forbidden"));
        }
        assert("Unauthorized deletion blocked successfully", unauthorizedDeleteBlocked);

        // 5.4 Authorized deletion by uploader / lead
        const deleteSuccess = await WorkspaceFileService.deleteFile(workspace.id, leadUserId, registeredFile.id);
        assert("File is safely deleted by authorized uploader", deleteSuccess === true);

        // 5.5 Deleted file cannot generate delivery URL
        let deletedDeliveryBlocked = false;
        try {
            await WorkspaceFileService.getAuthorizedDeliveryUrl(workspace.id, ownerId, registeredFile.id);
        } catch (err: any) {
            deletedDeliveryBlocked = true;
            assert("Deleted file generates error on delivery URL request", err.message.includes("deleted"));
        }
        assert("Deleted file access denied confirmed", deletedDeliveryBlocked);

        // 5.6 Storage usage decreases after deletion
        const updatedStorage = await WorkspaceFileService.getWorkspaceStorageUsage(workspace.id, ownerId);
        assert("Storage usage decreased after asset deletion", updatedStorage.usedBytes < storageUsage.usedBytes);

        console.log("\n================================================================================");
        console.log(`PHASE 06 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
        console.log("================================================================================");

        if (testsFailed > 0) {
            process.exit(1);
        }
    } catch (err: any) {
        console.error("❌ Fatal error executing Phase 06 test suite:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runPhase06Tests();
