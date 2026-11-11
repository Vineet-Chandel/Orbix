// Frontend/src/app/Club/TeamWorkspace/Files/ResourceLibraryView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    FolderArchive,
    UploadCloud,
    Search,
    RefreshCw,
    Download,
    Share2,
    Edit3,
    Trash2,
    Eye,
    FileText,
    Image as ImageIcon,
    Video as VideoIcon,
    FileSpreadsheet,
    FileArchive,
    File,
    HardDrive,
    Layers,
    CheckCircle2,
    AlertTriangle,
    X,
    ExternalLink,
    LayoutGrid,
    List,
    Shield,
} from "lucide-react";
import workspaceApi from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { OrbixLoader } from "../../../../components/ui/loader";
import type {
    WorkspaceFile,
    WorkspaceDepartment,
    MemberCapabilityResolution,
    WorkspaceStorageQuotaInfo,
} from "../../../../types/workspace";
import { FileUploadZone } from "./FileUploadZone";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { NeoSelect } from "../../../../components/NeoSelect";

interface ResourceLibraryViewProps {
    clubId: string;
    workspaceId: string;
    departments: WorkspaceDepartment[];
    capabilities: MemberCapabilityResolution | null;
    isAdmin?: boolean;
}

export const ResourceLibraryView: React.FC<ResourceLibraryViewProps> = ({
    clubId,
    workspaceId: _workspaceId,
    departments,
    capabilities,
    isAdmin = false,
}) => {
    const toast = useToast();

    // Data States
    const [files, setFiles] = useState<WorkspaceFile[]>([]);
    const [storageUsage, setStorageUsage] = useState<WorkspaceStorageQuotaInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter & Search States
    const [searchQuery, setSearchQuery] = useState("");
    const [folderScope, setFolderScope] = useState<string>("all"); // 'all' | 'general' | 'dept:<id>' | 'tasks' | 'channels'
    const [categoryFilter, setCategoryFilter] = useState<string>("all"); // 'all' | 'pdf' | 'image' | 'video' | 'doc' | 'archive'
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "size_desc" | "size_asc">("newest");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Modal States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedUploadDeptId, setSelectedUploadDeptId] = useState<string>("");
    const [selectedUploadResourceType, setSelectedUploadResourceType] = useState<"resource" | "attachment">("resource");

    // Preview Modals
    const [selectedPdf, setSelectedPdf] = useState<WorkspaceFile | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<WorkspaceFile | null>(null);

    // Rename Modal
    const [renamingFile, setRenamingFile] = useState<WorkspaceFile | null>(null);
    const [newFileName, setNewFileName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    // Replace Modal
    const [replacingFile, setReplacingFile] = useState<WorkspaceFile | null>(null);
    const [replacementFile, setReplacementFile] = useState<globalThis.File | null>(null);
    const [isReplacing, setIsReplacing] = useState(false);

    // Delete Confirmation Modal
    const [deletingFile, setDeletingFile] = useState<WorkspaceFile | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Share link copying
    const [sharingFileId, setSharingFileId] = useState<string | null>(null);

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    const fetchFilesAndQuota = useCallback(
        async (isBackground = false) => {
            if (!isBackground) setLoading(true);
            else setRefreshing(true);

            try {
                const [filesRes, quotaRes] = await Promise.all([
                    workspaceApi.listFiles({ limit: 200 }, clubId),
                    workspaceApi.getStorageUsage(clubId).catch(() => null),
                ]);

                if (filesRes && filesRes.files) {
                    setFiles(filesRes.files);
                }
                if (quotaRes && quotaRes.storage) {
                    setStorageUsage(quotaRes.storage);
                }
            } catch (err: any) {
                console.error("Failed to load workspace files:", err);
                toast.error(err?.response?.data?.message || "Failed to load workspace resources.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [clubId, toast]
    );

    useEffect(() => {
        fetchFilesAndQuota();
    }, [fetchFilesAndQuota]);

    // Permissions check
    const canUpload =
        isAdmin ||
        capabilities?.isOwner ||
        capabilities?.isWorkspaceManager ||
        capabilities?.capabilities.assets.upload;

    const canManageFiles =
        isAdmin ||
        capabilities?.isOwner ||
        capabilities?.isWorkspaceManager ||
        capabilities?.capabilities.assets.manage;

    const canUserModifyFile = (file: WorkspaceFile): boolean => {
        if (canManageFiles) return true;
        if (capabilities?.userId && file.uploaderId === capabilities.userId) return true;
        if (file.departmentId && capabilities?.leadDepartmentIds?.includes(file.departmentId)) return true;
        return false;
    };

    // =========================================================================
    // FORMATTING HELPERS
    // =========================================================================

    const formatBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return "0 B";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const getFileCategory = (file: WorkspaceFile): "pdf" | "image" | "video" | "doc" | "archive" | "other" => {
        const mime = (file.mimeType || "").toLowerCase();
        const ext = (file.fileName || "").split(".").pop()?.toLowerCase() || "";

        if (mime === "application/pdf" || ext === "pdf") return "pdf";
        if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
        if (mime.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
        if (
            ["doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt"].includes(ext) ||
            mime.includes("spreadsheet") ||
            mime.includes("document") ||
            mime.includes("text/")
        ) {
            return "doc";
        }
        if (["zip", "tar", "gz", "rar", "7z"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) {
            return "archive";
        }
        return "other";
    };

    const getFileIcon = (file: WorkspaceFile) => {
        const category = getFileCategory(file);
        switch (category) {
            case "pdf":
                return <FileText className="w-5 h-5 text-rose-500" />;
            case "image":
                return <ImageIcon className="w-5 h-5 text-purple-500" />;
            case "video":
                return <VideoIcon className="w-5 h-5 text-blue-500" />;
            case "doc":
                return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
            case "archive":
                return <FileArchive className="w-5 h-5 text-amber-500" />;
            default:
                return <File className="w-5 h-5 text-neutral-600" />;
        }
    };

    // =========================================================================
    // FILTERED & SORTED FILES
    // =========================================================================

    const filteredFiles = useMemo(() => {
        let result = [...files];

        // 1. Folder Scope Filter
        if (folderScope === "general") {
            result = result.filter(
                (f) =>
                    (!f.departmentId && !f.taskId && !f.channelId) ||
                    f.parentResourceType === "resource"
            );
        } else if (folderScope.startsWith("dept:")) {
            const deptId = folderScope.replace("dept:", "");
            result = result.filter((f) => f.departmentId === deptId);
        } else if (folderScope === "tasks") {
            result = result.filter(
                (f) =>
                    f.taskId ||
                    f.submissionId ||
                    f.parentResourceType === "task" ||
                    f.parentResourceType === "task_submission"
            );
        } else if (folderScope === "channels") {
            result = result.filter(
                (f) =>
                    f.channelId ||
                    f.messageId ||
                    f.parentResourceType === "channel" ||
                    f.parentResourceType === "message"
            );
        }

        // 2. Category Filter
        if (categoryFilter !== "all") {
            result = result.filter((f) => getFileCategory(f) === categoryFilter);
        }

        // 3. Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((f) => {
                const nameMatch = f.fileName.toLowerCase().includes(q);
                const uploaderMatch = f.uploader
                    ? `${f.uploader.firstName} ${f.uploader.lastName} ${f.uploader.username}`
                          .toLowerCase()
                          .includes(q)
                    : false;
                const formatMatch = f.format?.toLowerCase().includes(q);
                return nameMatch || uploaderMatch || formatMatch;
            });
        }

        // 4. Sorting
        result.sort((a, b) => {
            if (sortBy === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (sortBy === "oldest") {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            if (sortBy === "name") {
                return a.fileName.localeCompare(b.fileName);
            }
            if (sortBy === "size_desc") {
                return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
            }
            if (sortBy === "size_asc") {
                return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
            }
            return 0;
        });

        return result;
    }, [files, folderScope, categoryFilter, searchQuery, sortBy]);

    // Counts by category
    const categoryCounts = useMemo(() => {
        const counts = { all: files.length, pdf: 0, image: 0, video: 0, doc: 0, archive: 0, other: 0 };
        files.forEach((f) => {
            const cat = getFileCategory(f);
            if (counts[cat] !== undefined) counts[cat]++;
        });
        return counts;
    }, [files]);

    // Accessible departments for current user
    const accessibleDepartments = useMemo(() => {
        if (isAdmin || capabilities?.isOwner || capabilities?.isWorkspaceManager) {
            return departments;
        }
        return departments.filter(
            (d) =>
                capabilities?.memberDepartmentIds?.includes(d.id) ||
                capabilities?.leadDepartmentIds?.includes(d.id)
        );
    }, [departments, isAdmin, capabilities]);

    // =========================================================================
    // HANDLERS
    // =========================================================================

    const handlePreview = (file: WorkspaceFile) => {
        const cat = getFileCategory(file);
        if (cat === "pdf") {
            setSelectedPdf(file);
        } else if (cat === "image" || cat === "video") {
            setSelectedMedia(file);
        } else {
            handleDownload(file);
        }
    };

    const handleDownload = async (file: WorkspaceFile) => {
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
            toast.success(`Download started for ${file.fileName}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to download file.");
        }
    };

    const handleShare = async (file: WorkspaceFile) => {
        try {
            setSharingFileId(file.id);
            const res = await workspaceApi.getShareUrl(file.id, 86400, clubId);
            await navigator.clipboard.writeText(res.shareUrl);
            toast.success("Secure share link copied to clipboard! (Valid for 24 hours)");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to create share link.");
        } finally {
            setSharingFileId(null);
        }
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingFile || !newFileName.trim()) return;

        try {
            setIsRenaming(true);
            const res = await workspaceApi.renameFile(renamingFile.id, newFileName.trim(), clubId);
            setFiles((prev) => prev.map((f) => (f.id === renamingFile.id ? res.file : f)));
            toast.success("File renamed successfully!");
            setRenamingFile(null);
            setNewFileName("");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to rename file.");
        } finally {
            setIsRenaming(false);
        }
    };

    const handleReplaceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replacingFile || !replacementFile) return;

        try {
            setIsReplacing(true);
            const formData = new FormData();
            formData.append("file", replacementFile);

            const res = await workspaceApi.replaceFile(replacingFile.id, formData, clubId);
            setFiles((prev) => prev.map((f) => (f.id === replacingFile.id ? res.file : f)));
            toast.success(`File "${replacingFile.fileName}" replaced successfully!`);
            setReplacingFile(null);
            setReplacementFile(null);
            fetchFilesAndQuota(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to replace file.");
        } finally {
            setIsReplacing(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingFile) return;

        try {
            setIsDeleting(true);
            await workspaceApi.deleteFile(deletingFile.id, clubId);
            setFiles((prev) => prev.filter((f) => f.id !== deletingFile.id));
            toast.success(`"${deletingFile.fileName}" deleted permanently.`);
            setDeletingFile(null);
            fetchFilesAndQuota(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete file.");
        } finally {
            setIsDeleting(false);
        }
    };

    // =========================================================================
    // RENDER
    // =========================================================================

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* HERO & STORAGE OVERVIEW BANNER */}
            <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl p-6 shadow-neo relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-[#FFE566] text-black text-[11px] font-black uppercase tracking-wider rounded-lg border border-black shadow-neo-xs flex items-center gap-1.5">
                                <FolderArchive className="w-3.5 h-3.5" />
                                Cloudinary Authenticated Vault
                            </span>
                            <span className="px-2.5 py-1 bg-[#A6FF70] text-black text-[11px] font-black uppercase tracking-wider rounded-lg border border-black shadow-neo-xs flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Zero-Trust Signed URLs
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Shared Resources & Files
                        </h2>
                        <p className="text-sm font-bold text-neutral-600 mt-1.5 leading-relaxed">
                            Centralized assets, project documentation, brand guidelines, and task deliverables with
                            cryptographic permission checking and real-time PDF inspection.
                        </p>
                    </div>

                    {/* Storage Quota Gauge & Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        {/* Storage usage mini card */}
                        <div className="bg-white border-2 border-black rounded-xl p-3 shadow-neo-xs min-w-[200px]">
                            <div className="flex items-center justify-between text-xs font-black text-black mb-1.5">
                                <span className="flex items-center gap-1">
                                    <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
                                    Storage Quota
                                </span>
                                <span className="font-mono text-[11px]">
                                    {formatBytes(storageUsage?.usedBytes || 0)} / 10 GB
                                </span>
                            </div>
                            <div className="w-full bg-neutral-100 rounded-full h-2.5 border border-black overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        (storageUsage?.usedPercentage || 0) > 90
                                            ? "bg-rose-500"
                                            : (storageUsage?.usedPercentage || 0) > 75
                                            ? "bg-amber-400"
                                            : "bg-[#A6FF70]"
                                    }`}
                                    style={{ width: `${Math.min(storageUsage?.usedPercentage || 1, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500 mt-1">
                                <span>{files.length} total files</span>
                                <span>{storageUsage?.usedPercentage || 0}% used</span>
                            </div>
                        </div>

                        {/* Upload trigger button */}
                        {canUpload && (
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-4 py-2.5 bg-[#A6FF70] hover:bg-[#8cee54] text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                            >
                                <UploadCloud className="w-4 h-4" />
                                Upload Asset
                            </button>
                        )}

                        {/* Refresh button */}
                        <button
                            onClick={() => fetchFilesAndQuota(true)}
                            disabled={refreshing}
                            className="p-2.5 bg-white hover:bg-neutral-50 text-black rounded-xl border-2 border-black shadow-neo-xs hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center disabled:opacity-50"
                            title="Refresh resource library"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* FOLDER & SCOPE NAVIGATION TABS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                    onClick={() => setFolderScope("all")}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        folderScope === "all"
                            ? "bg-[#FFE566] shadow-neo-xs translate-x-[1px] translate-y-[1px]"
                            : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                    }`}
                >
                    <Layers className="w-3.5 h-3.5" />
                    All Accessible Resources ({files.length})
                </button>

                <button
                    onClick={() => setFolderScope("general")}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        folderScope === "general"
                            ? "bg-[#FFE566] shadow-neo-xs translate-x-[1px] translate-y-[1px]"
                            : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                    }`}
                >
                    <FolderArchive className="w-3.5 h-3.5" />
                    General Workspace
                </button>

                {accessibleDepartments.map((dept) => {
                    const deptCount = files.filter((f) => f.departmentId === dept.id).length;
                    return (
                        <button
                            key={dept.id}
                            onClick={() => setFolderScope(`dept:${dept.id}`)}
                            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                folderScope === `dept:${dept.id}`
                                    ? "bg-[#FFE566] shadow-neo-xs translate-x-[1px] translate-y-[1px]"
                                    : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                            }`}
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full border border-black shrink-0"
                                style={{ backgroundColor: dept.color || "#70C4FF" }}
                            />
                            {dept.name} ({deptCount})
                        </button>
                    );
                })}

                <button
                    onClick={() => setFolderScope("tasks")}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        folderScope === "tasks"
                            ? "bg-[#FFE566] shadow-neo-xs translate-x-[1px] translate-y-[1px]"
                            : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                    }`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Task Deliverables
                </button>

                <button
                    onClick={() => setFolderScope("channels")}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        folderScope === "channels"
                            ? "bg-[#FFE566] shadow-neo-xs translate-x-[1px] translate-y-[1px]"
                            : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                    }`}
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Channel Attachments
                </button>
            </div>

            {/* CONTROLS BAR: SEARCH, MIME-CATEGORY FILTER, SORT, VIEW SWITCHER */}
            <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search files by name, uploader, or format..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white shadow-neo-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                    {[
                        { key: "all", label: "All", count: categoryCounts.all },
                        { key: "pdf", label: "PDFs", count: categoryCounts.pdf },
                        { key: "image", label: "Images", count: categoryCounts.image },
                        { key: "video", label: "Videos", count: categoryCounts.video },
                        { key: "doc", label: "Docs", count: categoryCounts.doc },
                        { key: "archive", label: "Archives", count: categoryCounts.archive },
                    ].map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => setCategoryFilter(cat.key)}
                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg border border-black transition-all whitespace-nowrap ${
                                categoryFilter === cat.key
                                    ? "bg-black text-white"
                                    : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                            }`}
                        >
                            {cat.label} ({cat.count})
                        </button>
                    ))}
                </div>

                {/* Sort & View Mode Switcher */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Sort Dropdown */}
                    <div className="min-w-[150px]">
                        <NeoSelect
                            value={sortBy}
                            onChange={(val) => setSortBy(val as any)}
                            size="sm"
                            triggerClassName="w-full text-xs font-black"
                            options={[
                                { value: "newest", label: "Newest First" },
                                { value: "oldest", label: "Oldest First" },
                                { value: "name", label: "Name (A-Z)" },
                                { value: "size_desc", label: "Size (Largest)" },
                                { value: "size_asc", label: "Size (Smallest)" },
                            ]}
                        />
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center bg-neutral-100 border-2 border-black rounded-xl p-0.5 shadow-neo-xs">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-lg transition-colors ${
                                viewMode === "grid" ? "bg-white border border-black shadow-neo-xs text-black" : "text-neutral-500 hover:text-black"
                            }`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-lg transition-colors ${
                                viewMode === "list" ? "bg-white border border-black shadow-neo-xs text-black" : "text-neutral-500 hover:text-black"
                            }`}
                            title="List View"
                        >
                            <List className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* FILE DISPLAY AREA */}
            {loading ? (
                <div className="bg-white border-2 border-black rounded-2xl p-16 text-center shadow-neo">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <OrbixLoader size="md" />
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                            Loading authenticated workspace resources...
                        </span>
                    </div>
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="bg-white border-2 border-black rounded-2xl p-16 text-center shadow-neo">
                    <div className="w-16 h-16 bg-[#FFE566] border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
                        <FolderArchive className="w-8 h-8 text-black" />
                    </div>
                    <h3 className="text-xl font-black text-black">No Resources Found</h3>
                    <p className="text-xs font-bold text-neutral-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
                        {searchQuery
                            ? `No files match your query "${searchQuery}". Try adjusting your keywords or category filters.`
                            : folderScope !== "all"
                            ? "This folder currently has no files uploaded. Use the Upload Asset button to add resources."
                            : "Your workspace resource vault is empty. Upload documents, PDFs, media, and guidelines to share with the team."}
                    </p>
                    {canUpload && (
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-5 py-2.5 bg-[#A6FF70] hover:bg-[#8cee54] text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] transition-all inline-flex items-center gap-2"
                        >
                            <UploadCloud className="w-4 h-4" />
                            Upload First Asset
                        </button>
                    )}
                </div>
            ) : viewMode === "grid" ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredFiles.map((file) => {
                        const cat = getFileCategory(file);
                        const canModify = canUserModifyFile(file);
                        const dept = departments.find((d) => d.id === file.departmentId);

                        return (
                            <div
                                key={file.id}
                                className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col group"
                            >
                                {/* Thumbnail Header */}
                                <div
                                    onClick={() => handlePreview(file)}
                                    className="h-36 bg-neutral-100 border-b-2 border-black relative cursor-pointer overflow-hidden flex items-center justify-center group-hover:bg-neutral-50 transition-colors"
                                >
                                    {file.thumbnailUrl ? (
                                        <img
                                            src={file.thumbnailUrl}
                                            alt={file.fileName}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 p-4 text-center">
                                            <div className="w-12 h-12 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-neo-xs">
                                                {getFileIcon(file)}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                                {file.format || cat}
                                            </span>
                                        </div>
                                    )}

                                    {/* Format Badge Overlay */}
                                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                                        <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black uppercase tracking-wider rounded border border-black shadow-neo-xs">
                                            {file.format || cat}
                                        </span>
                                        {dept && (
                                            <span
                                                className="px-2 py-0.5 text-black text-[10px] font-black rounded border border-black shadow-neo-xs truncate max-w-[100px]"
                                                style={{ backgroundColor: dept.color || "#FFE566" }}
                                            >
                                                {dept.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Hover Preview Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <span className="px-3 py-1.5 bg-white text-black text-xs font-black rounded-xl border-2 border-black shadow-neo-xs flex items-center gap-1.5 scale-90 group-hover:scale-100 transition-transform">
                                            <Eye className="w-3.5 h-3.5" />
                                            {cat === "pdf" ? "Open PDF" : "Preview"}
                                        </span>
                                    </div>
                                </div>

                                {/* Body Info */}
                                <div className="p-3.5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h4
                                            className="text-xs font-black text-black truncate mb-1"
                                            title={file.fileName}
                                        >
                                            {file.fileName}
                                        </h4>
                                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
                                            <span>{formatBytes(file.fileSizeBytes)}</span>
                                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Uploader & Actions Bar */}
                                    <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0" title={`Uploaded by ${file.uploader?.firstName || file.uploader?.username || "Member"}`}>
                                            <div className="w-5 h-5 rounded-full bg-[#FFE566] border border-black flex items-center justify-center text-[10px] font-black shrink-0">
                                                {(file.uploader?.firstName?.[0] || file.uploader?.username?.[0] || "U").toUpperCase()}
                                            </div>
                                            <span className="text-[11px] font-bold text-neutral-600 truncate">
                                                {file.uploader?.firstName || file.uploader?.username || "Member"}
                                            </span>
                                        </div>

                                        {/* Action Icon Buttons */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleDownload(file)}
                                                className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black transition-all"
                                                title="Download file"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleShare(file)}
                                                disabled={sharingFileId === file.id}
                                                className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black transition-all"
                                                title="Copy secure share link"
                                            >
                                                <Share2 className={`w-3.5 h-3.5 ${sharingFileId === file.id ? "animate-spin" : ""}`} />
                                            </button>

                                            {canModify && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRenamingFile(file);
                                                            setNewFileName(file.fileName);
                                                        }}
                                                        className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black transition-all"
                                                        title="Rename file"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReplacingFile(file);
                                                            setReplacementFile(null);
                                                        }}
                                                        className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black transition-all"
                                                        title="Replace file with newer version"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setDeletingFile(file)}
                                                        className="p-1 hover:bg-rose-50 text-neutral-700 hover:text-rose-600 rounded border border-transparent hover:border-black transition-all"
                                                        title="Delete file"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* LIST / TABLE VIEW */
                <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-neo">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black bg-neutral-100 text-[11px] font-black uppercase tracking-wider text-black">
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Department / Scope</th>
                                    <th className="py-3 px-4">Size</th>
                                    <th className="py-3 px-4">Uploaded By</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y border-neutral-200">
                                {filteredFiles.map((file) => {
                                    const cat = getFileCategory(file);
                                    const canModify = canUserModifyFile(file);
                                    const dept = departments.find((d) => d.id === file.departmentId);

                                    return (
                                        <tr
                                            key={file.id}
                                            className="hover:bg-neutral-50 transition-colors text-xs font-bold text-black"
                                        >
                                            {/* File Name & Icon */}
                                            <td className="py-3 px-4">
                                                <div
                                                    onClick={() => handlePreview(file)}
                                                    className="flex items-center gap-2.5 cursor-pointer group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-black flex items-center justify-center shrink-0 shadow-neo-xs group-hover:scale-105 transition-transform">
                                                        {getFileIcon(file)}
                                                    </div>
                                                    <span className="truncate max-w-[240px] font-black text-black group-hover:underline">
                                                        {file.fileName}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 bg-neutral-200 text-black text-[10px] font-black uppercase rounded border border-black">
                                                    {file.format || cat}
                                                </span>
                                            </td>

                                            {/* Department / Scope */}
                                            <td className="py-3 px-4">
                                                {dept ? (
                                                    <span
                                                        className="px-2 py-0.5 text-black text-[10px] font-black rounded border border-black shadow-neo-xs truncate inline-block max-w-[140px]"
                                                        style={{ backgroundColor: dept.color || "#FFE566" }}
                                                    >
                                                        {dept.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-500 text-[11px]">General Workspace</span>
                                                )}
                                            </td>

                                            {/* Size */}
                                            <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">
                                                {formatBytes(file.fileSizeBytes)}
                                            </td>

                                            {/* Uploader */}
                                            <td className="py-3 px-4 text-neutral-700">
                                                {file.uploader?.firstName || file.uploader?.username || "Member"}
                                            </td>

                                            {/* Date */}
                                            <td className="py-3 px-4 text-neutral-500 text-[11px]">
                                                {new Date(file.createdAt).toLocaleDateString()}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handlePreview(file)}
                                                        className="px-2 py-1 bg-white hover:bg-neutral-100 border border-black rounded text-[11px] font-bold shadow-neo-xs"
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(file)}
                                                        className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black"
                                                        title="Download"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleShare(file)}
                                                        className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black"
                                                        title="Copy share link"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    {canModify && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setRenamingFile(file);
                                                                    setNewFileName(file.fileName);
                                                                }}
                                                                className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black"
                                                                title="Rename"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setReplacingFile(file);
                                                                    setReplacementFile(null);
                                                                }}
                                                                className="p-1 hover:bg-neutral-100 text-neutral-700 hover:text-black rounded border border-transparent hover:border-black"
                                                                title="Replace"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingFile(file)}
                                                                className="p-1 hover:bg-rose-50 text-neutral-700 hover:text-rose-600 rounded border border-transparent hover:border-black"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* UPLOAD MODAL */}
            {/* ========================================================================= */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl w-full max-w-xl p-6 shadow-neo relative">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#A6FF70] border-2 border-black flex items-center justify-center shadow-neo-xs">
                                    <UploadCloud className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="text-lg font-black text-black">Upload New Asset</h3>
                            </div>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-1 hover:bg-neutral-200 rounded-lg border border-transparent hover:border-black transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Destination Picker */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-black text-black mb-1">
                                    Resource Scope
                                </label>
                                <NeoSelect
                                    value={selectedUploadResourceType}
                                    onChange={(val) => setSelectedUploadResourceType(val as any)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "resource", label: "General Shared Resource" },
                                        { value: "attachment", label: "Department Attachment" },
                                    ]}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-black mb-1">
                                    Target Department (Optional)
                                </label>
                                <NeoSelect
                                    value={selectedUploadDeptId}
                                    onChange={(val) => setSelectedUploadDeptId(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "", label: "None (Workspace-Wide)" },
                                        ...accessibleDepartments.map((d) => ({ value: d.id, label: d.name })),
                                    ]}
                                />
                            </div>
                        </div>

                        {/* File Upload Zone */}
                        <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs">
                            <FileUploadZone
                                clubId={clubId}
                                parentResourceType={selectedUploadResourceType}
                                departmentId={selectedUploadDeptId || null}
                                onFileUploaded={(uploadedFile) => {
                                    setFiles((prev) => [uploadedFile, ...prev]);
                                    toast.success(`"${uploadedFile.fileName}" uploaded successfully!`);
                                    fetchFilesAndQuota(true);
                                }}
                            />
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(false)}
                                className="px-4 py-2 bg-white hover:bg-neutral-100 text-black font-black text-xs rounded-xl border-2 border-black shadow-neo-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* RENAME MODAL */}
            {/* ========================================================================= */}
            {renamingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl w-full max-w-md p-6 shadow-neo relative">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <Edit3 className="w-4 h-4 text-black" />
                                Rename File
                            </h3>
                            <button
                                onClick={() => setRenamingFile(null)}
                                className="p-1 hover:bg-neutral-200 rounded-lg border border-transparent hover:border-black"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleRenameSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-black mb-1">
                                    Display File Name
                                </label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    placeholder="e.g. Q4_Event_Checklist.pdf"
                                    className="w-full px-3.5 py-2.5 bg-white border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none shadow-neo-xs"
                                    autoFocus
                                />
                                <p className="text-[10px] font-bold text-neutral-500 mt-1">
                                    Extension is automatically preserved if omitted.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRenamingFile(null)}
                                    className="px-4 py-2 bg-white hover:bg-neutral-100 text-black font-black text-xs rounded-xl border-2 border-black shadow-neo-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isRenaming || !newFileName.trim()}
                                    className="px-4 py-2 bg-[#A6FF70] hover:bg-[#8cee54] text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-neo-xs disabled:opacity-50"
                                >
                                    {isRenaming ? "Saving..." : "Save Name"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* REPLACE MODAL */}
            {/* ========================================================================= */}
            {replacingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl w-full max-w-md p-6 shadow-neo relative">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-black" />
                                Replace File Content
                            </h3>
                            <button
                                onClick={() => setReplacingFile(null)}
                                className="p-1 hover:bg-neutral-200 rounded-lg border border-transparent hover:border-black"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleReplaceSubmit} className="space-y-4">
                            <div className="bg-amber-50 border-2 border-black rounded-xl p-3 text-xs font-bold text-neutral-800 shadow-neo-xs">
                                <div className="flex items-center gap-2 font-black text-black mb-1">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Replacing "{replacingFile.fileName}"
                                </div>
                                Uploading a new binary will replace the asset in Cloudinary while keeping all existing
                                task/channel references intact.
                            </div>

                            <div>
                                <label className="block text-xs font-black text-black mb-1">
                                    Select Replacement File
                                </label>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setReplacementFile(e.target.files[0]);
                                        }
                                    }}
                                    className="w-full text-xs font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-2 file:border-black file:text-xs file:font-black file:bg-[#FFE566] hover:file:bg-[#ffe14d] file:cursor-pointer cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReplacingFile(null)}
                                    className="px-4 py-2 bg-white hover:bg-neutral-100 text-black font-black text-xs rounded-xl border-2 border-black shadow-neo-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isReplacing || !replacementFile}
                                    className="px-4 py-2 bg-[#A6FF70] hover:bg-[#8cee54] text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-neo-xs disabled:opacity-50"
                                >
                                    {isReplacing ? "Uploading..." : "Confirm Replacement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* DELETE CONFIRMATION MODAL */}
            {/* ========================================================================= */}
            {deletingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl w-full max-w-md p-6 shadow-neo relative">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
                            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
                                <Trash2 className="w-4 h-4 text-rose-600" />
                                Delete Asset Permanently
                            </h3>
                            <button
                                onClick={() => setDeletingFile(null)}
                                className="p-1 hover:bg-neutral-200 rounded-lg border border-transparent hover:border-black"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs font-bold text-neutral-700 leading-relaxed mb-4">
                            Are you sure you want to delete <span className="font-black text-black">"{deletingFile.fileName}"</span>?
                            This will destroy the file in Cloudinary and permanently remove it from the workspace vault.
                        </p>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeletingFile(null)}
                                className="px-4 py-2 bg-white hover:bg-neutral-100 text-black font-black text-xs rounded-xl border-2 border-black shadow-neo-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-neo-xs disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* INTERACTIVE PDF VIEWER MODAL */}
            {/* ========================================================================= */}
            {selectedPdf && (
                <PdfPreviewModal
                    file={selectedPdf}
                    clubId={clubId}
                    isOpen={!!selectedPdf}
                    onClose={() => setSelectedPdf(null)}
                />
            )}

            {/* ========================================================================= */}
            {/* MEDIA LIGHTBOX (IMAGE & VIDEO) */}
            {/* ========================================================================= */}
            {selectedMedia && (
                <MediaPreviewModal
                    file={selectedMedia}
                    isOpen={!!selectedMedia}
                    onClose={() => setSelectedMedia(null)}
                />
            )}
        </div>
    );
};

export default ResourceLibraryView;
