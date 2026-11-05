import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Download,
    Search,
    CheckCircle2,
    Users,
    Copy,
    RefreshCw,
    FileSpreadsheet,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
    fetchClubEventApplications,
    updateApplicantStatus,
    getEventApplicationsExportUrl,
    type ClubEventApplicantRow,
    type ClubEventApplicationsResponse,
} from "../../api/collegeEventsApi";
import { OrbixLoader } from "../../components/ui/loader";
import { NeoSelect } from "../../components/NeoSelect";

export interface EventApplicationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string | null;
    eventTitle?: string;
}

export const EventApplicationsModal: React.FC<EventApplicationsModalProps> = ({
    isOpen,
    onClose,
    eventId,
    eventTitle,
}) => {
    const toast = useToast();
    const [data, setData] = useState<ClubEventApplicationsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled">("all");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadData = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const res = await fetchClubEventApplications(eventId);
            setData(res);
        } catch (err: any) {
            console.error("Failed to fetch applications:", err);
            toast.error(err.message || "Failed to load event applications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && eventId) {
            loadData();
            setSearchQuery("");
            setStatusFilter("all");
        }
    }, [isOpen, eventId]);

    // Handle Quick Status Change in spreadsheet
    const handleStatusChange = async (
        applicant: ClubEventApplicantRow,
        nextStatus: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled"
    ) => {
        if (!eventId) return;
        try {
            setUpdatingId(applicant.id);
            await updateApplicantStatus(eventId, applicant.id, nextStatus);
            toast.success(`Applicant marked as ${nextStatus === "registered" ? "accepted" : nextStatus}.`);

            setData((prev) => {
                if (!prev) return prev;
                const updatedApps = prev.applications.map((a) =>
                    a.id === applicant.id
                        ? {
                              ...a,
                              status: nextStatus,
                              checkedInAt: nextStatus === "attended" ? new Date().toISOString() : a.checkedInAt,
                          }
                        : a
                );
                return {
                    ...prev,
                    summary: {
                        ...prev.summary,
                        total: updatedApps.length,
                        pending: updatedApps.filter((a) => (a.status as any) === "pending").length,
                        registered: updatedApps.filter((a) => a.status === "registered").length,
                        attended: updatedApps.filter((a) => a.status === "attended").length,
                        waitlisted: updatedApps.filter((a) => a.status === "waitlisted").length,
                        rejected: updatedApps.filter((a) => (a.status as any) === "rejected").length,
                        cancelled: updatedApps.filter((a) => a.status === "cancelled").length,
                    },
                    applications: updatedApps,
                };
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to update applicant status.");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    const filteredApplications = useMemo(() => {
        if (!data) return [];
        let list = data.applications;

        if (statusFilter !== "all") {
            list = list.filter((a) => a.status === statusFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (a) =>
                    a.applicantName.toLowerCase().includes(q) ||
                    a.applicantEmail.toLowerCase().includes(q) ||
                    a.ticketCode.toLowerCase().includes(q) ||
                    a.department.toLowerCase().includes(q) ||
                    a.rollNumber.toLowerCase().includes(q)
            );
        }

        return list;
    }, [data, statusFilter, searchQuery]);

    if (!isOpen || !eventId || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
            onClick={onClose}
        >
            <div
                className="w-full max-w-7xl h-[94vh] bg-[#FAF6EE] rounded-3xl border-2 border-black shadow-[10px_10px_0px_#000] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Excel Ribbon Top Header */}
                <header className="p-4 sm:p-5 bg-white border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-300 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <FileSpreadsheet className="w-5 h-5 text-black" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-black truncate">
                                    {data?.event?.title || eventTitle || "Event Registrations"}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-black shadow-[1px_1px_0px_#000]">
                                    Spreadsheet Mode
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-medium truncate">
                                Real-time applicant roster, verification ticket pass tracking, and check-in desk.
                            </p>
                        </div>
                    </div>

                    {/* Actions: Refresh, Export to Excel/CSV, Close */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            title="Refresh roster"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>

                        <a
                            href={getEventApplicationsExportUrl(eventId)}
                            download
                            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Export to Excel / CSV</span>
                        </a>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            title="Close"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                </header>

                {/* Spreadsheet Controls & Metrics Toolbar */}
                <div className="p-3 sm:p-4 bg-[#FAF6EE] border-b-2 border-black space-y-3 shrink-0">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search applicants by name, email, roll no, or ticket code..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden"
                            />
                        </div>

                        {/* Metric summary pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "all"
                                        ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                All ({data?.summary?.total || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("pending")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "pending"
                                        ? "bg-amber-300 text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                Pending ({data?.summary?.pending || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("registered")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "registered"
                                        ? "bg-emerald-300 text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                Accepted ({data?.summary?.registered || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("attended")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "attended"
                                        ? "bg-purple-300 text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                Attended ({data?.summary?.attended || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("rejected")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "rejected"
                                        ? "bg-rose-300 text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                Rejected ({data?.summary?.rejected || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("cancelled")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "cancelled"
                                        ? "bg-neutral-300 text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                Withdrawn ({data?.summary?.cancelled || 0})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Spreadsheet Data Grid */}
                <div className="flex-1 overflow-auto bg-white min-h-0">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center justify-center gap-3">
                            <OrbixLoader size="lg" />
                            <span className="text-xs font-black text-black">Opening spreadsheet roster...</span>
                        </div>
                    ) : filteredApplications.length === 0 ? (
                        <div className="p-16 text-center space-y-2">
                            <Users className="w-10 h-10 text-neutral-400 mx-auto" />
                            <h4 className="text-sm font-black text-black">No applicants found</h4>
                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                {searchQuery
                                    ? "No applicants match the current search filter."
                                    : "No students have applied for this event yet."}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-xs select-text">
                            {/* Sticky Excel Table Header */}
                            <thead className="bg-[#FAF6EE] sticky top-0 z-10 border-b-2 border-black shadow-[0_1px_0px_#000]">
                                <tr>
                                    <th className="p-3 border-r-2 border-black font-black text-neutral-600 uppercase text-[10px] w-12 text-center">
                                        #
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[130px]">
                                        Ticket Code
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[200px]">
                                        Student Name
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[180px]">
                                        Email Address
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[140px]">
                                        Department
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[100px]">
                                        Year
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[120px]">
                                        Roll Number
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[120px]">
                                        Phone
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[130px]">
                                        Registered At
                                    </th>
                                    <th className="p-3 border-r-2 border-black font-black text-black uppercase text-[10px] min-w-[140px]">
                                        Status
                                    </th>
                                    <th className="p-3 font-black text-black uppercase text-[10px] min-w-[120px] text-center">
                                        Quick Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredApplications.map((app, index) => {
                                    const isUpdating = updatingId === app.id;

                                    return (
                                        <tr
                                            key={app.id}
                                            className={`border-b border-black/15 transition-colors ${
                                                app.status === "attended"
                                                    ? "bg-purple-50/40 hover:bg-purple-50/80"
                                                    : app.status === "cancelled"
                                                    ? "bg-rose-50/30 opacity-70 hover:opacity-100"
                                                    : index % 2 === 0
                                                    ? "bg-white hover:bg-[#FAF6EE]/60"
                                                    : "bg-[#FAF6EE]/30 hover:bg-[#FAF6EE]/70"
                                            }`}
                                        >
                                            {/* Row Index */}
                                            <td className="p-3 border-r-2 border-black/15 font-mono font-bold text-center text-neutral-500">
                                                {index + 1}
                                            </td>

                                            {/* Ticket Code */}
                                            <td className="p-3 border-r-2 border-black/15 font-mono font-black">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(app.ticketCode, "Ticket code")}
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF6EE] hover:bg-neutral-100 border border-black/40 text-black text-[11px] cursor-pointer"
                                                    title="Click to copy ticket code"
                                                >
                                                    <span>{app.ticketCode}</span>
                                                    <Copy className="w-2.5 h-2.5 text-neutral-500" />
                                                </button>
                                            </td>

                                            {/* Student Name */}
                                            <td className="p-3 border-r-2 border-black/15">
                                                <div className="flex items-center gap-2">
                                                    {app.avatarUrl ? (
                                                        <img
                                                            src={app.avatarUrl}
                                                            alt={app.applicantName}
                                                            className="w-6 h-6 rounded-full border border-black object-cover shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[10px] shrink-0">
                                                            {app.applicantName.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="truncate">
                                                        <div className="font-black text-black truncate flex items-center gap-1.5">
                                                            <span>{app.applicantName}</span>
                                                            {app.isAttendeeUnder18 && (
                                                                app.guardianConsentStatus === 'verified' ? (
                                                                    <span className="px-1 py-0.2 bg-[#a2ff86] text-black font-black text-[9px] uppercase border border-black rounded shadow-[1px_1px_0px_#000]" title="Guardian consent confirmed">
                                                                        Minor: Verified
                                                                    </span>
                                                                ) : app.guardianConsentStatus === 'rejected' ? (
                                                                    <span className="px-1 py-0.2 bg-[#FF6B6B] text-white font-black text-[9px] uppercase border border-black rounded shadow-[1px_1px_0px_#000]" title="Guardian consent declined">
                                                                        Minor: Declined
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1 py-0.2 bg-[#FFE566] text-black font-black text-[9px] uppercase border border-black rounded shadow-[1px_1px_0px_#000]" title="Awaiting electronic guardian verification">
                                                                        Minor: Consent Pending
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-neutral-500 truncate">
                                                            @{app.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Email */}
                                            <td className="p-3 border-r-2 border-black/15 font-mono font-medium text-neutral-800">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(app.applicantEmail, "Email")}
                                                    className="hover:underline text-left truncate max-w-[170px] block cursor-pointer"
                                                >
                                                    {app.applicantEmail}
                                                </button>
                                            </td>

                                            {/* Department */}
                                            <td className="p-3 border-r-2 border-black/15 font-bold text-neutral-700 truncate max-w-[140px]">
                                                {app.department || "—"}
                                            </td>

                                            {/* Year */}
                                            <td className="p-3 border-r-2 border-black/15 font-bold text-neutral-700">
                                                {app.yearOfStudy || "—"}
                                            </td>

                                            {/* Roll No */}
                                            <td className="p-3 border-r-2 border-black/15 font-mono font-bold text-neutral-700">
                                                {app.rollNumber || "—"}
                                            </td>

                                            {/* Phone */}
                                            <td className="p-3 border-r-2 border-black/15 font-mono text-neutral-700">
                                                {app.phoneNumber || "—"}
                                            </td>

                                            {/* Registered At */}
                                            <td className="p-3 border-r-2 border-black/15 text-[11px] text-neutral-600 font-bold whitespace-nowrap">
                                                {new Date(app.registeredAt).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>

                                            {/* Status Selector */}
                                            <td className="p-2.5 border-r-2 border-black/15 min-w-[140px]">
                                                <NeoSelect
                                                    value={app.status}
                                                    disabled={isUpdating}
                                                    onChange={(val) =>
                                                        handleStatusChange(app, val as any)
                                                    }
                                                    size="sm"
                                                    triggerClassName={`!py-1 !h-8 text-xs font-black shadow-[1px_1px_0px_#000] ${
                                                        app.status === "registered"
                                                            ? "!bg-emerald-300 text-black"
                                                            : app.status === "attended"
                                                            ? "!bg-purple-300 text-black"
                                                            : app.status === "pending"
                                                            ? "!bg-amber-300 text-black"
                                                            : app.status === "waitlisted"
                                                            ? "!bg-amber-200 text-black"
                                                            : "!bg-rose-200 text-black"
                                                    }`}
                                                    dropdownClassName="min-w-[140px]"
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="registered">Accepted</option>
                                                    <option value="attended">Attended</option>
                                                    <option value="waitlisted">Waitlisted</option>
                                                    <option value="rejected">Rejected</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </NeoSelect>
                                            </td>

                                            {/* Quick Actions */}
                                            <td className="p-2.5 text-center">
                                                {app.status === "pending" ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={isUpdating}
                                                            onClick={() => handleStatusChange(app, "registered")}
                                                            className="px-2 py-0.5 rounded bg-[#a2ff86] hover:bg-[#8ee673] border border-black text-[10px] font-black cursor-pointer shadow-[1px_1px_0px_#000]"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isUpdating}
                                                            onClick={() => handleStatusChange(app, "rejected")}
                                                            className="px-2 py-0.5 rounded bg-rose-200 hover:bg-rose-300 border border-black text-[10px] font-black cursor-pointer shadow-[1px_1px_0px_#000]"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : app.status === "attended" ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-black/20">
                                                        <CheckCircle2 className="w-3 h-3 text-purple-700" />
                                                        <span>Checked In</span>
                                                    </span>
                                                ) : app.status === "registered" ? (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() => handleStatusChange(app, "attended")}
                                                        className="px-2.5 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] border-2 border-black text-[11px] font-black shadow-[1px_1px_0px_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                                                    >
                                                        Check In
                                                    </button>
                                                ) : app.status === "rejected" ? (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() => handleStatusChange(app, "registered")}
                                                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 border border-black text-[10px] font-black cursor-pointer"
                                                    >
                                                        Re-Accept
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-neutral-400 font-bold">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Spreadsheet Footer Status Bar */}
                <footer className="p-3 bg-[#FAF6EE] border-t-2 border-black px-4 flex flex-wrap items-center justify-between text-xs font-bold text-neutral-600 shrink-0">
                    <div className="flex items-center gap-4">
                        <span>Total Records: <strong className="text-black font-black">{filteredApplications.length}</strong></span>
                        <span>Confirmed: <strong className="text-emerald-700 font-black">{data?.summary?.registered || 0}</strong></span>
                        <span>Attended: <strong className="text-purple-700 font-black">{data?.summary?.attended || 0}</strong></span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-500">Press Esc or close when finished</span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 rounded-xl bg-white border-2 border-black text-xs font-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            Close Spreadsheet
                        </button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default EventApplicationsModal;
