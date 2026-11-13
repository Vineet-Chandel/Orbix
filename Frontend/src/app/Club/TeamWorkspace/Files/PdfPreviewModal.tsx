// Frontend/src/app/Club/TeamWorkspace/Files/PdfPreviewModal.tsx
import React, { useState, useEffect } from "react";
import {
    X,
    Download,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    Loader2,
    FileText,
} from "lucide-react";
import workspaceApi from "../../../../api/workspaceApi";
import type { WorkspaceFile } from "../../../../types/workspace";
import { useToast } from "../../../../context/ToastContext";

interface PdfPreviewModalProps {
    file: WorkspaceFile;
    clubId?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    file,
    clubId,
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const [deliveryUrl, setDeliveryUrl] = useState<string | null>(file.deliveryUrl || null);
    const [page, setPage] = useState<number>(1);
    const [pageThumbnailUrl, setPageThumbnailUrl] = useState<string | null>(file.thumbnailUrl || null);
    const [zoom, setZoom] = useState<number>(100);
    const [loading, setLoading] = useState<boolean>(!file.deliveryUrl);
    const [pageLoading, setPageLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch authorized delivery URL and thumbnail on open
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchUrls = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await workspaceApi.getFileDeliveryUrl(
                    file.id,
                    { page, thumbnail: true },
                    clubId
                );
                if (isMounted) {
                    setDeliveryUrl(res.deliveryUrl);
                    setPageThumbnailUrl(res.thumbnailUrl || null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.response?.data?.message || "Failed to generate authorized PDF delivery URL.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchUrls();

        return () => {
            isMounted = false;
        };
    }, [isOpen, file.id, clubId]);

    // Update thumbnail on page change
    const handlePageChange = async (newPage: number) => {
        if (newPage < 1) return;
        setPage(newPage);
        try {
            setPageLoading(true);
            const res = await workspaceApi.getFileDeliveryUrl(
                file.id,
                { page: newPage, thumbnail: true },
                clubId
            );
            if (res.thumbnailUrl) {
                setPageThumbnailUrl(res.thumbnailUrl);
            }
        } catch (err) {
            console.error("Failed to fetch page thumbnail:", err);
        } finally {
            setPageLoading(false);
        }
    };

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
            toast.error("Failed to download PDF.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl h-[88vh] bg-background border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-4 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-foreground text-sm truncate">{file.fileName}</h3>
                            <p className="text-xs text-muted-foreground">Interactive PDF Viewer</p>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Zoom Controls */}
                        <div className="hidden sm:flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/50 text-xs">
                            <button
                                type="button"
                                onClick={() => setZoom((prev) => Math.max(prev - 20, 60))}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                title="Zoom out"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-mono text-muted-foreground">{zoom}%</span>
                            <button
                                type="button"
                                onClick={() => setZoom((prev) => Math.min(prev + 20, 200))}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                title="Zoom in"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Page Navigation */}
                        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/50 text-xs">
                            <button
                                type="button"
                                disabled={page <= 1 || pageLoading}
                                onClick={() => handlePageChange(page - 1)}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                title="Previous page"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-mono text-muted-foreground">Page {page}</span>
                            <button
                                type="button"
                                disabled={pageLoading}
                                onClick={() => handlePageChange(page + 1)}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                title="Next page"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Download button */}
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                        </button>

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors ml-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* PDF Body Container */}
                <div className="flex-1 bg-zinc-950/80 p-4 overflow-auto flex items-center justify-center relative">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                            <span className="text-sm">Authorizing PDF stream...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center p-6 max-w-md">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
                                <X className="w-6 h-6" />
                            </div>
                            <h4 className="font-semibold text-foreground mb-1">Access Restricted</h4>
                            <p className="text-sm text-muted-foreground mb-4">{error}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs"
                            >
                                Close Viewer
                            </button>
                        </div>
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center transition-transform duration-200"
                            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center top" }}
                        >
                            {/* Attempt full PDF iframe viewer, with Cloudinary page-1 thumbnail as fallback/preview */}
                            {deliveryUrl ? (
                                <iframe
                                    src={`${deliveryUrl}#toolbar=0&navpanes=0&page=${page}`}
                                    title={file.fileName}
                                    className="w-full h-full rounded-lg border border-border/40 shadow-xl bg-white"
                                />
                            ) : pageThumbnailUrl ? (
                                <div className="relative max-h-full flex items-center justify-center">
                                    {pageLoading && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                                        </div>
                                    )}
                                    <img
                                        src={pageThumbnailUrl}
                                        alt={`Page ${page}`}
                                        className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl border border-border/50"
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PdfPreviewModal;
