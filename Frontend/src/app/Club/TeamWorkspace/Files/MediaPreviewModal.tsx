// Frontend/src/app/Club/TeamWorkspace/Files/MediaPreviewModal.tsx
import React, { useState, useEffect } from "react";
import { X, Download, Loader2, Image as ImageIcon, Video } from "lucide-react";
import workspaceApi from "../../../../api/workspaceApi";
import type { WorkspaceFile } from "../../../../types/workspace";
import { useToast } from "../../../../context/ToastContext";

interface MediaPreviewModalProps {
    file: WorkspaceFile;
    clubId?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
    file,
    clubId,
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const [deliveryUrl, setDeliveryUrl] = useState<string | null>(file.deliveryUrl || null);
    const [loading, setLoading] = useState<boolean>(!file.deliveryUrl);
    const [error, setError] = useState<string | null>(null);

    const isVideo = file.resourceType === "video" || file.mimeType?.startsWith("video/");

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchUrl = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await workspaceApi.getFileDeliveryUrl(file.id, {}, clubId);
                if (isMounted) {
                    setDeliveryUrl(res.deliveryUrl);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.response?.data?.message || "Failed to load media preview.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchUrl();

        return () => {
            isMounted = false;
        };
    }, [isOpen, file.id, clubId]);

    const handleDownload = async () => {
        try {
            const res = await workspaceApi.getFileDeliveryUrl(
                file.id,
                { download: true },
                clubId
            );
            const a = document.createElement("a");
            a.href = res.deliveryUrl;
            a.download = file.fileName;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch {
            toast.error("Failed to download media.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
                {/* Floating Top Bar */}
                <div className="w-full flex items-center justify-between px-4 py-2.5 mb-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white backdrop-blur-sm">
                    <div className="flex items-center gap-2 truncate">
                        {isVideo ? (
                            <Video className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                            <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{file.fileName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Media Container */}
                <div className="relative w-full max-h-[80vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black border border-zinc-800">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-zinc-400">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                            <span className="text-sm">Authorizing media playback...</span>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-400">
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : isVideo && deliveryUrl ? (
                        <video
                            src={deliveryUrl}
                            controls
                            autoPlay
                            className="max-h-[75vh] w-auto max-w-full rounded-xl"
                        >
                            Your browser does not support HTML5 video playback.
                        </video>
                    ) : deliveryUrl ? (
                        <img
                            src={deliveryUrl}
                            alt={file.fileName}
                            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MediaPreviewModal;
