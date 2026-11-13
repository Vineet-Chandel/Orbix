// Frontend/src/app/Club/TeamWorkspace/Departments/DepartmentOverviewView.tsx
import React, { useState } from "react";
import {
    Plus,
    Sparkles,
    Users,
    Shield,
    Folder,
    Code,
    Palette,
    MessageSquare,
    CheckSquare,
    Camera,
    ChevronRight,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { CreateDepartmentModal } from "./CreateDepartmentModal";
import { DepartmentDetailModal } from "./DepartmentDetailModal";
import type {
    WorkspaceDepartment,
    WorkspaceMember,
    MemberCapabilityResolution,
} from "../../../../types/workspace";

interface DepartmentOverviewViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    allMembers: WorkspaceMember[];
    isAdmin: boolean;
    capabilities?: MemberCapabilityResolution | null;
    onReload: () => void;
}

const ICON_MAP: Record<string, any> = {
    Code,
    Palette,
    MessageSquare,
    CheckSquare,
    Camera,
    Folder,
};

export const DepartmentOverviewView: React.FC<DepartmentOverviewViewProps> = ({
    clubId,
    departments,
    allMembers,
    isAdmin,
    capabilities,
    onReload,
}) => {
    const toast = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [reordering, setReordering] = useState(false);

    const canCreateDepartment = isAdmin || Boolean(capabilities?.capabilities.departments.create);
    const canManageDepartments = isAdmin || Boolean(capabilities?.capabilities.departments.manageAll);

    const handleMoveDepartment = async (deptId: string, direction: "up" | "down", e: React.MouseEvent) => {
        e.stopPropagation();
        if (reordering) return;
        const currentActive = departments.filter((d) => d.status === "active");
        const idx = currentActive.findIndex((d) => d.id === deptId);
        if (idx === -1) return;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= currentActive.length) return;

        const newOrder = [...currentActive];
        const temp = newOrder[idx];
        newOrder[idx] = newOrder[targetIdx];
        newOrder[targetIdx] = temp;

        try {
            setReordering(true);
            const res = await workspaceApi.reorderDepartments(
                newOrder.map((d) => d.id),
                clubId
            );
            if (res.success) {
                toast.success("Department order updated.");
                onReload();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to reorder departments.");
        } finally {
            setReordering(false);
        }
    };

    const handleSeedDefaults = async () => {
        try {
            setSeeding(true);
            const res = await workspaceApi.seedDefaultDepartments(clubId);
            if (res.success) {
                toast.success(res.message);
                onReload();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to generate suggested departments.");
        } finally {
            setSeeding(false);
        }
    };

    const visibleDepartments = departments.filter((d) =>
        showArchived ? true : d.status === "active"
    );

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-white border-2 border-black rounded-xl p-5 shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-black text-black">Workspace Departments</h3>
                    <p className="text-xs text-neutral-600">
                        Organize your chapter into functional departments with primary leads and cross-department collaboration.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`px-3 py-1.5 text-xs font-bold border-2 border-black rounded-xl transition ${
                            showArchived ? "bg-neutral-800 text-white" : "bg-neutral-100 hover:bg-neutral-200 text-black"
                        }`}
                    >
                        {showArchived ? "Hide Archived" : "Show Archived"}
                    </button>

                    {canCreateDepartment && (
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-1.5 transition-all active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <Plus className="w-4 h-4" />
                            New Department
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State / Suggested Seeding */}
            {departments.length === 0 && (
                <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl p-8 text-center shadow-neo max-w-xl mx-auto my-6">
                    <div className="w-14 h-14 bg-amber-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-neo-xs">
                        <Sparkles className="w-7 h-7 text-amber-600" />
                    </div>
                    <h4 className="text-xl font-black text-black">No Departments Configured</h4>
                    <p className="text-xs text-neutral-600 mt-2 max-w-md mx-auto leading-relaxed">
                        Start structuring your club with our 5 recommended department templates (Technical, Design,
                        Communications, Operations, Media) or build custom sub-teams from scratch.
                    </p>
                    {isAdmin && (
                        <div className="flex items-center justify-center gap-3 mt-5">
                            <button
                                onClick={handleSeedDefaults}
                                disabled={seeding}
                                className="px-4 py-2.5 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-2 transition"
                            >
                                <Sparkles className="w-4 h-4 text-black" />
                                {seeding ? "Generating..." : "Generate 5 Suggested Departments"}
                            </button>
                            <button
                                onClick={() => setIsCreateOpen(true)}
                                className="px-4 py-2.5 bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs transition"
                            >
                                Create Custom
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Department Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleDepartments.map((dept, idx) => {
                    const IconComp = ICON_MAP[dept.icon] || Folder;

                    return (
                        <div
                            key={dept.id}
                            onClick={() => setSelectedDeptId(dept.id)}
                            className="bg-white border-2 border-black rounded-xl p-5 shadow-neo hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm cursor-pointer transition-all flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div
                                        className="w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center text-white shadow-neo-xs"
                                        style={{ backgroundColor: dept.color }}
                                    >
                                        <IconComp className="w-5 h-5" />
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {canManageDepartments && dept.status === "active" && (
                                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleMoveDepartment(dept.id, "up", e)}
                                                    disabled={reordering || idx === 0}
                                                    className="p-1 hover:bg-neutral-100 border border-black rounded transition disabled:opacity-25"
                                                    title="Move Up in order"
                                                >
                                                    <ArrowUp className="w-3 h-3 text-black" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleMoveDepartment(dept.id, "down", e)}
                                                    disabled={reordering || idx === visibleDepartments.length - 1}
                                                    className="p-1 hover:bg-neutral-100 border border-black rounded transition disabled:opacity-25"
                                                    title="Move Down in order"
                                                >
                                                    <ArrowDown className="w-3 h-3 text-black" />
                                                </button>
                                            </div>
                                        )}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-neutral-100 border border-black rounded-full">
                                            <Users className="w-3 h-3 text-neutral-600" />
                                            {dept.memberCount ?? 0} members
                                        </span>
                                        {dept.status === "archived" && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-neutral-300 text-neutral-700 border border-black rounded">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h4 className="text-base font-black text-black group-hover:text-blue-600 transition-colors">
                                    {dept.name}
                                </h4>
                                <p className="text-xs text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                                    {dept.description || "No description provided."}
                                </p>
                            </div>

                            <div className="mt-5 pt-3 border-t-2 border-neutral-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-neutral-700">
                                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                                    <span>
                                        {dept.leadUser
                                            ? `${dept.leadUser.firstName} ${dept.leadUser.lastName}`
                                            : "No Lead Assigned"}
                                    </span>
                                </div>
                                <div className="text-neutral-400 group-hover:text-black transition">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {isCreateOpen && (
                <CreateDepartmentModal
                    clubId={clubId}
                    members={allMembers}
                    onClose={() => setIsCreateOpen(false)}
                    onCreated={() => {
                        onReload();
                    }}
                />
            )}

            {selectedDeptId && (
                <DepartmentDetailModal
                    clubId={clubId}
                    departmentId={selectedDeptId}
                    allDepartments={departments}
                    allMembers={allMembers}
                    isAdmin={isAdmin}
                    canManageDepartment={
                        isAdmin ||
                        Boolean(capabilities?.capabilities.departments.manageAll) ||
                        (selectedDeptId ? Boolean(capabilities?.leadDepartmentIds?.includes(selectedDeptId)) : false)
                    }
                    onClose={() => setSelectedDeptId(null)}
                    onUpdated={() => {
                        onReload();
                    }}
                />
            )}
        </div>
    );
};

export default DepartmentOverviewView;
