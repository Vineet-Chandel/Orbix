import React, { useState, useEffect, useCallback } from "react";
import {
    Plus,
    FolderKanban,
    Sparkles,
    AlertCircle,
    RefreshCw,
    Info,
    Menu,
} from "lucide-react";
import type { ProjectItem, ProjectListResponse } from "../../types/project";
import {
    fetchMyProjects,
    deleteProject,
    reorderProjects,
    toggleProjectPublish,
} from "../../api/projectApi";
import { ProjectCard } from "../../components/projects/ProjectCard";
import { ProjectDetailModal } from "../../components/projects/ProjectDetailModal";
import { ProjectSyncDiffModal } from "../../components/projects/ProjectSyncDiffModal";
import { ProjectModal } from "./ProjectModal";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { OrbixLoader } from "../../components/ui/loader/OrbixLoader";
import { useToast } from "../../context/ToastContext";

interface ProjectsManagementViewProps {
    onOpenMobileSidebar?: () => void;
}

export const ProjectsManagementView: React.FC<ProjectsManagementViewProps> = ({
    onOpenMobileSidebar,
}) => {
    const toast = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [count, setCount] = useState(0);
    const [maxCapacity, setMaxCapacity] = useState(4);
    const [isCapacityReached, setIsCapacityReached] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
    const [viewingProject, setViewingProject] = useState<ProjectItem | null>(null);
    const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);
    const [syncingProject, setSyncingProject] = useState<ProjectItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch projects
    const loadProjects = useCallback(async (quiet = false) => {
        if (!quiet) setIsLoading(true);
        else setIsRefreshing(true);
        setErrorMessage(null);

        try {
            const data: ProjectListResponse = await fetchMyProjects();
            setProjects(data.projects || []);
            setCount(data.count ?? data.projects?.length ?? 0);
            setMaxCapacity(data.maxCapacity ?? 4);
            setIsCapacityReached(data.isCapacityReached ?? (data.count >= 4));
        } catch (err: any) {
            console.error("Failed to load user projects:", err);
            setErrorMessage(err.message || "Failed to load projects showcase.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    // Handle project saved from Modal (create or edit)
    const handleProjectSaved = () => {
        loadProjects(true);
    };

    // Handle Toggle Publish
    const handleTogglePublish = async (project: ProjectItem) => {
        try {
            const res = await toggleProjectPublish(project.id, !project.isPublished);
            toast.success(
                res.project.isPublished
                    ? `"${project.title}" published to your showcase!`
                    : `"${project.title}" moved to drafts.`
            );
            setProjects((prev) =>
                prev.map((p) => (p.id === project.id ? res.project : p))
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to toggle publish status.");
        }
    };

    // Handle Delete
    const handleConfirmDelete = async () => {
        if (!deletingProject) return;
        setIsDeleting(true);

        try {
            await deleteProject(deletingProject.id);
            toast.success(`"${deletingProject.title}" deleted. A new showcase slot is now available.`);
            setDeletingProject(null);
            loadProjects(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete project.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle Reorder Up / Down
    const handleMove = async (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= projects.length) return;

        const newProjects = [...projects];
        const [moved] = newProjects.splice(index, 1);
        newProjects.splice(targetIndex, 0, moved);

        // Optimistically update
        setProjects(newProjects);

        try {
            const projectIds = newProjects.map((p) => p.id);
            await reorderProjects(projectIds);
        } catch (err: any) {
            toast.error("Failed to save project ordering.");
            loadProjects(true);
        }
    };

    return (
        <section
            aria-label="Orbix Projects Showcase Workspace"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header Card */}
                <div className="rounded-3xl bg-white border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b-2 border-black">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                                {onOpenMobileSidebar && (
                                    <button
                                        type="button"
                                        onClick={onOpenMobileSidebar}
                                        className="lg:hidden p-2 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer mr-1"
                                        aria-label="Open sidebar"
                                    >
                                        <Menu className="w-4 h-4 text-black" />
                                    </button>
                                )}
                                <span className="p-2 rounded-xl bg-black text-[#a2ff86] border border-black shadow-[2px_2px_0px_#000]">
                                    <FolderKanban className="w-5 h-5" />
                                </span>
                                <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                    Project Showcase & Repositories
                                </h1>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-2xl leading-relaxed">
                                Curate your top 4 flagship engineering architectures. Showcase verifiable GitHub intelligence, systems writeups, and live production deployments to recruiters and peer engineers.
                            </p>
                        </div>

                        {/* Top Actions: Capacity Badge & New Project Button */}
                        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
                            <button
                                type="button"
                                onClick={() => loadProjects(true)}
                                disabled={isRefreshing || isLoading}
                                className="p-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                                title="Refresh Projects"
                                aria-label="Refresh project list"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            </button>

                            {/* + New Project Button (Disabled when 4/4 capacity reached) */}
                            <div className="relative group">
                                <button
                                    type="button"
                                    disabled={isCapacityReached}
                                    onClick={() => {
                                        setEditingProject(null);
                                        setIsCreateModalOpen(true);
                                    }}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-all ${
                                        isCapacityReached
                                            ? "bg-neutral-200 text-neutral-400 border-neutral-400 cursor-not-allowed shadow-none"
                                            : "bg-black text-[#a2ff86] hover:bg-neutral-900 active:translate-y-0.5 cursor-pointer"
                                    }`}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>+ New Project</span>
                                </button>

                                {isCapacityReached && (
                                    <div className="absolute right-0 top-full mt-2 w-64 p-2.5 rounded-xl bg-black text-white text-[11px] font-bold shadow-[4px_4px_0px_rgba(0,0,0,0.3)] hidden group-hover:block z-20 pointer-events-none">
                                        Maximum project capacity reached (4/4). Delete an existing project or unpublish to replace.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Capacity Indicator Bar (1.1: Displays number of projects already added) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-black">
                                    Showcase Capacity:
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-white text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                    {count} / {maxCapacity} Projects Added
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-neutral-600">
                                {isCapacityReached
                                    ? "All 4 showcase slots are currently occupied. To add another project, delete an existing slot."
                                    : `${maxCapacity - count} of 4 slots currently available for new repositories or architectures.`}
                            </p>
                        </div>

                        {/* Visual 4-slot progress indicators */}
                        <div className="flex items-center gap-2">
                            {[0, 1, 2, 3].map((slotIdx) => {
                                const isFilled = slotIdx < count;
                                const isDraftSlot = isFilled && !projects[slotIdx]?.isPublished;
                                return (
                                    <div
                                        key={slotIdx}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-black flex items-center justify-center font-mono font-black text-xs shadow-[2px_2px_0px_#000] transition-all ${
                                            isFilled
                                                ? isDraftSlot
                                                    ? "bg-[#FFE566] text-black"
                                                    : "bg-black text-[#a2ff86]"
                                                : "bg-white text-neutral-300 border-dashed"
                                        }`}
                                        title={
                                            isFilled
                                                ? `Slot ${slotIdx + 1}: ${projects[slotIdx]?.title} (${
                                                      projects[slotIdx]?.isPublished ? "Published" : "Draft"
                                                  })`
                                                : `Slot ${slotIdx + 1}: Available`
                                        }
                                    >
                                        {isFilled ? slotIdx + 1 : "+"}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Explanatory callout when capacity is full */}
                    {isCapacityReached && (
                        <div className="p-4 rounded-2xl bg-[#FFE566]/30 border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
                            <div className="space-y-0.5 text-xs text-amber-950 font-bold leading-relaxed">
                                <p className="font-black text-black">
                                    Showcase Limit Reached (4 / 4 Projects)
                                </p>
                                <p>
                                    To maintain high portfolio quality and focused recruiter evaluation, Orbix enforces a strict 4-project capacity limit. You can edit existing entries or delete a project to free up a slot anytime.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area: Loading / Error / Empty / Grid */}
                {isLoading ? (
                    <div className="p-16 rounded-3xl bg-white border-[3px] border-black shadow-[6px_6px_0px_#000] flex flex-col items-center justify-center space-y-4">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-neutral-600">
                            Loading your project showcase...
                        </span>
                    </div>
                ) : errorMessage ? (
                    <div className="p-8 rounded-3xl bg-[#FF6B6B]/15 border-[3px] border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                        <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-red-900">
                                Failed to Load Projects
                            </h3>
                            <p className="text-xs text-red-800 font-bold">{errorMessage}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadProjects()}
                            className="px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-900 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                ) : projects.length === 0 ? (
                    /* EMPTY STATE (1.3: Empty — no projects) */
                    <div className="rounded-3xl bg-white border-[3px] border-black p-8 sm:p-12 text-center shadow-[6px_6px_0px_#000] space-y-5">
                        <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_#000]">
                            <Sparkles className="w-8 h-8 text-black" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1.5">
                            <h3 className="text-xl sm:text-2xl font-black text-black">
                                No Projects in Showcase Yet
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold leading-relaxed">
                                You have 4 open slots. Add your best open-source repositories, full-stack systems, or hackathon projects to stand out on Orbix.
                            </p>
                        </div>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingProject(null);
                                    setIsCreateModalOpen(true);
                                }}
                                className="px-6 py-3 rounded-2xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[4px_4px_0px_#000] text-xs font-black flex items-center gap-2 mx-auto cursor-pointer active:translate-y-0.5 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>+ Add Your First Project</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* PROJECTS GRID */
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                Active Showcase Projects ({projects.length})
                            </span>
                            <span className="text-[11px] font-bold text-neutral-500">
                                Use arrows on each card to change display order
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {projects.map((project, idx) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    isManageMode={true}
                                    onViewDetails={(p) => setViewingProject(p)}
                                    onEdit={(p) => {
                                        setEditingProject(p);
                                        setIsCreateModalOpen(true);
                                    }}
                                    onDelete={(p) => setDeletingProject(p)}
                                    onTogglePublish={handleTogglePublish}
                                    onSync={(p) => setSyncingProject(p)}
                                    onMoveUp={() => handleMove(idx, "up")}
                                    onMoveDown={() => handleMove(idx, "down")}
                                    isFirst={idx === 0}
                                    isLast={idx === projects.length - 1}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingProject(null);
                }}
                onSaved={handleProjectSaved}
                initialProject={editingProject}
            />

            <ProjectDetailModal
                isOpen={Boolean(viewingProject)}
                onClose={() => setViewingProject(null)}
                project={viewingProject}
            />

            {syncingProject && (
                <ProjectSyncDiffModal
                    isOpen={Boolean(syncingProject)}
                    onClose={() => setSyncingProject(null)}
                    projectId={syncingProject.id}
                    projectTitle={syncingProject.title}
                    onMergeSuccess={(updated) => {
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                        if (editingProject && editingProject.id === updated.id) {
                            setEditingProject(updated);
                        }
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={Boolean(deletingProject)}
                onClose={() => setDeletingProject(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Project Showcase Slot?"
                description={
                    <span>
                        Are you sure you want to delete{" "}
                        <strong>"{deletingProject?.title}"</strong>? This will permanently remove it
                        from your public profile and free up 1 of your 4 showcase slots.
                    </span>
                }
                confirmText="Delete Project"
                confirmLabel="Delete & Free Slot"
                variant="danger"
                isLoading={isDeleting}
            />
        </section>
    );
};
