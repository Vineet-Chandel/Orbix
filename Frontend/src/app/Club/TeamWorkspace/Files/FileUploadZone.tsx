// Frontend/src/app/Club/TeamWorkspace/Files/FileUploadZone.tsx
import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, X, RefreshCw, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import workspaceApi from "../../../../api/workspaceApi";
import type { WorkspaceFile, WorkspaceFileParentResourceType } from "../../../../types/workspace";

interface FileUploadZoneProps {
    clubId?: string;
    parentResourceType: WorkspaceFileParentResourceType;
    parentResourceId?: string | null;
    departmentId?: string | null;
    onFileUploaded: (file: WorkspaceFile) => void;
    maxFiles?: number;
    disabled?: boolean;
    className?: string;
    compact?: boolean;
}

interface UploadingFileState {
    id: string;
    file: File;
    progress: number;
    status: "pending" | "uploading" | "registering" | "completed" | "error";
    error?: string;
    xhr?: XMLHttpRequest;
}

export const BLOCKED_EXTENSIONS = [
    "svg", "svgz", "html", "htm", "xhtml", "xml", "js", "mjs", "cjs", "ts",
    "jsx", "tsx", "php", "py", "sh", "bash", "exe", "bat", "cmd", "ps1"
];

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
    clubId,
    parentResourceType,
    parentResourceId,
    departmentId,
    onFileUploaded,
    maxFiles = 10,
    disabled = false,
    className = "",
    compact = false,
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<UploadingFileState[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        const parts = file.name.split(".");
        const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";

        if (BLOCKED_EXTENSIONS.includes(ext)) {
            return `Files of type .${ext} are strictly prohibited for security reasons.`;
        }

        if (file.type.includes("svg") || file.type.includes("html")) {
            return "HTML and SVG files are not permitted.";
        }

        // Limit checks: 100MB for video, 25MB for docs, 10MB for images
        if (file.type.startsWith("video/") && file.size > 100 * 1024 * 1024) {
            return "Videos cannot exceed 100MB.";
        }
        if (file.type === "application/pdf" && file.size > 25 * 1024 * 1024) {
            return "PDF documents cannot exceed 25MB.";
        }
        if (file.type.startsWith("image/") && file.size > 10 * 1024 * 1024) {
            return "Images cannot exceed 10MB.";
        }
        if (file.size > 100 * 1024 * 1024) {
            return "Files cannot exceed 100MB.";
        }

        return null;
    };

    const processUpload = async (uploadItem: UploadingFileState) => {
        const { file, id } = uploadItem;

        try {
            // Update status: getting intent
            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, status: "uploading", progress: 5 } : item
                )
            );

            // 1. Request Upload Intent
            const intentRes = await workspaceApi.getUploadIntent(
                {
                    fileName: file.name,
                    fileSizeBytes: file.size,
                    mimeType: file.type || "application/octet-stream",
                    departmentId: departmentId || null,
                    parentResourceType,
                    parentResourceId: parentResourceId || null,
                },
                clubId
            );

            const intent = intentRes.intent;

            // 2. Direct Upload to Cloudinary with XHR for Progress Tracking
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", intent.apiKey);
            formData.append("timestamp", String(intent.timestamp));
            formData.append("signature", intent.signature);
            formData.append("folder", intent.folder);
            formData.append("public_id", intent.publicId);
            formData.append("type", intent.deliveryType);

            const xhr = new XMLHttpRequest();

            setUploadQueue((prev) =>
                prev.map((item) => (item.id === id ? { ...item, xhr } : item))
            );

            const uploadPromise = new Promise<any>((resolve, reject) => {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.min(Math.round((e.loaded / e.total) * 85) + 5, 90);
                        setUploadQueue((prev) =>
                            prev.map((item) =>
                                item.id === id ? { ...item, progress: percent } : item
                            )
                        );
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const resJson = JSON.parse(xhr.responseText);
                            resolve(resJson);
                        } catch {
                            reject(new Error("Failed to parse Cloudinary response"));
                        }
                    } else {
                        // Fallback: try direct upload through Orbix backend stream if CORS fails
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
                xhr.onabort = () => reject(new Error("Upload cancelled"));

                xhr.open("POST", intent.uploadUrl);
                xhr.send(formData);
            });

            let cloudinaryResult: any;
            try {
                cloudinaryResult = await uploadPromise;
            } catch (err: any) {
                if (err.message === "Upload cancelled") return;
                // Fallback to Backend Direct Upload Stream
                const fallbackForm = new FormData();
                fallbackForm.append("file", file);
                if (departmentId) fallbackForm.append("departmentId", departmentId);
                fallbackForm.append("parentResourceType", parentResourceType);
                if (parentResourceId) fallbackForm.append("parentResourceId", parentResourceId);

                const streamRes = await workspaceApi.directUploadFile(fallbackForm, clubId);
                const fileRecord = streamRes.file;

                setUploadQueue((prev) =>
                    prev.map((item) =>
                        item.id === id ? { ...item, status: "completed", progress: 100 } : item
                    )
                );
                onFileUploaded(fileRecord);
                setTimeout(() => {
                    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
                }, 2000);
                return;
            }

            // 3. Register Upload in PostgreSQL
            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, status: "registering", progress: 95 } : item
                )
            );

            const regRes = await workspaceApi.registerUpload(
                {
                    intentId: intent.intentId,
                    cloudinaryPublicId: cloudinaryResult.public_id || intent.publicId,
                    cloudinaryAssetId: cloudinaryResult.asset_id,
                    secureUrl: cloudinaryResult.secure_url,
                    url: cloudinaryResult.url,
                    format: cloudinaryResult.format,
                    fileSizeBytes: cloudinaryResult.bytes || file.size,
                    mimeType: file.type || "application/octet-stream",
                },
                clubId
            );

            const fileRecord = regRes.file;

            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, status: "completed", progress: 100 } : item
                )
            );

            onFileUploaded(fileRecord);

            // Clean completed item after delay
            setTimeout(() => {
                setUploadQueue((prev) => prev.filter((item) => item.id !== id));
            }, 2000);
        } catch (err: any) {
            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? { ...item, status: "error", error: err.message || "Upload failed." }
                        : item
                )
            );
        }
    };

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            if (disabled) return;
            const fileArray = Array.from(files).slice(0, maxFiles);

            const newItems: UploadingFileState[] = [];

            for (const f of fileArray) {
                const validationError = validateFile(f);
                const item: UploadingFileState = {
                    id: Math.random().toString(36).substring(2, 9),
                    file: f,
                    progress: 0,
                    status: validationError ? "error" : "pending",
                    error: validationError || undefined,
                };
                newItems.push(item);
            }

            setUploadQueue((prev) => [...prev, ...newItems]);

            // Start processing valid items
            for (const item of newItems) {
                if (item.status === "pending") {
                    processUpload(item);
                }
            }
        },
        [disabled, maxFiles, departmentId, parentResourceType, parentResourceId, clubId]
    );

    const handleCancel = (id: string) => {
        setUploadQueue((prev) => {
            const item = prev.find((i) => i.id === id);
            if (item && item.xhr) {
                item.xhr.abort();
            }
            return prev.filter((i) => i.id !== id);
        });
    };

    const handleRetry = (item: UploadingFileState) => {
        setUploadQueue((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "pending", error: undefined, progress: 0 } : i))
        );
        processUpload({ ...item, status: "pending", error: undefined, progress: 0 });
    };

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Dropzone container */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
                }}
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center text-center select-none ${
                    isDragOver
                        ? "border-purple-500 bg-purple-500/10 scale-[1.01]"
                        : "border-border/60 hover:border-purple-500/50 hover:bg-muted/30 bg-muted/10"
                } ${compact ? "p-4" : "p-6"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                        if (e.target.files) handleFiles(e.target.files);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                />

                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
                    <UploadCloud className="w-5 h-5" />
                </div>

                <div className="text-sm font-medium text-foreground">
                    <span className="text-purple-400 hover:underline">Click to upload</span> or drag and drop
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Images (10MB), Videos (100MB), PDFs and Documents (25MB)
                </p>
            </div>

            {/* Upload progress queue */}
            {uploadQueue.length > 0 && (
                <div className="space-y-2">
                    {uploadQueue.map((item) => (
                        <div
                            key={item.id}
                            className="p-3 bg-muted/30 border border-border/50 rounded-lg flex items-center gap-3 text-sm"
                        >
                            <div className="w-8 h-8 rounded bg-background flex items-center justify-center shrink-0 text-muted-foreground">
                                <FileText className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-medium truncate text-foreground">{item.file.name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {formatBytes(item.file.size)}
                                    </span>
                                </div>

                                {item.status === "error" ? (
                                    <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{item.error}</span>
                                    </div>
                                ) : item.status === "completed" ? (
                                    <div className="flex items-center gap-1.5 text-xs text-green-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Uploaded and verified</span>
                                    </div>
                                ) : (
                                    <div className="w-full bg-background/80 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-purple-500 h-full transition-all duration-300"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {item.status === "error" && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRetry(item);
                                        }}
                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                        title="Retry upload"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancel(item.id);
                                    }}
                                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                    title="Cancel"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileUploadZone;
