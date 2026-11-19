// Frontend/src/app/Club/TeamWorkspace/Recognition/AwardOrbitsModal.tsx
import React, { useState, useMemo } from "react";
import {
    Sparkles,
    Award,
    X,
    Search,
    ChevronDown,
    Check,
    AlertCircle,
    CheckCircle2,
    Link as LinkIcon,
    Eye,
    Coins,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceMember,
    WorkspaceDepartment,
    WorkspaceRecognitionCategory,
    WorkspaceRecognitionPolicy,
    WorkspaceTask,
} from "../../../../types/workspace";
import { NeoSelect } from "../../../../components/NeoSelect";

interface AwardOrbitsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    members: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    categories: WorkspaceRecognitionCategory[];
    policy: WorkspaceRecognitionPolicy | null;
    currentMember: WorkspaceMember | null;
    isOwner: boolean;
    isWorkspaceManager: boolean;
    remainingBudget?: number;
    tasks?: WorkspaceTask[];
    onAwardSuccess: (award: any) => void;
}

export const AwardOrbitsModal: React.FC<AwardOrbitsModalProps> = ({
    isOpen,
    onClose,
    clubId,
    members,
    departments,
    categories,
    policy,
    currentMember,
    isOwner,
    isWorkspaceManager,
    remainingBudget,
    tasks = [],
    onAwardSuccess,
}) => {
    // Form fields
    const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
    const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("");
    const [amount, setAmount] = useState<number>(15);
    const [reason, setReason] = useState<string>("");
    const [linkedTaskId, setLinkedTaskId] = useState<string>("");
    const [evidenceUrl, setEvidenceUrl] = useState<string>("");
    const [visibility, setVisibility] = useState<"workspace" | "recipient_only">("workspace");

    // UI state
    const [recipientSearch, setRecipientSearch] = useState<string>("");
    const [isRecipientDropdownOpen, setIsRecipientDropdownOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [confirmedAward, setConfirmedAward] = useState<any | null>(null);

    // Dynamic policy bounds
    const minPoints = policy?.minPointsPerAward ?? 5;
    const maxPoints = policy?.maxPointsPerAward ?? 50;
    const minReasonLen = policy?.minReasonLength ?? 15;

    // Filter eligible recipients based on strict hierarchy rules:
    // - Club Manager (Owner): can award anyone except themselves
    // - Workspace Manager: can award leads (rank 600) and members (rank 200). Cannot award Owner or peer managers (rank >= 800)
    // - Exclude suspended or inactive members
    const eligibleRecipients = useMemo(() => {
        if (!currentMember && !isOwner) return [];
        return members.filter((m) => {
            // Cannot self-award
            if (currentMember && m.userId === currentMember.userId) return false;
            // Institutional club identity accounts cannot receive personal Orbits
            if (m.user?.accountType === "club") return false;
            // Must be active and not suspended
            if (m.isSuspended || m.membershipStatus !== "active") return false;

            const targetRank = m.role?.rank ?? 200;
            const targetSlug = m.role?.slug ?? "member";

            if (isOwner) {
                // Owner has supreme power over everyone
                return true;
            }

            if (isWorkspaceManager) {
                // Cannot award owner or users with rank >= 800 (peer managers)
                if (targetSlug === "owner" || targetRank >= 800) return false;
                return true;
            }

            // Regular members / leads (only if delegated)
            return targetRank < (currentMember?.role?.rank ?? 200);
        });
    }, [members, currentMember, isOwner, isWorkspaceManager]);

    // Filtered list based on search text (Name, Username, Department, Role)
    const filteredRecipients = useMemo(() => {
        const q = recipientSearch.toLowerCase().trim();
        if (!q) return eligibleRecipients;

        const deptMap = new Map(departments.map((d) => [d.id, d.name.toLowerCase()]));

        return eligibleRecipients.filter((m) => {
            const name = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.toLowerCase();
            const username = (m.user?.username || "").toLowerCase();
            const role = (m.roleTitle || m.role?.name || "").toLowerCase();
            const dept = m.departmentId ? deptMap.get(m.departmentId) || "" : "";
            return (
                name.includes(q) ||
                username.includes(q) ||
                role.includes(q) ||
                dept.includes(q)
            );
        });
    }, [eligibleRecipients, recipientSearch, departments]);

    const selectedRecipient = useMemo(() => {
        return members.find((m) => m.userId === selectedRecipientId) || null;
    }, [members, selectedRecipientId]);

    // Predefined quick chips within policy range
    const quickChips = [5, 10, 15, 25, 50].filter(
        (val) => val >= minPoints && val <= maxPoints
    );

    const handleSelectRecipient = (member: WorkspaceMember) => {
        setSelectedRecipientId(member.userId);
        if (member.departmentId) {
            setSelectedDepartmentId(member.departmentId);
        }
        setIsRecipientDropdownOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!selectedRecipientId) {
            setErrorMsg("Please select an eligible recipient.");
            return;
        }

        if (!selectedCategorySlug) {
            setErrorMsg("Please select an appreciation category.");
            return;
        }

        if (amount < minPoints || amount > maxPoints) {
            setErrorMsg(`Award amount must be between ${minPoints} and ${maxPoints} Orbits.`);
            return;
        }

        if (reason.trim().length < minReasonLen) {
            setErrorMsg(`Appreciation reason must be at least ${minReasonLen} characters.`);
            return;
        }

        if (!isOwner && isWorkspaceManager && remainingBudget !== undefined && amount > remainingBudget) {
            setErrorMsg(`Insufficient monthly budget. You have ${remainingBudget} Orbits remaining.`);
            return;
        }

        setSubmitting(true);
        try {
            // Generate idempotency key for this award attempt
            const idempotencyKey = `award_${currentMember?.userId || "club-owner"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

            const res = await workspaceApi.awardOrbits(
                {
                    recipientUserId: selectedRecipientId,
                    amount,
                    categorySlugOrId: selectedCategorySlug,
                    reason: reason.trim(),
                    visibility,
                    departmentId: selectedDepartmentId || undefined,
                    linkedTaskId: linkedTaskId || undefined,
                    evidenceUrl: evidenceUrl.trim() || undefined,
                    idempotencyKey,
                },
                clubId
            );

            if (res.success && res.award) {
                setConfirmedAward(res.award);
                onAwardSuccess(res.award);
            } else {
                setErrorMsg(res.message || "Failed to award Orbits.");
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message || err.message || "An error occurred while awarding Orbits.";
            setErrorMsg(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetForm = () => {
        setSelectedRecipientId("");
        setSelectedDepartmentId("");
        setSelectedCategorySlug("");
        setAmount(15);
        setReason("");
        setLinkedTaskId("");
        setEvidenceUrl("");
        setErrorMsg(null);
        setConfirmedAward(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-[#FFE566] border-b-2 border-black flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-black">Award Orbits</h2>
                            <p className="text-xs font-bold text-neutral-700">
                                Recognize contributions with permanent Orbits appreciation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Confirmation Screen */}
                    {confirmedAward ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-[#A6FF70] border-2 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_#000]">
                                <CheckCircle2 className="w-10 h-10 text-black" />
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1 bg-[#FFE566] border-2 border-black rounded-full text-xs font-black shadow-[2px_2px_0px_#000] mb-2">
                                    +{confirmedAward.pointsDelta} Orbits Awarded!
                                </span>
                                <h3 className="text-lg font-black text-black">
                                    Recognition Successfully Recorded
                                </h3>
                                <p className="text-xs font-bold text-neutral-600 mt-1 max-w-md mx-auto">
                                    The award has been permanently committed to the immutable PostgreSQL
                                    ledger and in-app notifications have been delivered to{" "}
                                    <span className="font-black text-black">
                                        {selectedRecipient?.user?.firstName || "the recipient"}
                                    </span>
                                    .
                                </p>
                            </div>

                            <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl text-left text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-neutral-600">Transaction ID:</span>
                                    <span className="font-mono font-bold text-black text-[11px]">
                                        {confirmedAward.id}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-neutral-600">Category:</span>
                                    <span className="font-bold text-black">
                                        {confirmedAward.categoryName || selectedCategorySlug}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-neutral-600">Reason:</span>
                                    <span className="font-medium text-neutral-800 italic truncate max-w-[280px]">
                                        "{confirmedAward.appreciationReason}"
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={handleResetForm}
                                    className="px-4 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] transition active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    Award Another Member
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2 bg-[#A6FF70] hover:bg-[#90f25a] border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] transition active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-red-100 border-2 border-black rounded-xl flex items-start gap-2 shadow-[2px_2px_0px_#000]">
                                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-xs font-bold text-red-900">{errorMsg}</p>
                                </div>
                            )}

                            {/* Issuer Budget Banner (for Workspace Managers) */}
                            {!isOwner && isWorkspaceManager && remainingBudget !== undefined && (
                                <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl flex items-center justify-between text-xs font-bold shadow-[2px_2px_0px_#000]">
                                    <span className="flex items-center gap-1.5 text-neutral-700">
                                        <Coins className="w-4 h-4 text-amber-600" />
                                        Monthly Budget Available:
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 border border-black rounded-lg font-black ${
                                            remainingBudget >= amount ? "bg-[#A6FF70]" : "bg-red-200"
                                        }`}
                                    >
                                        {remainingBudget} Orbits
                                    </span>
                                </div>
                            )}

                            {/* 1. Recipient Selector Combobox */}
                            <div className="space-y-1.5 relative">
                                <label className="block text-xs font-black text-black uppercase tracking-wider">
                                    Recipient <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsRecipientDropdownOpen(!isRecipientDropdownOpen)}
                                        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border-2 border-black rounded-xl text-xs font-bold text-left shadow-[2px_2px_0px_#000] hover:bg-neutral-50 transition"
                                    >
                                        {selectedRecipient ? (
                                            <span className="flex items-center gap-2 truncate">
                                                <span className="w-6 h-6 rounded-full bg-[#FFE566] border border-black flex items-center justify-center text-[10px] font-black shrink-0">
                                                    {(selectedRecipient.user?.firstName || "U")[0]}
                                                </span>
                                                <span className="font-black text-black">
                                                    {selectedRecipient.user?.firstName}{" "}
                                                    {selectedRecipient.user?.lastName}
                                                </span>
                                                <span className="text-neutral-500 font-mono text-[11px]">
                                                    (@{selectedRecipient.user?.username})
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.2 bg-neutral-100 border border-black rounded font-medium">
                                                    {selectedRecipient.roleTitle || selectedRecipient.role?.name}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-neutral-500">
                                                Search teammate by name, username or department...
                                            </span>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-black shrink-0" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isRecipientDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] z-30 max-h-56 flex flex-col overflow-hidden">
                                            {/* Search Input */}
                                            <div className="p-2 border-b-2 border-black bg-[#FAF6EE]">
                                                <div className="relative">
                                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
                                                    <input
                                                        type="text"
                                                        value={recipientSearch}
                                                        onChange={(e) => setRecipientSearch(e.target.value)}
                                                        placeholder="Type name, username or department..."
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border-2 border-black rounded-lg focus:outline-none focus:bg-white"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            {/* Results List */}
                                            <div className="overflow-y-auto divide-y divide-neutral-200">
                                                {filteredRecipients.length === 0 ? (
                                                    <div className="p-3 text-center text-xs font-bold text-neutral-500">
                                                        No eligible teammates found.
                                                    </div>
                                                ) : (
                                                    filteredRecipients.map((m) => (
                                                        <button
                                                            key={m.userId}
                                                            type="button"
                                                            onClick={() => handleSelectRecipient(m)}
                                                            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#FFE566]/30 transition text-xs"
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="w-6 h-6 rounded-full bg-neutral-100 border border-black flex items-center justify-center text-[10px] font-black shrink-0">
                                                                    {(m.user?.firstName || "U")[0]}
                                                                </span>
                                                                <div className="truncate">
                                                                    <div className="font-black text-black truncate">
                                                                        {m.user?.firstName} {m.user?.lastName}
                                                                        <span className="text-neutral-500 font-mono text-[10px] ml-1.5">
                                                                            @{m.user?.username}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-neutral-500 truncate">
                                                                        {m.roleTitle || m.role?.name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {selectedRecipientId === m.userId && (
                                                                <Check className="w-4 h-4 text-black shrink-0" />
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Department & Category Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Department */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider">
                                        Department (Optional)
                                    </label>
                                    <NeoSelect
                                        value={selectedDepartmentId}
                                        onChange={(val) => setSelectedDepartmentId(val)}
                                        size="sm"
                                        triggerClassName="w-full text-xs font-bold"
                                        options={[
                                            { value: "", label: "General Workspace" },
                                            ...departments.map((d) => ({ value: d.id, label: d.name })),
                                        ]}
                                    />
                                </div>

                                {/* Category */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <NeoSelect
                                        value={selectedCategorySlug}
                                        onChange={(val) => setSelectedCategorySlug(val)}
                                        placeholder="Select a Category..."
                                        size="sm"
                                        triggerClassName="w-full text-xs font-bold"
                                        options={[
                                            { value: "", label: "Select a Category..." },
                                            ...categories
                                                .filter((c) => c.isActive)
                                                .map((c) => ({ value: c.slug, label: c.name })),
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* 3. Points Amount */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider">
                                        Orbits Amount <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[11px] font-bold text-neutral-500">
                                        Allowed: {minPoints} - {maxPoints} Orbits
                                    </span>
                                </div>

                                {/* Quick Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {quickChips.map((chipVal) => (
                                        <button
                                            key={chipVal}
                                            type="button"
                                            onClick={() => setAmount(chipVal)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition active:translate-x-[1px] active:translate-y-[1px] ${
                                                amount === chipVal
                                                    ? "bg-[#FFE566] shadow-[2px_2px_0px_#000] translate-x-[1px] translate-y-[1px]"
                                                    : "bg-white hover:bg-neutral-50 shadow-[1.5px_1.5px_0px_#000]"
                                            }`}
                                        >
                                            +{chipVal} Orbits
                                        </button>
                                    ))}
                                </div>

                                {/* Custom Numeric Input */}
                                <div className="pt-1">
                                    <input
                                        type="number"
                                        min={minPoints}
                                        max={maxPoints}
                                        value={amount}
                                        onChange={(e) => setAmount(parseInt(e.target.value, 10) || minPoints)}
                                        className="w-full px-3.5 py-2 bg-white border-2 border-black rounded-xl text-xs font-black focus:outline-none shadow-[2px_2px_0px_#000]"
                                        placeholder="Enter custom integer points..."
                                    />
                                </div>
                            </div>

                            {/* 4. Appreciation Reason */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider">
                                        Appreciation Reason <span className="text-red-500">*</span>
                                    </label>
                                    <span
                                        className={`text-[11px] font-bold ${
                                            reason.trim().length >= minReasonLen
                                                ? "text-emerald-700"
                                                : "text-amber-700"
                                        }`}
                                    >
                                        {reason.trim().length} / {minReasonLen} min chars
                                    </span>
                                </div>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    placeholder="Describe specific high-impact contributions, leadership, or support provided by this teammate..."
                                    className="w-full px-3.5 py-2.5 bg-white border-2 border-black rounded-xl text-xs font-medium focus:outline-none shadow-[2px_2px_0px_#000] resize-none"
                                />
                            </div>

                            {/* 5. Optional Related Task & Evidence */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Related Task */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider flex items-center gap-1">
                                        <Award className="w-3.5 h-3.5" />
                                        Related Task
                                    </label>
                                    <NeoSelect
                                        value={linkedTaskId}
                                        onChange={(val) => setLinkedTaskId(val)}
                                        placeholder="None / Not linked"
                                        size="sm"
                                        triggerClassName="w-full text-xs font-bold"
                                        options={[
                                            { value: "", label: "None / Not linked" },
                                            ...tasks.map((t) => ({
                                                value: t.id,
                                                label: `${t.title} (${t.status})`,
                                            })),
                                        ]}
                                    />
                                </div>

                                {/* Evidence URL */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-black uppercase tracking-wider flex items-center gap-1">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        Evidence URL
                                    </label>
                                    <input
                                        type="url"
                                        value={evidenceUrl}
                                        onChange={(e) => setEvidenceUrl(e.target.value)}
                                        placeholder="https://github.com/... or PR link"
                                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-medium focus:outline-none shadow-[2px_2px_0px_#000]"
                                    />
                                </div>
                            </div>

                            {/* Award Visibility */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black uppercase tracking-wider flex items-center gap-1">
                                    <Eye className="w-3.5 h-3.5 text-neutral-600" />
                                    Award Visibility
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setVisibility("workspace")}
                                        className={`px-3 py-2 rounded-xl border-2 border-black text-xs font-black transition ${
                                            visibility === "workspace"
                                                ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "bg-white hover:bg-neutral-50 shadow-neo-xxs text-neutral-600"
                                        }`}
                                    >
                                        Workspace Visible
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVisibility("recipient_only")}
                                        className={`px-3 py-2 rounded-xl border-2 border-black text-xs font-black transition ${
                                            visibility === "recipient_only"
                                                ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "bg-white hover:bg-neutral-50 shadow-neo-xxs text-neutral-600"
                                        }`}
                                    >
                                        Recipient Only (Private)
                                    </button>
                                </div>
                            </div>

                            {/* Submit & Cancel */}
                            <div className="pt-3 border-t-2 border-black flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600">
                                    <Eye className="w-3.5 h-3.5 text-neutral-500" />
                                    <span>Award will be recorded in workspace history</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={submitting}
                                        className="px-4 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 bg-[#FFE566] hover:bg-[#fedb33] text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-2"
                                    >
                                        {submitting ? (
                                            <span>Recording...</span>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 fill-black" />
                                                <span>Award +{amount} Orbits</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
