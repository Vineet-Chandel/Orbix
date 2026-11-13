// Frontend/src/app/Club/TeamWorkspace/Settings/WorkspaceSettingsView.tsx
import React, { useState, useEffect } from "react";
import {
    Settings,
    UserCog,
    Save,
    RefreshCw,
    ShieldCheck,
    Building2,
    Sliders,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { OrbixLoader } from "../../../../components/ui/loader";
import type {
    TeamWorkspace,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSettingsData,
    MemberCapabilityResolution,
} from "../../../../types/workspace";
import { WorkspaceManagerModal } from "../Manager/WorkspaceManagerModal";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface WorkspaceSettingsViewProps {
    clubId: string;
    workspace: TeamWorkspace | null;
    members: WorkspaceMember[];
    roles: WorkspaceRole[];
    currentMember: WorkspaceMember | null;
    capabilities: MemberCapabilityResolution | null;
    isAdmin?: boolean;
    onRefresh: () => void;
}

export const WorkspaceSettingsView: React.FC<WorkspaceSettingsViewProps> = ({
    clubId,
    workspace,
    members,
    roles,
    currentMember,
    capabilities,
    isAdmin = false,
    onRefresh,
}) => {
    const toast = useToast();

    // Settings Data State
    const [settingsData, setSettingsData] = useState<WorkspaceSettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [defaultRoleId, setDefaultRoleId] = useState("");
    const [allowMemberChannelCreation, setAllowMemberChannelCreation] = useState(true);
    const [restrictTaskCreationToLeads, setRestrictTaskCreationToLeads] = useState(false);

    // Workspace Manager Modal State
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    const isOwner = Boolean(capabilities?.isOwner || currentMember?.role?.slug === "owner");
    const canManage = Boolean(
        capabilities?.capabilities.workspace.manageSettings || isOwner || isAdmin
    );

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getSettings(clubId);
            if (res.success && res.settings) {
                setSettingsData(res.settings);
                setName(res.settings.name);
                setDescription(res.settings.description || "");

                const custom = res.settings.customSettings || {};
                setDefaultRoleId(custom.defaultRoleId || roles.find((r) => r.slug === "member")?.id || "");
                setAllowMemberChannelCreation(custom.allowMemberChannelCreation ?? true);
                setRestrictTaskCreationToLeads(custom.restrictTaskCreationToLeads ?? false);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to load workspace settings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [clubId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) {
            toast.error("You lack permission to modify workspace settings.");
            return;
        }

        try {
            setSaving(true);
            const res = await workspaceApi.updateSettings(
                {
                    name: name.trim(),
                    description: description.trim(),
                    customSettings: {
                        defaultRoleId,
                        allowMemberChannelCreation,
                        restrictTaskCreationToLeads,
                    },
                },
                clubId
            );

            if (res.success) {
                toast.success("Workspace configurations saved successfully.");
                onRefresh();
                fetchSettings();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to save workspace settings.");
        } finally {
            setSaving(false);
        }
    };

    const currentManager = members.find((m) => m.userId === settingsData?.managerUserId);

    if (loading) {
        return (
            <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-neo flex flex-col items-center justify-center gap-3">
                <OrbixLoader size="md" />
                <span className="text-xs font-bold text-neutral-600">Loading workspace configuration...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl p-5 sm:p-6 shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-[#FFE566] border-2 border-black rounded-2xl flex items-center justify-center shadow-neo-sm">
                        <Settings className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-black">Workspace Settings & Governance</h1>
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#A6FF70] border border-black rounded-lg">
                                Delegated Admin
                            </span>
                        </div>
                        <p className="text-xs font-bold text-neutral-600 mt-0.5">
                            Manage workspace identity, governance delegation, and operational policies.
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchSettings}
                    className="px-3.5 py-2 text-xs font-black bg-white hover:bg-neutral-50 border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-6">
                {/* 1. General Identity Card */}
                <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-neo space-y-4">
                    <h3 className="text-sm font-black uppercase text-black border-b-2 border-neutral-100 pb-2.5 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-neutral-700" />
                        Workspace General Identity
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-black">Workspace Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={!canManage}
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566] disabled:opacity-60"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-black">Workspace Slug</label>
                            <input
                                type="text"
                                value={settingsData?.slug || ""}
                                disabled
                                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-neutral-100 border-2 border-neutral-300 rounded-xl cursor-not-allowed text-neutral-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-black">Description & Charter</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!canManage}
                            rows={3}
                            placeholder="State the core mission and scope of this chapter's workspace..."
                            className="w-full px-3.5 py-2 text-xs font-medium bg-[#FAF6EE] border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566] disabled:opacity-60"
                        />
                    </div>
                </div>

                {/* 2. Delegated Administration (Workspace Manager) */}
                <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-neo space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-neutral-100 pb-2.5">
                        <div>
                            <h3 className="text-sm font-black uppercase text-black flex items-center gap-2">
                                <UserCog className="w-4 h-4 text-neutral-700" />
                                Delegated Workspace Manager (Tier 2)
                            </h3>
                            <p className="text-[11px] font-medium text-neutral-500 mt-0.5">
                                The Club Owner can designate one team member as Workspace Manager with specific operational powers.
                            </p>
                        </div>

                        {isOwner && (
                            <button
                                type="button"
                                onClick={() => setIsManagerModalOpen(true)}
                                className="px-3.5 py-1.5 text-xs font-black bg-[#FFE566] hover:bg-[#FADC45] text-black border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5 self-start sm:self-auto"
                            >
                                <Sliders className="w-3.5 h-3.5" />
                                {currentManager ? "Configure Delegation" : "Designate Manager"}
                            </button>
                        )}
                    </div>

                    {currentManager ? (
                        <div className="bg-[#FAF6EE] border-2 border-black rounded-xl p-4 shadow-neo-xs flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#A6FF70] border-2 border-black rounded-xl flex items-center justify-center font-black text-black shadow-neo-xs">
                                    {currentManager.user?.firstName?.charAt(0) || "M"}
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-black">
                                        {currentManager.user?.firstName} {currentManager.user?.lastName} (@{currentManager.user?.username})
                                    </h4>
                                    <p className="text-[11px] font-bold text-neutral-600">
                                        Role: {currentManager.role?.name || "Member"} • Appointed on:{" "}
                                        {settingsData?.managerAppointedAt ? new Date(settingsData.managerAppointedAt).toLocaleDateString() : "Active"}
                                    </p>
                                </div>
                            </div>

                            <span className="px-3 py-1 text-xs font-black bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                                Active Manager
                            </span>
                        </div>
                    ) : (
                        <div className="p-4 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl text-center">
                            <p className="text-xs font-bold text-neutral-500">
                                No Workspace Manager designated. The Club Owner currently administers all operations directly.
                            </p>
                        </div>
                    )}
                </div>

                {/* 3. Operational Policies Card */}
                <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-neo space-y-4">
                    <h3 className="text-sm font-black uppercase text-black border-b-2 border-neutral-100 pb-2.5 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-neutral-700" />
                        Operational Policies & Defaults
                    </h3>

                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl">
                            <div>
                                <h4 className="text-xs font-black text-black">Default Role for New Invites</h4>
                                <p className="text-[11px] font-medium text-neutral-600">
                                    New members joining the workspace will be automatically assigned this role.
                                </p>
                            </div>
                            <div className="w-full sm:w-64">
                                <NeoSelect
                                    value={defaultRoleId}
                                    onChange={(val) => setDefaultRoleId(val)}
                                    disabled={!canManage}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={roles
                                        .filter((r) => r.slug !== "owner" && r.rank < 800)
                                        .map((r) => ({
                                            value: r.id,
                                            label: `${r.name} (Rank ${r.rank})`,
                                        }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl">
                            <div>
                                <h4 className="text-xs font-black text-black">Allow Members to Create Channels</h4>
                                <p className="text-[11px] font-medium text-neutral-600">
                                    When disabled, only Department Leads, Managers, and Admins can create new channels.
                                </p>
                            </div>
                            <NeoCheckbox
                                checked={allowMemberChannelCreation}
                                onCheckedChange={(checked) => setAllowMemberChannelCreation(checked)}
                                disabled={!canManage}
                                size="md"
                                aria-label="Allow Members to Create Channels"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl">
                            <div>
                                <h4 className="text-xs font-black text-black">Restrict Task Creation to Department Leads</h4>
                                <p className="text-[11px] font-medium text-neutral-600">
                                    Ensures that only authorized leads and coordinators can initiate new accountability tasks.
                                </p>
                            </div>
                            <NeoCheckbox
                                checked={restrictTaskCreationToLeads}
                                onCheckedChange={(checked) => setRestrictTaskCreationToLeads(checked)}
                                disabled={!canManage}
                                size="md"
                                aria-label="Restrict Task Creation to Department Leads"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                {canManage && (
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving Changes..." : "Save Workspace Configurations"}
                        </button>
                    </div>
                )}
            </form>

            {/* Manager Modal */}
            <WorkspaceManagerModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                workspace={workspace}
                members={members}
                clubId={clubId}
                onSuccess={() => {
                    setIsManagerModalOpen(false);
                    onRefresh();
                    fetchSettings();
                }}
            />
        </div>
    );
};
