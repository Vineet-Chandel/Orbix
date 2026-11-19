// Frontend/src/app/Club/TeamWorkspace/Files/AttachmentList.tsx
import React, { useState } from "react";
import {
    FileText,
    Image as ImageIcon,
    Video,
    FileSpreadsheet,
    FileArchive,
    File,
    Download,
    Trash2,
    Eye,
    Loader2,
} from "lucide-react";
import workspaceApi from "../../../../api/workspaceApi";
import type { WorkspaceFile } from "../../../../types/workspace";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { useToast } from "../../../../context/ToastContext";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface AttachmentListProps {
    files: WorkspaceFile[];
    clubId?: string;
    canDelete?: boolean;
    onFileDeleted?: (fileId: string) => void;
    compact?: boolean;
    className?: string;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
    files,
    clubId,
    canDelete = false,
    onFileDeleted,
    compact = false,
    className = "",
}) => {
    const toast = useToast();
    const [selectedPdf, setSelectedPdf] = useState<WorkspaceFile | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<WorkspaceFile | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    if (!files || files.length === 0) {
        return null;
    }

    const formatBytes = (bytes: number): string => {
        if (!bytes) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const getFileIcon = (file: WorkspaceFile) => {
        const mime = file.mimeType?.toLowerCase() || "";
        const ext = file.fileName?.split(".").pop()?.toLowerCase() || "";

        if (mime === "application/pdf" || ext === "pdf") {
            return <FileText className="w-5 h-5 text-red-400" />;
        }
        if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
            return <ImageIcon className="w-5 h-5 text-purple-400" />;
        }
        if (mime.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) {
            return <Video className="w-5 h-5 text-blue-400" />;
        }
        if (["xls", "xlsx", "csv"].includes(ext) || mime.includes("excel") || mime.includes("spreadsheet")) {
            return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
        }
        if (["zip", "tar", "gz", "rar"].includes(ext) || mime.includes("zip")) {
            return <FileArchive className="w-5 h-5 text-amber-400" />;
        }
        return <File className="w-5 h-5 text-muted-foreground" />;
    };

    const handlePreview = (file: WorkspaceFile) => {
        const mime = file.mimeType?.toLowerCase() || "";
        const ext = file.fileName?.split(".").pop()?.toLowerCase() || "";

        if (mime === "application/pdf" || ext === "pdf") {
            setSelectedPdf(file);
        } else if (
            mime.startsWith("image/") ||
            mime.startsWith("video/") ||
            ["png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "webm"].includes(ext)
        ) {
            setSelectedMedia(file);
        } else {
            handleDownload(file);
        }
    };

    const handleDownload = async (file: WorkspaceFile) => {
        try {
            setDownloadingId(file.id);
            const res = await workspaceApi.getFileDeliveryUrl(file.id, { download: true }, clubId);
            const url = res.deliveryUrl;

            // Trigger secure download
            const a = document.createElement("a");
            a.href = url;
            a.download = file.fileName;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err: any) {
            console.error("Failed to generate download URL:", err);
            toast.error("Failed to download file. Your session may have expired.");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = (fileId: string) => {
        setFileToDelete(fileId);
    };

    const confirmDeleteFile = async () => {
        if (!fileToDelete) return;
        try {
            setDeletingId(fileToDelete);
            await workspaceApi.deleteFile(fileToDelete, clubId);
            if (onFileDeleted) {
                onFileDeleted(fileToDelete);
            }
            toast.success("Attachment removed.");
            setFileToDelete(null);
        } catch (err: any) {
            console.error("Failed to delete file:", err);
            toast.error(err?.response?.data?.message || "Failed to delete file.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                {files.map((file) => {
                    const isPdf = file.mimeType === "application/pdf" || file.format === "pdf";
                    const isImage = file.mimeType?.startsWith("image/");

                    return (
                        <div
                            key={file.id}
                            className="group p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-border rounded-xl transition-all flex items-center gap-3 text-sm select-none"
                        >
                            {/* Thumbnail or File Icon */}
                            <div
                                onClick={() => handlePreview(file)}
                                className="w-10 h-10 rounded-lg bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                {isImage && (file.thumbnailUrl || file.cloudinaryUrl) ? (
                                    <img
                                        src={file.thumbnailUrl || file.cloudinaryUrl}
                                        alt={file.fileName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : isPdf && file.thumbnailUrl ? (
                                    <img
                                        src={file.thumbnailUrl}
                                        alt="PDF thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    getFileIcon(file)
                                )}
                            </div>

                            {/* Details */}
                            <div
                                onClick={() => handlePreview(file)}
                                className="flex-1 min-w-0 cursor-pointer"
                            >
                                <div className="font-medium text-foreground truncate hover:text-purple-400 transition-colors">
                                    {file.fileName}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>{formatBytes(file.fileSizeBytes)}</span>
                                    {file.uploader && (
                                        <>
                                            <span>•</span>
                                            <span className="truncate">
                                                {file.uploader.firstName} {file.uploader.lastName}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handlePreview(file)}
                                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                    title="Preview"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>

                                <button
                                    type="button"
                                    disabled={downloadingId === file.id}
                                    onClick={() => handleDownload(file)}
                                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                    title="Download"
                                >
                                    {downloadingId === file.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                </button>

                                {canDelete && (
                                    <button
                                        type="button"
                                        disabled={deletingId === file.id}
                                        onClick={() => handleDelete(file.id)}
                                        className="p-1.5 hover:bg-red-500/10 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
                                        title="Delete file"
                                    >
                                        {deletingId === file.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* In-Browser PDF Preview Modal */}
            {selectedPdf && (
                <PdfPreviewModal
                    file={selectedPdf}
                    clubId={clubId}
                    isOpen={Boolean(selectedPdf)}
                    onClose={() => setSelectedPdf(null)}
                />
            )}

            {/* Media Lightbox Modal */}
            {selectedMedia && (
                <MediaPreviewModal
                    file={selectedMedia}
                    clubId={clubId}
                    isOpen={Boolean(selectedMedia)}
                    onClose={() => setSelectedMedia(null)}
                />
            )}

            {/* Remove Attachment Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(fileToDelete)}
                onClose={() => setFileToDelete(null)}
                onConfirm={confirmDeleteFile}
                title="Remove Attachment?"
                description="Are you sure you want to delete this attachment? This action cannot be undone."
                confirmText="Remove File"
                cancelText="Cancel"
                variant="danger"
                isLoading={Boolean(deletingId)}
            />
        </div>
    );
};

export default AttachmentList;
