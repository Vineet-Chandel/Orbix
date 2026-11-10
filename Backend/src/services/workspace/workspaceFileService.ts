// Backend/src/services/workspace/workspaceFileService.ts
import crypto from "crypto";
import { Readable } from "stream";
import { pool, query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceTaskService } from "./workspaceTaskService.js";
import { WorkspaceChannelService } from "./workspaceChannelService.js";
import { cloudinary, assertCloudinaryConfigured, destroyCloudinaryAsset } from "../../config/cloudinary.js";
import {
    validateFileMetadata,
    validateBufferMagicBytes,
    computeSha256,
    DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES,
    type AssetCategory,
} from "./workspaceFileValidator.js";
import type {
    WorkspaceFile,
    WorkspaceFileUploadIntent,
    CreateUploadIntentRequest,
    UploadIntentResponse,
    RegisterUploadRequest,
    FileDeliveryUrlResponse,
    WorkspaceStorageQuotaInfo,
    WorkspaceFileListFilters,
    WorkspaceContext,
    WorkspaceFileParentResourceType,
} from "../../types/workspaceTypes.js";

export class WorkspaceFileService {
    // =========================================================================
    // 1. DETERMINISTIC PATH & FOLDER BUILDER
    // =========================================================================

    /**
     * Builds the deterministic Cloudinary folder path according to strict architectural guidelines.
     */
    static buildFolderPath(
        workspaceId: string,
        parentResourceType: WorkspaceFileParentResourceType,
        parentResourceId?: string | null,
        departmentId?: string | null,
        category: AssetCategory = "document"
    ): string {
        const root = `orbix/team-workspaces/${workspaceId}`;

        if (parentResourceType === "task" || parentResourceType === "task_submission" || parentResourceType === "task_comment") {
            const taskId = parentResourceId || "general";
            let subfolder = "documents";
            if (category === "image") subfolder = "images";
            else if (category === "video") subfolder = "videos";
            else if (category === "pdf") subfolder = "pdfs";

            if (departmentId) {
                return `${root}/departments/${departmentId}/tasks/${taskId}/${subfolder}`;
            }
            return `${root}/tasks/${taskId}/${subfolder}`;
        }

        if (parentResourceType === "resource") {
            if (departmentId) {
                return `${root}/departments/${departmentId}/resources`;
            }
            return `${root}/resources`;
        }

        if (parentResourceType === "channel") {
            const channelId = parentResourceId || "general";
            return `${root}/channels/${channelId}/attachments`;
        }

        if (parentResourceType === "message") {
            const messageId = parentResourceId || "general";
            return `${root}/messages/${messageId}/attachments`;
        }

        if (departmentId) {
            return `${root}/departments/${departmentId}/attachments`;
        }

        return `${root}/general/attachments`;
    }

    /**
     * Verifies that the caller has permission to view/interact with the parent resource.
     */
    static async verifyResourceAccess(
        context: WorkspaceContext,
        parentResourceType: WorkspaceFileParentResourceType,
        parentResourceId?: string | null,
        departmentId?: string | null
    ): Promise<void> {
        // Workspace Owner, Admin, or Workspace Manager has unrestricted access
        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return;
        }

        // If department specified, caller must belong to it or lead it
        if (departmentId) {
            const isDeptMember =
                context.member.departmentId === departmentId ||
                context.leadDepartmentIds.includes(departmentId);
            if (!isDeptMember) {
                throw new Error("Forbidden: You do not have access to this department's files.");
            }
        }

        // If task resource, check task view permission
        if (parentResourceType === "task" && parentResourceId) {
            const task = await WorkspaceRepository.findTaskById(context.member.workspaceId, parentResourceId);
            if (!task) {
                throw new Error("Task not found.");
            }
            if (!WorkspaceTaskService.canViewTask(context, task)) {
                throw new Error("Forbidden: You do not have permission to view or attach to this task.");
            }
        }

