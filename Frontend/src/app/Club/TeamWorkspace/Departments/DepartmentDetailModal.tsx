// Frontend/src/app/Club/TeamWorkspace/Departments/DepartmentDetailModal.tsx
import React, { useState, useEffect } from "react";
import {
    X,
    Users,
    Shield,
    UserPlus,
    ArrowRightLeft,
    Trash2,
    Archive,
    RotateCcw,
    Edit3,
    UserCheck,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { OrbixLoader } from "../../../../components/ui/loader";
import { NeoSelect } from "../../../../components/NeoSelect";
import type {
    WorkspaceDepartment,
    WorkspaceDepartmentMember,
    WorkspaceMember,
} from "../../../../types/workspace";

interface DepartmentDetailModalProps {
    clubId: string;
    departmentId: string;
    allDepartments: WorkspaceDepartment[];
    allMembers: WorkspaceMember[];
    isAdmin: boolean;
    canManageDepartment?: boolean;
    onClose: () => void;
    onUpdated: () => void;
}

export const DepartmentDetailModal: React.FC<DepartmentDetailModalProps> = ({
    clubId,
    departmentId,
    allDepartments,
    allMembers,
    isAdmin,
    canManageDepartment = false,
    onClose,
    onUpdated,
}) => {
    const toast = useToast();
    const [department, setDepartment] = useState<WorkspaceDepartment | null>(null);
    const [members, setMembers] = useState<WorkspaceDepartmentMember[]>([]);
    const [loading, setLoading] = useState(true);

    const canManage = isAdmin || canManageDepartment;

    // Add Member sub-state
    const [selectedAddMemberId, setSelectedAddMemberId] = useState("");
    const [addingMember, setAddingMember] = useState(false);

    // Transfer sub-state
    const [transferringMember, setTransferringMember] = useState<WorkspaceDepartmentMember | null>(null);
    const [targetDeptId, setTargetDeptId] = useState("");
    const [transferring, setTransferring] = useState(false);

    // Change Lead sub-state
    const [isChangingLead, setIsChangingLead] = useState(false);
    const [newLeadUserId, setNewLeadUserId] = useState("");

    // Edit Department Details sub-state
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editColor, setEditColor] = useState("#4F46E5");
    const [savingDetails, setSavingDetails] = useState(false);

    // Scoped Role Assignment sub-state
    const [editingRoleMember, setEditingRoleMember] = useState<WorkspaceDepartmentMember | null>(null);
    const [scopedRole, setScopedRole] = useState<"lead" | "co_lead" | "member">("member");
    const [scopedTitle, setScopedTitle] = useState("");
    const [savingScopedRole, setSavingScopedRole] = useState(false);

    const loadDetails = async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getDepartmentDetails(departmentId, clubId);
            if (res.success) {
                setDepartment(res.department);
                setMembers(res.members || []);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to load department details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetails();
    }, [departmentId]);

    const handleAddMember = async () => {
        if (!selectedAddMemberId) return;
        try {
            setAddingMember(true);
            const res = await workspaceApi.addDepartmentMember(
                departmentId,
                { memberId: selectedAddMemberId },
                clubId
            );
            if (res.success) {
                toast.success(res.message);
                setSelectedAddMemberId("");
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to add member to department.");
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            const res = await workspaceApi.removeDepartmentMember(departmentId, memberId, clubId);
            if (res.success) {
                toast.success(res.message);
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to remove member.");
        }
    };

    const handleTransferMember = async () => {
        if (!transferringMember || !targetDeptId) return;
        try {
            setTransferring(true);
            const res = await workspaceApi.transferDepartmentMember(
                {
                    memberId: transferringMember.memberId,
                    fromDeptId: departmentId,
                    toDeptId: targetDeptId,
                },
                clubId
            );
            if (res.success) {
                toast.success(res.message);
                setTransferringMember(null);
                setTargetDeptId("");
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to transfer member.");
        } finally {
            setTransferring(false);
        }
    };

    const handleSaveLead = async () => {
        try {
            const res = await workspaceApi.updateDepartment(
                departmentId,
                { leadUserId: newLeadUserId || null },
                clubId
            );
            if (res.success) {
                toast.success("Department lead updated successfully.");
                setIsChangingLead(false);
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update department lead.");
        }
    };

    const handleSaveDetails = async () => {
        if (!editName.trim()) return toast.error("Department name cannot be empty.");
        try {
            setSavingDetails(true);
            const res = await workspaceApi.updateDepartment(
                departmentId,
                {
                    name: editName.trim(),
                    description: editDesc.trim(),
                    color: editColor,
                },
                clubId
            );
            if (res.success) {
                toast.success("Department details updated.");
                setIsEditingDetails(false);
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update department.");
        } finally {
            setSavingDetails(false);
        }
    };

    const handleSaveScopedRole = async () => {
        if (!editingRoleMember) return;
        try {
            setSavingScopedRole(true);
            const res = await workspaceApi.updateDepartmentMemberRole(
                departmentId,
                editingRoleMember.memberId,
                {
                    departmentRole: scopedRole,
                    roleTitle: scopedTitle.trim() || undefined,
                },
                clubId
            );
            if (res.success) {
                toast.success("Scoped department role updated.");
                setEditingRoleMember(null);
                await loadDetails();
                onUpdated();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update department role.");
        } finally {
            setSavingScopedRole(false);
        }
    };

    const handleToggleArchive = async () => {
        if (!department) return;
        try {
            if (department.status === "active") {
                await workspaceApi.archiveDepartment(departmentId, clubId);
                toast.success("Department archived.");
            } else {
                await workspaceApi.restoreDepartment(departmentId, clubId);
                toast.success("Department restored to active status.");
            }
            await loadDetails();
            onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Failed to update status.");
        }
    };

    // Candidates not already in this department
    const candidateMembers = allMembers.filter(
        (m) => !members.some((dm) => dm.memberId === m.id) && !m.isSuspended
    );

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white border-2 border-black rounded-2xl p-8 max-w-md w-full shadow-neo text-center">
                    <OrbixLoader size="md" />
                    <p className="mt-3 font-bold text-xs text-neutral-600">Loading department details...</p>
                </div>
            </div>
        );
    }

    if (!department) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-2xl w-full p-6 shadow-neo max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b-2 border-black">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center font-black text-xl text-white shadow-neo-xs"
                            style={{ backgroundColor: department.color }}
                        >
                            {department.name.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-black text-black">{department.name}</h2>
                                <span
                                    className={`px-2 py-0.5 text-[10px] font-black border border-black rounded ${
                                        department.status === "active"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-neutral-200 text-neutral-700"
                                    }`}
                                >
                                    {department.status.toUpperCase()}
                                </span>
                                {canManage && !isEditingDetails && (
                                    <button
                                        onClick={() => {
                                            setEditName(department.name);
                                            setEditDesc(department.description || "");
                                            setEditColor(department.color || "#4F46E5");
                                            setIsEditingDetails(true);
                                        }}
                                        className="px-2 py-0.5 text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-black rounded flex items-center gap-1 shadow-neo-xxs"
                                        title="Edit department name, description, and color"
                                    >
                                        <Edit3 className="w-3 h-3" /> Edit Details
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-neutral-600 mt-0.5 font-medium">
                                {department.description || "No department description provided."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-500 hover:text-black border-2 border-transparent hover:border-black rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Edit Department Details Inline Box */}
                {isEditingDetails && (
                    <div className="mt-4 p-4 bg-yellow-50 border-2 border-black rounded-xl space-y-3 shadow-neo-xs animate-in fade-in">
                        <div className="font-black text-xs uppercase text-neutral-800">Edit Department Details</div>
                        <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">Department Name</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                placeholder="e.g. Technical Department"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">Description</label>
                            <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-1.5 text-xs font-medium border-2 border-black rounded-lg bg-white"
                                placeholder="Operational scope and core responsibilities..."
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-neutral-700 block mb-1">Theme Color</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#db2777", "#0891b2", "#111827"].map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setEditColor(c)}
                                        className={`w-6 h-6 rounded-md border-2 border-black transition ${editColor === c ? "scale-125 ring-2 ring-black" : ""}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={handleSaveDetails}
                                disabled={savingDetails}
                                className="px-4 py-1.5 bg-[#A6FF70] hover:bg-[#92ec5d] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs transition"
                            >
                                {savingDetails ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                                onClick={() => setIsEditingDetails(false)}
                                className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs border border-black rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Designated Leads Card */}
                <div className="mt-5 p-4 bg-neutral-50 border-2 border-black rounded-xl shadow-neo-xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 border-2 border-black rounded-lg">
                                <Shield className="w-5 h-5 text-blue-700" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase text-neutral-500">Designated Primary Lead</div>
                                <div className="font-bold text-sm text-black">
                                    {department.leadUser
                                        ? `${department.leadUser.firstName} ${department.leadUser.lastName} (@${department.leadUser.username})`
                                        : "No Lead Assigned"}
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <button
                                onClick={() => setIsChangingLead(!isChangingLead)}
                                className="px-3 py-1 text-xs font-bold bg-white hover:bg-neutral-100 border border-black rounded-lg transition"
                            >
                                {isChangingLead ? "Cancel" : "Change Lead"}
                            </button>
                        )}
                    </div>

                    {/* Co-Leads Display */}
                    {department.coLeadUserIds && department.coLeadUserIds.length > 0 && (
                        <div className="pt-2 border-t border-neutral-200">
                            <div className="text-[10px] font-black uppercase text-neutral-500 mb-1">Designated Co-Leads</div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {allMembers
                                    .filter((m) => department.coLeadUserIds?.includes(m.userId))
                                    .map((m) => (
                                        <span
                                            key={m.userId}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-black rounded-md"
                                        >
                                            <UserCheck className="w-3 h-3 text-amber-700" />
                                            {m.user?.firstName || m.user?.username} (@{m.user?.username})
                                        </span>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Change Lead Inline Form */}
                {isChangingLead && (
                    <div className="mt-3 p-3 bg-neutral-100 border-2 border-black rounded-xl flex items-center gap-2">
                        <div className="flex-1">
                            <NeoSelect
                                value={newLeadUserId}
                                onChange={(val) => setNewLeadUserId(val)}
                                size="sm"
                                triggerClassName="w-full text-xs font-bold"
                                options={[
                                    { value: "", label: "Remove Lead (Leave Unassigned)" },
                                    ...allMembers.map((m) => ({
                                        value: m.userId,
                                        label: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.username || m.userId,
                                        description: `@${m.user?.username}`,
                                    })),
                                ]}
                            />
                        </div>
                        <button
                            onClick={handleSaveLead}
                            className="px-3 py-2 bg-[#A6FF70] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs hover:bg-[#92ec5d] transition"
                        >
                            Save Lead
                        </button>
                    </div>
                )}

                {/* Add Member Bar */}
                {canManage && department.status === "active" && (
                    <div className="mt-5 flex items-center gap-2">
                        <div className="flex-1">
                            <NeoSelect
                                value={selectedAddMemberId}
                                onChange={(val) => setSelectedAddMemberId(val)}
                                size="sm"
                                placeholder={`Select workspace member to assign to ${department.name}...`}
                                triggerClassName="w-full text-xs font-bold"
                                options={[
                                    { value: "", label: `Select member to assign to ${department.name}...` },
                                    ...candidateMembers.map((m) => ({
                                        value: m.id,
                                        label: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.username || m.id,
                                        description: m.roleTitle,
                                    })),
                                ]}
                            />
                        </div>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedAddMemberId || addingMember}
                            className="px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-bold text-xs border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Member
                        </button>
                    </div>
                )}

                {/* Members Roster Table */}
                <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase text-neutral-600 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-black" /> Department Roster ({members.length})
                        </h4>
                        <span className="text-[11px] text-neutral-500 font-medium">
                            Members can belong to multiple departments concurrently.
                        </span>
                    </div>

                    <div className="overflow-x-auto border-2 border-black rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-neutral-100 border-b-2 border-black font-black uppercase text-neutral-700">
                                    <th className="p-2.5">Member</th>
                                    <th className="p-2.5">Dept Role</th>
                                    <th className="p-2.5">Joined Dept</th>
                                    {canManage && <th className="p-2.5 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y border-black font-medium">
                                {members.map((m) => {
                                    const fullName = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.username || "Unknown";
                                    const isLead = m.departmentRole === "lead";

                                    return (
                                        <tr key={m.id} className="hover:bg-neutral-50">
                                            <td className="p-2.5">
                                                <div className="font-bold text-black flex items-center gap-1.5">
                                                    {fullName}
                                                    {isLead && (
                                                        <span className="px-1.5 py-0.2 text-[9px] bg-blue-100 text-blue-800 border border-black rounded font-black">
                                                            Lead
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-neutral-500 font-mono">@{m.user?.username}</div>
                                            </td>

                                            <td className="p-2.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border border-black ${
                                                        m.departmentRole === "lead"
                                                            ? "bg-blue-100 text-blue-900"
                                                            : m.departmentRole === "co_lead"
                                                            ? "bg-amber-100 text-amber-900"
                                                            : "bg-neutral-100 text-neutral-800"
                                                    }`}>
                                                        {m.departmentRole === "lead" ? "Lead" : m.departmentRole === "co_lead" ? "Co-Lead" : "Member"}
                                                    </span>
                                                    {m.roleTitle && m.roleTitle !== "Department Member" && (
                                                        <span className="text-[10px] font-bold text-neutral-600">
                                                            ({m.roleTitle})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-2.5 text-neutral-600">
                                                {new Date(m.joinedAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </td>

                                            {canManage && (
                                                <td className="p-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRoleMember(m);
                                                                setScopedRole(m.departmentRole as any || "member");
                                                                setScopedTitle(m.roleTitle || "");
                                                            }}
                                                            className="px-2 py-1 text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-black rounded shadow-neo-xs flex items-center gap-1"
                                                            title="Assign department-scoped role & title"
                                                        >
                                                            <Shield className="w-3 h-3 text-neutral-600" /> Role
                                                        </button>
                                                        {allDepartments.length > 1 && (
                                                            <button
                                                                onClick={() => setTransferringMember(m)}
                                                                className="px-2 py-1 text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-black rounded shadow-neo-xs flex items-center gap-1"
                                                                title="Transfer to another department"
                                                            >
                                                                <ArrowRightLeft className="w-3 h-3" /> Transfer
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveMember(m.memberId)}
                                                            className="p-1 text-red-600 hover:text-red-800 border border-transparent hover:border-black rounded transition"
                                                            title="Remove from department"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}

                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={canManage ? 4 : 3} className="p-6 text-center text-neutral-500 font-bold">
                                            No members assigned to this department yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Transfer Modal Sub-dialog */}
                {transferringMember && (
                    <div className="mt-4 p-4 bg-amber-50 border-2 border-black rounded-xl">
                        <div className="text-xs font-black text-black mb-1">
                            Transfer @{transferringMember.user?.username} to another department
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1">
                                <NeoSelect
                                    value={targetDeptId}
                                    onChange={(val) => setTargetDeptId(val)}
                                    size="sm"
                                    placeholder="Select target department..."
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "", label: "Select target department..." },
                                        ...allDepartments
                                            .filter((d) => d.id !== departmentId && d.status === "active")
                                            .map((d) => ({ value: d.id, label: d.name })),
                                    ]}
                                />
                            </div>
                            <button
                                onClick={handleTransferMember}
                                disabled={!targetDeptId || transferring}
                                className="px-3 py-2 bg-[#A6FF70] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs hover:bg-[#92ec5d] transition disabled:opacity-50"
                            >
                                {transferring ? "Transferring..." : "Confirm Transfer"}
                            </button>
                            <button
                                onClick={() => setTransferringMember(null)}
                                className="px-2 py-1.5 text-xs font-bold text-neutral-600 hover:text-black"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Scoped Role Assignment Sub-dialog */}
                {editingRoleMember && (
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-black rounded-xl space-y-3 shadow-neo-xs animate-in fade-in">
                        <div className="text-xs font-black text-black">
                            Assign Department Role: @{editingRoleMember.user?.username}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">Hierarchy Position</label>
                                <NeoSelect
                                    value={scopedRole}
                                    onChange={(val) => setScopedRole(val as any)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "member", label: "Department Member" },
                                        { value: "co_lead", label: "Department Co-Lead" },
                                        { value: "lead", label: "Department Lead" },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">Custom Role Title</label>
                                <input
                                    type="text"
                                    value={scopedTitle}
                                    onChange={(e) => setScopedTitle(e.target.value)}
                                    placeholder="e.g. Lead Engineer, Senior Designer"
                                    className="w-full px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleSaveScopedRole}
                                disabled={savingScopedRole}
                                className="px-3 py-1.5 bg-[#A6FF70] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs hover:bg-[#92ec5d] transition"
                            >
                                {savingScopedRole ? "Saving..." : "Save Scoped Role"}
                            </button>
                            <button
                                onClick={() => setEditingRoleMember(null)}
                                className="px-2 py-1.5 text-xs font-bold text-neutral-600 hover:text-black"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                <div className="mt-6 pt-4 border-t-2 border-black flex items-center justify-between">
                    {isAdmin && (
                        <button
                            onClick={handleToggleArchive}
                            className={`px-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg flex items-center gap-1.5 ${
                                department.status === "active"
                                    ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                                    : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                            }`}
                        >
                            {department.status === "active" ? (
                                <>
                                    <Archive className="w-3.5 h-3.5" /> Archive Department
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" /> Restore Department
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black font-black text-xs border-2 border-black rounded-lg ml-auto"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepartmentDetailModal;
