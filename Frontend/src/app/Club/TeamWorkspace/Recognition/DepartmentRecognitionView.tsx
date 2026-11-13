// Frontend/src/app/Club/TeamWorkspace/Recognition/DepartmentRecognitionView.tsx
import React, { useState, useEffect } from "react";
import {
    Building2,
    Users,
    Sparkles,
    Trophy,
    Medal,
    Award,
    TrendingUp,
    Eye,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceDepartment,
    WorkspaceMember,
    DepartmentRecognitionSummary,
} from "../../../../types/workspace";
import { MemberRecognitionProfileModal } from "./MemberRecognitionProfileModal";
import { NeoSelect } from "../../../../components/NeoSelect";

interface DepartmentRecognitionViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    currentMember: WorkspaceMember | null;
    isOwner: boolean;
    isWorkspaceManager: boolean;
}

export const DepartmentRecognitionView: React.FC<DepartmentRecognitionViewProps> = ({
    clubId,
    departments,
    currentMember,
    isOwner,
    isWorkspaceManager,
}) => {
    // Determine accessible departments
    const userDeptIds = [
        currentMember?.departmentId,
        ...(currentMember?.departments?.map((d) => d.id) || []),
    ].filter(Boolean) as string[];

    const accessibleDepartments = (isOwner || isWorkspaceManager)
        ? departments
        : departments.filter((d) => userDeptIds.includes(d.id));

    const [selectedDeptId, setSelectedDeptId] = useState<string>(
        accessibleDepartments[0]?.id || departments[0]?.id || ""
    );

    const [data, setData] = useState<DepartmentRecognitionSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Profile Modal
    const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

    const loadDepartmentData = async (deptId: string) => {
        if (!deptId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await workspaceApi.getDepartmentRecognition(deptId, clubId);
            if (res.success && res.department) {
                setData(res.department);
            } else {
                setError("Could not load department recognition summary.");
            }
        } catch (err: any) {
            console.error("[DepartmentRecognitionView] Load error:", err);
            setError(err.message || "Failed to load department recognition.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedDeptId) {
            loadDepartmentData(selectedDeptId);
        }
    }, [selectedDeptId, clubId]);

    if (accessibleDepartments.length === 0) {
        return (
            <div className="p-8 bg-white border-2 border-black rounded-3xl shadow-[4px_4px_0px_#000] text-center space-y-2">
                <Building2 className="w-8 h-8 text-neutral-400 mx-auto" />
                <h3 className="text-sm font-black text-black">No Assigned Department</h3>
                <p className="text-xs font-bold text-neutral-500 max-w-sm mx-auto">
                    You are not currently assigned to a department. Contact your workspace manager to be assigned to a department roster.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Department Selector Header */}
            <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000]">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                        <Building2 className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Department Recognition
                        </span>
                        <h3 className="text-sm font-black text-black">
                            {data?.departmentName || "Select Department"}
                        </h3>
                    </div>
                </div>

                {accessibleDepartments.length > 1 && (
                    <div className="min-w-[220px]">
                        <NeoSelect
                            value={selectedDeptId}
                            onChange={(val) => setSelectedDeptId(val)}
                            options={accessibleDepartments.map((d) => ({
                                value: d.id,
                                label: `${d.name} Department`,
                            }))}
                            triggerClassName="text-xs font-black"
                            size="sm"
                        />
                    </div>
                )}
            </div>

            {loading && (
                <div className="p-12 text-center text-xs font-bold text-neutral-500">
                    Loading department recognition metrics...
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl text-xs font-bold text-red-700">
                    {error}
                </div>
            )}

            {!loading && !error && data && (
                <div className="space-y-6">
                    {/* Metrics Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Total Department Orbits */}
                        <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Department Total
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1.5">
                                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
                                <span>{data.totalOrbits} Orbits</span>
                            </div>
                            <p className="text-[10px] font-bold text-neutral-500">
                                Collective recognition earned
                            </p>
                        </div>

                        {/* Active Members */}
                        <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Active Members
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1.5">
                                <Users className="w-5 h-5 text-blue-600" />
                                <span>{data.activeMemberCount} Teammates</span>
                            </div>
                            <p className="text-[10px] font-bold text-neutral-500">
                                Currently assigned to department
                            </p>
                        </div>

                        {/* Average Orbits Per Member */}
                        <div className="p-4 bg-[#FFE566]/20 border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                Average / Active Member
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1.5">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                <span>{data.averageOrbitsPerMember} Orbits</span>
                            </div>
                            <p className="text-[10px] font-bold text-neutral-600">
                                Mean contribution intensity
                            </p>
                        </div>
                    </div>

                    {/* Member Contributions & Rankings Table */}
                    <div className="bg-white border-2 border-black rounded-3xl shadow-[6px_6px_0px_#000] overflow-hidden">
                        <div className="p-4 border-b-2 border-black bg-neutral-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-500" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                    Department Contributor Standings
                                </h3>
                            </div>
                            <span className="text-[11px] font-bold text-neutral-500">
                                {data.memberRankings.length} members
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-neutral-100/80 border-b-2 border-black text-neutral-700 font-black uppercase text-[10px]">
                                        <th className="p-3 w-14 text-center">Rank</th>
                                        <th className="p-3">Teammate</th>
                                        <th className="p-3">Role</th>
                                        <th className="p-3">Orbits Earned</th>
                                        <th className="p-3">Awards</th>
                                        <th className="p-3">Latest Appreciation</th>
                                        <th className="p-3 text-right">Profile</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/10 font-medium">
                                    {data.memberRankings.map((m) => {
                                        const isLead = m.isLead;
                                        return (
                                            <tr
                                                key={m.userId}
                                                className="hover:bg-neutral-50/80 transition-colors"
                                            >
                                                {/* Rank Badge */}
                                                <td className="p-3 text-center">
                                                    {m.rank === 1 ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-300 border border-black shadow-neo-xxs" title="1st Place">
                                                            <Trophy className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                        </span>
                                                    ) : m.rank === 2 ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 border border-black shadow-neo-xxs" title="2nd Place">
                                                            <Medal className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                        </span>
                                                    ) : m.rank === 3 ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 border border-black shadow-neo-xxs" title="3rd Place">
                                                            <Award className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono font-black text-neutral-500 text-xs">
                                                            #{m.rank}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Member Info */}
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full border-2 border-black bg-neutral-200 overflow-hidden flex items-center justify-center font-black text-xs shrink-0">
                                                            {m.avatarUrl ? (
                                                                <img
                                                                    src={m.avatarUrl}
                                                                    alt={m.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                m.name.charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-black flex items-center gap-1.5">
                                                                {m.name}
                                                                {isLead && (
                                                                    <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-100 text-amber-800 border border-black rounded">
                                                                        Lead
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-neutral-400 font-mono">
                                                                @{m.username}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role */}
                                                <td className="p-3">
                                                    <span className="text-[11px] font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                                                        {m.roleName}
                                                    </span>
                                                </td>

                                                {/* Points */}
                                                <td className="p-3">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FFE566] border border-black rounded-lg text-xs font-black shadow-neo-xxs">
                                                        <Sparkles className="w-3 h-3 fill-black" />
                                                        <span>+{m.totalOrbits}</span>
                                                    </div>
                                                </td>

                                                {/* Awards Count */}
                                                <td className="p-3 font-bold text-neutral-700">
                                                    {m.awardsCount} awards
                                                </td>

                                                {/* Recent Appreciation */}
                                                <td className="p-3 max-w-xs">
                                                    {m.recentAppreciation ? (
                                                        <p className="text-[11px] font-medium text-neutral-600 truncate italic">
                                                            "{m.recentAppreciation}"
                                                        </p>
                                                    ) : (
                                                        <span className="text-[11px] text-neutral-400 italic">
                                                            No recent notes
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Action */}
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => setSelectedProfileUserId(m.userId)}
                                                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-black rounded-lg text-[11px] font-black shadow-neo-xxs transition flex items-center gap-1 ml-auto"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        <span>Profile</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Profile Modal */}
            <MemberRecognitionProfileModal
                isOpen={!!selectedProfileUserId}
                onClose={() => setSelectedProfileUserId(null)}
                userId={selectedProfileUserId}
                clubId={clubId}
            />
        </div>
    );
};