        // If channel resource, check channel membership
        if (parentResourceType === "channel" && parentResourceId) {
            const canView = await WorkspaceChannelService.canViewChannel(
                context.member.workspaceId,
                parentResourceId,
                context.member.userId
            );
            if (!canView) {
                throw new Error("Forbidden: You do not have access to this channel.");
            }
        }
    }

    // =========================================================================
    // 2. UPLOAD INTENT LIFECYCLE (SHORT-LIVED SIGNED AUTHORIZATION)
    // =========================================================================

    /**
     * Creates a short-lived signed upload intent for client-side direct uploads.
     */
    static async createUploadIntent(
        workspaceId: string,
        actorUserId: string,
        req: CreateUploadIntentRequest
    ): Promise<UploadIntentResponse> {
        const config = assertCloudinaryConfigured();
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        // 1. Verify resource access
        await this.verifyResourceAccess(
            context,
            req.parentResourceType,
            req.parentResourceId,
            req.departmentId
        );

        // 2. Validate metadata
        const meta = validateFileMetadata(req.fileName, req.mimeType, req.fileSizeBytes);
        if (!meta.isValid) {
            throw new Error(meta.error || "Invalid file metadata.");
        }

        // 3. Check workspace storage quota
        const storageUsage = await WorkspaceRepository.getWorkspaceStorageUsage(workspaceId);
        if (storageUsage.usedBytes + req.fileSizeBytes > storageUsage.quotaBytes) {
            throw new Error("Workspace storage quota exceeded (10GB maximum). Please delete older files to free space.");
        }

        // 4. Build deterministic folder path & public ID
        const folder = this.buildFolderPath(
            workspaceId,
            req.parentResourceType,
            req.parentResourceId,
            req.departmentId,
            meta.category
        );

        const safeFilename = req.fileName
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .replace(/_{2,}/g, "_")
            .slice(0, 40);
        const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const assetIdentifier = `${safeFilename}_${uniqueSuffix}`;
        const publicId = `${folder}/${assetIdentifier}`;

        // 5. Short-lived signed authorization (15 minutes TTL)
        const timestamp = Math.floor(Date.now() / 1000);
        const expiresAtSec = timestamp + 900; // 15 mins
        const expiresAtIso = new Date(expiresAtSec * 1000).toISOString();

        const paramsToSign: Record<string, any> = {
            folder,
            public_id: publicId,
            timestamp,
            type: "authenticated",
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, config.apiSecret);
        const resourceType = meta.resourceType || "auto";
        const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`;

        // 6. Record intent in PostgreSQL
        const intent = await WorkspaceRepository.createUploadIntent({
            workspaceId,
            userId: actorUserId,
            departmentId: req.departmentId || null,
            parentResourceType: req.parentResourceType,
            parentResourceId: req.parentResourceId || null,
            publicId,
            folder,
            originalFilename: req.fileName,
            expectedMimeType: meta.normalizedMimeType || req.mimeType,
            expectedSizeBytes: req.fileSizeBytes,
            deliveryType: "authenticated",
            resourceType,
            expiresAt: expiresAtIso,
        });

        return {
            intentId: intent.id,
            publicId,
            folder,
            cloudName: config.cloudName,
            apiKey: config.apiKey,
            timestamp,
            signature,
            deliveryType: "authenticated",
            resourceType,
            uploadUrl,
            expiresAt: expiresAtIso,
            maxBytes: req.fileSizeBytes,
        };
    }

    /**
     * Registers a verified Cloudinary upload in PostgreSQL and attaches it to the parent resource.
     */
    static async registerUpload(
        workspaceId: string,
        actorUserId: string,
        req: RegisterUploadRequest
    ): Promise<WorkspaceFile> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        const intent = await WorkspaceRepository.findUploadIntentById(req.intentId);
        if (!intent) {
            throw new Error("Upload intent not found.");
        }

        if (intent.workspaceId !== workspaceId) {
            throw new Error("Upload intent workspace mismatch.");
        }

        if (intent.userId !== actorUserId) {
            throw new Error("Forbidden: You cannot register an upload intent issued to another member.");
        }

        if (intent.status !== "pending") {
            throw new Error(`Upload intent is already ${intent.status}. Each intent is single-use only.`);
        }

        if (new Date(intent.expiresAt) < new Date()) {
            throw new Error("Upload intent has expired. Please request a new upload authorization.");
        }

        if (req.cloudinaryPublicId !== intent.publicId) {
            throw new Error("Public ID mismatch: Client submitted an unauthorized Cloudinary identifier.");
        }

        // Atomic transaction: mark intent registered & create workspace_files row
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            await WorkspaceRepository.markUploadIntentRegistered(intent.id, client);

            const file = await WorkspaceRepository.createWorkspaceFile(
                {
                    workspaceId,
                    uploaderId: actorUserId,
                    departmentId: intent.departmentId,
                    channelId: intent.parentResourceType === "channel" ? intent.parentResourceId : null,
                    taskId: intent.parentResourceType === "task" ? intent.parentResourceId : null,
                    submissionId: intent.parentResourceType === "task_submission" ? intent.parentResourceId : null,
                    fileName: intent.originalFilename,
                    fileSizeBytes: req.fileSizeBytes || intent.expectedSizeBytes,
                    mimeType: req.mimeType || intent.expectedMimeType,
                    cloudinaryPublicId: req.cloudinaryPublicId,
                    cloudinaryAssetId: req.cloudinaryAssetId || null,
                    cloudinaryUrl: req.url || req.secureUrl,
                    cloudinarySecureUrl: req.secureUrl,
                    resourceType: intent.resourceType,
                    deliveryType: intent.deliveryType,
                    format: req.format || intent.originalFilename.split(".").pop()?.toLowerCase() || null,
                    checksum: req.checksum || null,
                    purpose: "attachment",
                    parentResourceType: intent.parentResourceType,
                    parentResourceId: intent.parentResourceId,
                },
                client
            );

            // If attached to a task, record task activity
            if (intent.parentResourceType === "task" && intent.parentResourceId) {
                await client.query(
                    `INSERT INTO public.workspace_task_activity (
                        workspace_id,
                        task_id,
                        actor_id,
                        action,
                        details
                    ) VALUES ($1, $2, $3, 'attachment_added', $4::jsonb);`,
                    [
                        workspaceId,
                        intent.parentResourceId,
                        actorUserId,
                        JSON.stringify({ fileId: file.id, fileName: file.fileName }),
                    ]
                );
            }

            // Record Workspace Audit Log
            await WorkspaceRepository.logAudit(client, {
                workspaceId,
                actorId: actorUserId,
                action: "file_uploaded",
                targetType: "workspace_file",
                targetId: file.id,
                details: {
                    fileName: file.fileName,
                    fileSizeBytes: file.fileSizeBytes,
                    parentResourceType: file.parentResourceType,
                    parentResourceId: file.parentResourceId,
                },
                ipAddress: "127.0.0.1",
                userAgent: "Orbix API",
            });

            await client.query("COMMIT;");

            // Attach delivery URLs to returned file
            return this.enrichFileWithDeliveryUrls(file);
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 3. SERVER-SIDE DIRECT STREAM UPLOAD (WITH MAGIC-BYTE VALIDATION)
    // =========================================================================

    /**
     * Direct buffer upload with full magic-byte and XSS inspection on the server.
     */
    static async directUpload(
        workspaceId: string,
        actorUserId: string,
        fileBuffer: Buffer,
        metadata: {
            originalFilename: string;
            mimeType: string;
            departmentId?: string | null;
            parentResourceType: WorkspaceFileParentResourceType;
            parentResourceId?: string | null;
        }
    ): Promise<WorkspaceFile> {
        assertCloudinaryConfigured();
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        // 1. Verify access to target resource
        await this.verifyResourceAccess(
            context,
            metadata.parentResourceType,
            metadata.parentResourceId,
            metadata.departmentId
        );

        // 2. Validate magic numbers & stored XSS prevention
        const validation = validateBufferMagicBytes(
            fileBuffer,
            metadata.originalFilename,
            metadata.mimeType
        );
        if (!validation.isValid) {
            throw new Error(validation.error || "File failed security validation.");
        }

        // 3. Storage quota check
        const quota = await WorkspaceRepository.getWorkspaceStorageUsage(workspaceId);
        if (quota.usedBytes + fileBuffer.length > quota.quotaBytes) {
            throw new Error("Workspace storage quota exceeded (10GB limit).");
        }

        // 4. Compute SHA-256 Checksum
        const checksum = computeSha256(fileBuffer);

        // 5. Deterministic folder & public ID
        const folder = this.buildFolderPath(
            workspaceId,
            metadata.parentResourceType,
            metadata.parentResourceId,
            metadata.departmentId,
            validation.category
        );

        const safeFilename = metadata.originalFilename
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .replace(/_{2,}/g, "_")
            .slice(0, 40);
        const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const assetIdentifier = `${safeFilename}_${uniqueSuffix}`;
        const publicId = `${folder}/${assetIdentifier}`;

        // 6. Upload stream directly to Cloudinary
        const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    public_id: publicId,
                    resource_type: validation.resourceType || "auto",
                    type: "authenticated",
                    use_filename: false,
                    unique_filename: false,
                    overwrite: true,
                },
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );

            const readable = new Readable();
            readable.push(fileBuffer);
            readable.push(null);
            readable.pipe(uploadStream);
        });

        // 7. Register in database
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const file = await WorkspaceRepository.createWorkspaceFile(
                {
                    workspaceId,
                    uploaderId: actorUserId,
                    departmentId: metadata.departmentId || null,
                    channelId: (metadata.parentResourceType === "channel" ? metadata.parentResourceId : null) || null,
                    taskId: (metadata.parentResourceType === "task" ? metadata.parentResourceId : null) || null,
                    submissionId: (metadata.parentResourceType === "task_submission" ? metadata.parentResourceId : null) || null,
                    fileName: metadata.originalFilename,
                    fileSizeBytes: fileBuffer.length,
                    mimeType: validation.normalizedMimeType || metadata.mimeType,
                    cloudinaryPublicId: uploadResult.public_id,
                    cloudinaryAssetId: uploadResult.asset_id || null,
                    cloudinaryUrl: uploadResult.url,
                    cloudinarySecureUrl: uploadResult.secure_url,
                    resourceType: uploadResult.resource_type || validation.resourceType || "auto",
                    deliveryType: "authenticated",
                    format: uploadResult.format || validation.normalizedExtension || null,
                    checksum,
                    purpose: "attachment",
                    parentResourceType: metadata.parentResourceType,
                    parentResourceId: metadata.parentResourceId || null,
                },
                client
            );

            if (metadata.parentResourceType === "task" && metadata.parentResourceId) {
                await client.query(
                    `INSERT INTO public.workspace_task_activity (
                        workspace_id,
                        task_id,
                        actor_id,
                        action,
                        details
                    ) VALUES ($1, $2, $3, 'attachment_added', $4::jsonb);`,
                    [
                        workspaceId,
                        metadata.parentResourceId,
                        actorUserId,
                        JSON.stringify({ fileId: file.id, fileName: file.fileName }),
                    ]
                );
            }

            await client.query("COMMIT;");
            return this.enrichFileWithDeliveryUrls(file);
        } catch (err) {
            await client.query("ROLLBACK;");
            await destroyCloudinaryAsset(uploadResult.public_id, uploadResult.resource_type);
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 4. RESTRICTED ASSET DELIVERY (SHORT-LIVED SIGNED ACCESS)
    // =========================================================================

    /**
     * Authorizes the caller and generates a short-lived signed delivery URL.
     */
    static async getAuthorizedDeliveryUrl(
        workspaceId: string,
        actorUserId: string,
        fileId: string,
        options: { thumbnail?: boolean; page?: number; download?: boolean } = {}
    ): Promise<FileDeliveryUrlResponse> {
        assertCloudinaryConfigured();
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        const file = await WorkspaceRepository.findFileById(workspaceId, fileId);
        if (!file) {
            throw new Error("File not found in this workspace.");
        }

        if (file.deletedAt || file.assetStatus !== "active") {
            throw new Error("File has been deleted or archived.");
        }

        // Verify resource privacy access
        await this.verifyResourceAccess(
            context,
            file.parentResourceType,
            file.parentResourceId,
            file.departmentId
        );

        // Generate short-lived signed URL (15 minutes TTL)
        const timestamp = Math.floor(Date.now() / 1000);
        const expiresAtSec = timestamp + 900;
        const expiresAtIso = new Date(expiresAtSec * 1000).toISOString();

        let deliveryUrl: string;
        let thumbnailUrl: string | null = null;

        const isPdf = file.mimeType === "application/pdf" || file.format === "pdf";

        if (file.resourceType === "image" && !isPdf) {
            deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: "image",
                expires_at: expiresAtSec,
                secure: true,
            });
            thumbnailUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: "image",
                width: 320,
                height: 240,
                crop: "fill",
                expires_at: expiresAtSec,
                secure: true,
            });
        } else if (file.resourceType === "video") {
            deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: "video",
                expires_at: expiresAtSec,
                secure: true,
            });
            thumbnailUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: "video",
                format: "jpg",
                width: 320,
                crop: "limit",
                expires_at: expiresAtSec,
                secure: true,
            });
        } else if (isPdf) {
            // First-class PDF support: Page 1 image transformation thumbnail
            thumbnailUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: "image",
                format: "jpg",
                page: options.page || 1,
                width: 400,
                crop: "limit",
                expires_at: expiresAtSec,
                secure: true,
            });

            // Delivery URL for full preview/download
            deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                sign_url: true,
                type: file.deliveryType,
                resource_type: file.resourceType as any,
                format: "pdf",
                expires_at: expiresAtSec,
                secure: true,
                flags: options.download ? "attachment" : undefined,
            });
        } else {
            // Raw documents (docx, xlsx, zip, etc.)
            const rawOptions: any = {
                resource_type: file.resourceType,
                type: file.deliveryType,
                expires_at: expiresAtSec,
            };
            if (options.download) {
                rawOptions.attachment = true;
            }
            deliveryUrl = cloudinary.utils.private_download_url(
                file.cloudinaryPublicId,
                file.format || "raw",
                rawOptions
            );
        }

        return {
            fileId: file.id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            deliveryUrl,
            thumbnailUrl,
            expiresAt: expiresAtIso,
        };
    }

    /**
     * Enriches a WorkspaceFile instance with ephemeral signed delivery URLs.
     */
    static enrichFileWithDeliveryUrls(file: WorkspaceFile): WorkspaceFile {
        try {
            assertCloudinaryConfigured();
            const timestamp = Math.floor(Date.now() / 1000);
            const expiresAtSec = timestamp + 900;
            const isPdf = file.mimeType === "application/pdf" || file.format === "pdf";

            if (file.resourceType === "image" && !isPdf) {
                file.deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                    sign_url: true,
                    type: file.deliveryType,
                    resource_type: "image",
                    expires_at: expiresAtSec,
                    secure: true,
                });
                file.thumbnailUrl = cloudinary.url(file.cloudinaryPublicId, {
                    sign_url: true,
                    type: file.deliveryType,
                    resource_type: "image",
                    width: 320,
                    crop: "fill",
                    expires_at: expiresAtSec,
                    secure: true,
                });
            } else if (file.resourceType === "video") {
                file.deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                    sign_url: true,
                    type: file.deliveryType,
                    resource_type: "video",
                    expires_at: expiresAtSec,
                    secure: true,
                });
            } else if (isPdf) {
                file.thumbnailUrl = cloudinary.url(file.cloudinaryPublicId, {
                    sign_url: true,
                    type: file.deliveryType,
                    resource_type: "image",
                    format: "jpg",
                    page: 1,
                    width: 320,
                    crop: "limit",
                    expires_at: expiresAtSec,
                    secure: true,
                });
                file.deliveryUrl = cloudinary.url(file.cloudinaryPublicId, {
                    sign_url: true,
                    type: file.deliveryType,
                    resource_type: file.resourceType as any,
                    format: "pdf",
                    expires_at: expiresAtSec,
                    secure: true,
                });
            } else {
                file.deliveryUrl = cloudinary.utils.private_download_url(
                    file.cloudinaryPublicId,
                    file.format || "raw",
                    {
                        resource_type: file.resourceType as any,
                        type: file.deliveryType,
                        expires_at: expiresAtSec,
                    }
                );
            }
        } catch {
            // Ignore error if credentials not yet loaded during bootstrap
        }
        return file;
    }

    // =========================================================================
    // 5. ASSET DELETION & CLEANUP LIFECYCLE
    // =========================================================================

    /**
     * Safely deletes an asset from Cloudinary and marks the database record deleted.
     */
    static async deleteFile(
        workspaceId: string,
        actorUserId: string,
        fileId: string
    ): Promise<boolean> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        const file = await WorkspaceRepository.findFileById(workspaceId, fileId);
        if (!file) {
            throw new Error("File not found.");
        }

        // Deletion Authorization Guard:
        // Caller must be uploader OR workspace manager OR admin/owner OR lead of file's department
        const isUploader = file.uploaderId === actorUserId;
        const isWorkspaceLead = context.isOwner || context.isAdmin || context.isWorkspaceManager;
        const isDeptLead = file.departmentId ? context.leadDepartmentIds.includes(file.departmentId) : false;
        const hasManagePerm = context.permissions.includes("tasks:delete") || context.permissions.includes("workspace:manage");

        if (!isUploader && !isWorkspaceLead && !isDeptLead && !hasManagePerm) {
            throw new Error("Forbidden: You do not have permission to delete this file.");
        }

        // 1. Destroy asset on Cloudinary
        await destroyCloudinaryAsset(file.cloudinaryPublicId, file.resourceType as any);

        // 2. Soft delete database record
        const success = await WorkspaceRepository.softDeleteWorkspaceFile(workspaceId, fileId, actorUserId);

        // 3. Log task activity if applicable
        if (file.taskId) {
            await query(
                `INSERT INTO public.workspace_task_activity (
                    workspace_id,
                    task_id,
                    actor_id,
                    action,
                    details
                ) VALUES ($1, $2, $3, 'attachment_removed', $4::jsonb);`,
                [workspaceId, file.taskId, actorUserId, JSON.stringify({ fileId: file.id, fileName: file.fileName })]
            );
        }

        // 4. Audit log
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "file_deleted",
            targetType: "workspace_file",
            targetId: fileId,
            details: { fileName: file.fileName },
            ipAddress: "127.0.0.1",
            userAgent: "Orbix API",
        });

        return success;
    }

    // =========================================================================
    // 6. LISTING & STORAGE QUOTA
    // =========================================================================

    /**
     * Lists workspace files with caller privacy filters and signed delivery URLs.
     */
    static async listFiles(
        workspaceId: string,
        actorUserId: string,
        filters: WorkspaceFileListFilters = {}
    ): Promise<{ files: WorkspaceFile[]; total: number }> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        // Privacy filter: if caller is not an elevated manager, ensure they cannot query files
        // belonging to departments they do not belong to
        if (!context.isOwner && !context.isAdmin && !context.isWorkspaceManager) {
            if (filters.departmentId) {
                const canAccessDept =
                    context.member.departmentId === filters.departmentId ||
                    context.leadDepartmentIds.includes(filters.departmentId);
                if (!canAccessDept) {
                    return { files: [], total: 0 };
                }
            }
        }

        const result = await WorkspaceRepository.listWorkspaceFiles(workspaceId, filters);
        const enrichedFiles = result.files.map((f) => this.enrichFileWithDeliveryUrls(f));

        return {
            files: enrichedFiles,
            total: result.total,
        };
    }

    /**
     * Gets storage quota and utilization details.
     */
    static async getWorkspaceStorageUsage(
        workspaceId: string,
        actorUserId: string
    ): Promise<WorkspaceStorageQuotaInfo> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context) {
            throw new Error("Unauthorized: Active workspace membership required.");
        }

        return await WorkspaceRepository.getWorkspaceStorageUsage(
            workspaceId,
            DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES
        );
    }
}
