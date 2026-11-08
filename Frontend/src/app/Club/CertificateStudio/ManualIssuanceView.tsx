import React, { useState, useEffect, useMemo } from "react";
import {
    Search,
    Check,
    Send,
    Layers,
    ShieldCheck,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchClubEligibleRecipients,
    type EligibleRecipient,
} from "../../../api/clubCertificatesApi";
import {
    issueCertificateBatch,
    type BatchIssuancePayload,
} from "../../../api/certificateStudioApi";
import type { CertificateDesign } from "../../../types/certificateStudio";

interface ManualIssuanceViewProps {
    clubId: string;
    design: CertificateDesign;
    templateId?: string | null;
    templateName?: string;
    onBatchIssued: (batchId: string) => void;
    onNavigateToTemplates?: () => void;
    onOpenPreview?: () => void;
}

export const ManualIssuanceView: React.FC<ManualIssuanceViewProps> = ({
    design,
    templateId,
    templateName,
    onBatchIssued,
    onNavigateToTemplates,
    onOpenPreview,
}) => {
    const toast = useToast();

    const [eligibleRecipients, setEligibleRecipients] = useState<EligibleRecipient[]>([]);
    const [loadingRecipients, setLoadingRecipients] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [credibilityFilter, setCredibilityFilter] = useState<string>("all");

    // Selection
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    // Metadata form
    const [title, setTitle] = useState("Certificate of Appreciation");
    const [certType, setCertType] = useState<
        "appreciation" | "merit" | "excellence" | "contributor" | "organizer" | "participation"
    >("appreciation");
    const [awardPosition, setAwardPosition] = useState("");
    const [description, setDescription] = useState("");
    const [signerName, setSignerName] = useState("");
    const [signerRole, setSignerRole] = useState("Club President");

    // Issuing state
    const [isIssuing, setIsIssuing] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoadingRecipients(true);
            try {
                const list = await fetchClubEligibleRecipients();
                setEligibleRecipients(list);
            } catch (err: any) {
                console.error("Failed to load recipients:", err);
                toast.error(err.message || "Failed to load campus network.");
            } finally {
                setLoadingRecipients(false);
            }
        };
        load();
    }, [toast]);

    const filteredRecipients = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return eligibleRecipients.filter((r) => {
            if (credibilityFilter !== "all" && r.credibilityCategory !== credibilityFilter) {
                return false;
            }
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                r.username.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q)
            );
        });
    }, [eligibleRecipients, searchQuery, credibilityFilter]);

    const toggleSelect = (userId: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const selectAllCurrent = () => {
        setSelectedUserIds(new Set(filteredRecipients.map((r) => r.id)));
    };

    const deselectAll = () => {
        setSelectedUserIds(new Set());
    };

    const handleDispatch = async () => {
        if (selectedUserIds.size === 0) {
            toast.error("Please select at least one recipient.");
            return;
        }

        if (!title.trim()) {
            toast.error("Please provide a certificate title.");
            return;
        }

        setIsIssuing(true);
        try {
            const payload: BatchIssuancePayload = {
                templateId: templateId || null,
                customDesign: templateId ? null : design,
                title: title.trim(),
                certificateType: certType,
                issuanceSource: "manual",
                awardPosition: awardPosition.trim() || undefined,
                description: description.trim() || undefined,
                signerName: signerName.trim() || undefined,
                signerRole: signerRole.trim() || undefined,
                recipients: Array.from(selectedUserIds).map((userId) => ({ userId })),
            };

            const res = await issueCertificateBatch(payload);
            toast.success(res.message || `Successfully issued ${res.successfulCount} credentials!`);
            onBatchIssued(res.batchId);
        } catch (err: any) {
            toast.error(err.message || "Failed to dispatch manual certificates.");
        } finally {
            setIsIssuing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header info & template status */}
            <div className="p-5 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#70D6FF] border border-black rounded shadow-[1px_1px_0px_#000]">
                            Manual / Direct Issuance
                        </span>
                        <span className="text-xs font-bold text-neutral-500">
                            Recognize individual student contributions across campus
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-black">
                        Issue Credentials to Campus Students
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-neutral-500 block">Active Template</span>
                        <span className="text-xs font-black text-black">{templateName || "Orbix Standard"}</span>
                    </div>
                    {onOpenPreview && (
                        <button
                            type="button"
                            onClick={onOpenPreview}
                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]"
                            title="Preview & Validate Certificate Template"
                        >
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        </button>
                    )}
                    {onNavigateToTemplates && (
                        <button
                            type="button"
                            onClick={onNavigateToTemplates}
                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]"
                            title="Change Template"
                        >
                            <Layers className="w-4 h-4 text-black" />
                        </button>
                    )}
                </div>
            </div>

            {/* Two Column Layout: Left Recipient Browser, Right Certificate Config */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 cols: Student Browser */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Filter and Search */}
                    <div className="p-4 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, @username, or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                                />
                            </div>

                            <select
                                value={credibilityFilter}
                                onChange={(e) => setCredibilityFilter(e.target.value)}
                                className="p-2 text-xs font-black border-2 border-black rounded-xl bg-white shadow-[1px_1px_0px_#000]"
                            >
                                <option value="all">All Campus Students</option>
                                <option value="event_attendee">Attended Events</option>
                                <option value="team_member">Team / Staff</option>
                                <option value="event_registered">Registered</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold text-neutral-600 pt-1">
                            <div>
                                Selected: <span className="font-black text-black">{selectedUserIds.size}</span> students
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={selectAllCurrent}
                                    className="text-xs font-black text-blue-700 hover:underline"
                                >
                                    Select Visible ({filteredRecipients.length})
                                </button>
                                <span>·</span>
                                <button
                                    type="button"
                                    onClick={deselectAll}
                                    className="text-xs font-black text-neutral-600 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] overflow-hidden max-h-[500px] overflow-y-auto divide-y-2 divide-black/5">
                        {loadingRecipients ? (
                            <div className="p-8 text-center text-xs font-bold text-neutral-500">
                                Loading students...
                            </div>
                        ) : filteredRecipients.length === 0 ? (
                            <div className="p-8 text-center text-xs font-bold text-neutral-500">
                                No students matched your filter.
                            </div>
                        ) : (
                            filteredRecipients.map((r) => {
                                const isSelected = selectedUserIds.has(r.id);
                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => toggleSelect(r.id)}
                                        className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF6EE]/60 transition-colors ${
                                            isSelected ? "bg-[#FAF6EE]" : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 border-black flex items-center justify-center shrink-0 ${
                                                    isSelected ? "bg-[#a2ff86]" : "bg-white"
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
                                            </div>

                                            <div>
                                                <div className="font-black text-xs sm:text-sm text-black">
                                                    {r.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-neutral-500">
                                                    @{r.username} · {r.email}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-black bg-white shadow-[1px_1px_0px_#000]">
                                                {r.credibilityBadge || "Student"}
                                            </span>
                                            {r.eventsAttendedCount > 0 && (
                                                <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                                    {r.eventsAttendedCount} attended
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right 5 cols: Certificate Configuration Form */}
                <div className="lg:col-span-5 p-5 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    <h4 className="text-sm font-black text-black pb-2 border-b-2 border-black/10">
                        Certificate Details
                    </h4>

                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Certificate Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Certificate of Appreciation"
                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Recognition Category
                        </label>
                        <select
                            value={certType}
                            onChange={(e) => setCertType(e.target.value as any)}
                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none cursor-pointer"
                        >
                            <option value="appreciation">Appreciation</option>
                            <option value="excellence">Excellence</option>
                            <option value="merit">Merit</option>
                            <option value="contributor">Core Contributor</option>
                            <option value="organizer">Lead / Organizer</option>
                            <option value="participation">Participation</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Award Position / Rank (Optional)
                        </label>
                        <input
                            type="text"
                            value={awardPosition}
                            onChange={(e) => setAwardPosition(e.target.value)}
                            placeholder="e.g. Best Speaker, Community Anchor"
                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Citation / Citation Note
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="In recognition of outstanding dedication, craftsmanship, and leadership..."
                            className="w-full p-2.5 text-xs font-medium border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-black block">
                                Signer Name
                            </label>
                            <input
                                type="text"
                                value={signerName}
                                onChange={(e) => setSignerName(e.target.value)}
                                placeholder="Prof. Rajesh Verma"
                                className="w-full p-2 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE]"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-black block">
                                Signer Role
                            </label>
                            <input
                                type="text"
                                value={signerRole}
                                onChange={(e) => setSignerRole(e.target.value)}
                                placeholder="Faculty Advisor"
                                className="w-full p-2 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE]"
                            />
                        </div>
                    </div>

                    <div className="pt-3 border-t-2 border-black/10">
                        <button
                            type="button"
                            onClick={handleDispatch}
                            disabled={isIssuing || selectedUserIds.size === 0}
                            className="w-full py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-3 border-black font-black text-xs sm:text-sm shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4 stroke-[2.5]" />
                            <span>
                                {isIssuing
                                    ? "Issuing Credentials..."
                                    : `Issue to ${selectedUserIds.size} Recipient(s)`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualIssuanceView;
