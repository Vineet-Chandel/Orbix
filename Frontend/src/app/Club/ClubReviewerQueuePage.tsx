import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Search,
    Building2,
    RefreshCw,
    ExternalLink,
    Lock,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface ReviewerApplication {
    id: string;
    auth_user_id: string;
    club_name: string;
    college_name: string;
    college_city: string;
    college_state: string;
    college_country: string;
    club_category: string;
    club_description: string | null;
    contact_person_name: string;
    contact_person_role: string;
    contact_email: string;
    college_official_email: string | null;
    contact_phone: string | null;
    college_website_url: string | null;
    club_website_url: string | null;
    club_social_url: string | null;
    status: "pending" | "under_review" | "needs_information" | "rejected" | "ready_for_promotion";
    college_contact_status: "not_started" | "contacted" | "confirmed" | "not_found" | "no_response";
    club_existence_confirmed: boolean;
    college_authorization_confirmed: boolean;
    representative_authority_confirmed: boolean;
    last_college_contacted_at: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    internal_notes: string | null;
    submitted_at: string;
    updated_at: string;
}

export default function ClubReviewerQueuePage() {
    const navigate = useNavigate();
    const toast = useToast();

    const [requests, setRequests] = useState<ReviewerApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRequest, setSelectedRequest] = useState<ReviewerApplication | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    // Inspector Edit Form State
    const [editForm, setEditForm] = useState({
        collegeContactStatus: "not_started",
        clubExistenceConfirmed: false,
        collegeAuthorizationConfirmed: false,
        representativeAuthorityConfirmed: false,
        lastCollegeContactedAt: "",
        internalNotes: "",
        status: "pending",
    });

    const fetchQueue = async () => {
        setLoading(true);
        setAccessDenied(false);

        try {
            const url =
                selectedStatus === "all"
                    ? "/api/club/reviewer/queue"
                    : `/api/club/reviewer/queue?status=${selectedStatus}`;

            const res = await fetch(url, {
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            if (res.status === 401) {
                navigate("/auth/signin");
                return;
            }

            if (res.status === 403) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            const data = await res.json().catch(() => null);
            if (data?.requests) {
                setRequests(data.requests);
            } else {
                setRequests([]);
            }
        } catch (err: any) {
            console.error("Failed to fetch reviewer queue:", err);
            toast.error("Failed to load club reviewer queue.", { title: "Error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, [selectedStatus]);

    const openInspector = (req: ReviewerApplication) => {
        setSelectedRequest(req);
        setEditForm({
            collegeContactStatus: req.college_contact_status || "not_started",
            clubExistenceConfirmed: Boolean(req.club_existence_confirmed),
            collegeAuthorizationConfirmed: Boolean(req.college_authorization_confirmed),
            representativeAuthorityConfirmed: Boolean(req.representative_authority_confirmed),
            lastCollegeContactedAt: req.last_college_contacted_at
                ? req.last_college_contacted_at.split("T")[0]
                : "",
            internalNotes: req.internal_notes || "",
            status: req.status,
        });
    };

    const handleSaveReview = async (newStatusOverride?: string) => {
        if (!selectedRequest) return;

        const targetStatus = newStatusOverride || editForm.status;

        // Frontend validation for ready_for_promotion
        if (targetStatus === "ready_for_promotion") {
            if (
                editForm.collegeContactStatus !== "confirmed" ||
                !editForm.clubExistenceConfirmed ||
                !editForm.collegeAuthorizationConfirmed ||
                !editForm.representativeAuthorityConfirmed
            ) {
                toast.error(
                    "All verification checklist items (College Contact Confirmed, Club Existence, College Authorization, and Representative Authority) must be verified before marking Ready for Promotion.",
                    { title: "Verification Incomplete" }
                );
                return;
            }
        }

        setIsSaving(true);

        try {
            const res = await fetch(`/api/club/reviewer/request/${selectedRequest.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    collegeContactStatus: editForm.collegeContactStatus,
                    clubExistenceConfirmed: editForm.clubExistenceConfirmed,
                    collegeAuthorizationConfirmed: editForm.collegeAuthorizationConfirmed,
                    representativeAuthorityConfirmed: editForm.representativeAuthorityConfirmed,
                    lastCollegeContactedAt: editForm.lastCollegeContactedAt || undefined,
                    internalNotes: editForm.internalNotes,
                    status: targetStatus,
                }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.message || "Failed to update application review.");
            }

            toast.success("Verification application updated successfully.", { title: "Updated" });
            setSelectedRequest(data.request);
            setEditForm((prev) => ({ ...prev, status: data.request.status }));
            fetchQueue();
        } catch (err: any) {
            console.error("Save review error:", err);
            toast.error(err.message || "Failed to save verification updates.", { title: "Update Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredRequests = requests.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.club_name.toLowerCase().includes(q) ||
            r.college_name.toLowerCase().includes(q) ||
            r.contact_person_name.toLowerCase().includes(q) ||
            r.contact_email.toLowerCase().includes(q) ||
            r.college_city.toLowerCase().includes(q)
        );
    });

    const isAllChecklistConfirmed =
        editForm.collegeContactStatus === "confirmed" &&
        editForm.clubExistenceConfirmed &&
        editForm.collegeAuthorizationConfirmed &&
        editForm.representativeAuthorityConfirmed;

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white flex flex-col relative">
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Header */}
            <header className="w-full bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="flex items-center gap-2 group"
                        title="Orbix Home"
                    >
                        <div className="w-8 h-8 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            O
                        </div>
                        <span className="font-black text-lg tracking-tight text-black group-hover:text-neutral-700 transition-colors">
                            Orbix Staff
                        </span>
                    </Link>

                    <span className="hidden sm:inline-block w-1 h-4 bg-neutral-300 rounded-full mx-1" />

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-white text-xs font-black uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Club Verification Queue</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={fetchQueue}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-black text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh Queue</span>
                    </button>

                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF6EE] text-black text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all"
                    >
                        <span>Workspace</span>
                    </Link>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
                {/* Access Denied Banner */}
                {accessDenied && (
                    <div className="p-8 sm:p-12 text-center rounded-3xl bg-white border-3 border-rose-500 shadow-[6px_6px_0px_#f43f5e] space-y-4 max-w-lg mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <Lock className="w-7 h-7 text-rose-600" />
                        </div>
                        <h2 className="text-2xl font-black text-black">
                            Reviewer Access Forbidden
                        </h2>
                        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-medium">
                            Your authenticated account is not in the server-side reviewer allowlist (<code className="font-mono text-black font-bold">ORBIX_REVIEWER_EMAILS</code>). Staff authorization is enforced strictly on the backend.
                        </p>
                        <div className="pt-2">
                            <Link
                                to="/"
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black text-white text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000]"
                            >
                                Back to Orbix
                            </Link>
                        </div>
                    </div>
                )}

                {!accessDenied && (
                    <>
                        {/* Queue Filter Bar */}
                        <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Status Filter Tabs */}
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                {[
                                    { id: "all", label: "All" },
                                    { id: "pending", label: "Pending" },
                                    { id: "under_review", label: "Under Review" },
                                    { id: "needs_information", label: "Needs Info" },
                                    { id: "ready_for_promotion", label: "Ready" },
                                    { id: "rejected", label: "Rejected" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedStatus(tab.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer ${
                                            selectedStatus === tab.id
                                                ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search Input */}
                            <div className="relative w-full md:w-72">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Search club, college, email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-full bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Queue Grid / Table */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Applications List (Left 7 Cols) */}
                            <div className="lg:col-span-7 space-y-3">
                                <div className="flex items-center justify-between px-2 text-xs font-black uppercase tracking-wider text-neutral-500">
                                    <span>Applications ({filteredRequests.length})</span>
                                    <span>Select to Inspect</span>
                                </div>

                                {loading && (
                                    <div className="p-8 rounded-3xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-black/20 border-t-black animate-spin mx-auto mb-2" />
                                        <span className="text-xs font-bold text-neutral-500">Loading verification queue...</span>
                                    </div>
                                )}

                                {!loading && filteredRequests.length === 0 && (
                                    <div className="p-8 rounded-3xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center text-xs font-bold text-neutral-500">
                                        No applications match the current filter.
                                    </div>
                                )}

                                {!loading &&
                                    filteredRequests.map((req) => {
                                        const isSelected = selectedRequest?.id === req.id;
                                        return (
                                            <div
                                                key={req.id}
                                                onClick={() => openInspector(req)}
                                                className={`p-4 sm:p-5 rounded-2xl border-2 border-black cursor-pointer transition-all ${
                                                    isSelected
                                                        ? "bg-amber-50 shadow-[4px_4px_0px_#000] translate-x-1"
                                                        : "bg-white shadow-[2px_2px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div>
                                                        <h3 className="font-black text-black text-sm sm:text-base">
                                                            {req.club_name}
                                                        </h3>
                                                        <p className="text-xs font-bold text-neutral-600 flex items-center gap-1 mt-0.5">
                                                            <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                                                            <span>{req.college_name}</span>
                                                        </p>
                                                    </div>

                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${
                                                            req.status === "pending"
                                                                ? "bg-amber-200 text-black"
                                                                : req.status === "under_review"
                                                                ? "bg-sky-200 text-black"
                                                                : req.status === "needs_information"
                                                                ? "bg-orange-200 text-black"
                                                                : req.status === "ready_for_promotion"
                                                                ? "bg-emerald-300 text-black"
                                                                : "bg-rose-200 text-black"
                                                        }`}
                                                    >
                                                        {req.status}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 font-medium pt-2 border-t border-black/10">
                                                    <span>Rep: <strong>{req.contact_person_name}</strong> ({req.contact_person_role})</span>
                                                    <span>City: {req.college_city}, {req.college_state}</span>
                                                    <span>Submitted: {new Date(req.submitted_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Inspector & Review Panel (Right 5 Cols) */}
                            <div className="lg:col-span-5 sticky top-20">
                                {!selectedRequest ? (
                                    <div className="p-8 rounded-3xl bg-white border-2 border-dashed border-black/30 text-center text-xs font-bold text-neutral-400 space-y-2">
                                        <Building2 className="w-8 h-8 mx-auto text-neutral-300" />
                                        <p>Select an application from the queue to inspect details and record verification results.</p>
                                    </div>
                                ) : (
                                    <div className="p-5 sm:p-6 rounded-3xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-5">
                                        <div className="flex items-start justify-between border-b-2 border-black/10 pb-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                    Reviewing Application
                                                </span>
                                                <h3 className="font-black text-black text-base">
                                                    {selectedRequest.club_name}
                                                </h3>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setSelectedRequest(null)}
                                                className="text-xs font-bold text-neutral-500 hover:text-black"
                                            >
                                                Close
                                            </button>
                                        </div>

                                        {/* Contact & Verification References */}
                                        <div className="space-y-2 text-xs font-medium p-3.5 rounded-2xl bg-[#FAF6EE] border border-black/15">
                                            <div><strong>College:</strong> {selectedRequest.college_name} ({selectedRequest.college_city}, {selectedRequest.college_state})</div>
                                            <div><strong>Rep:</strong> {selectedRequest.contact_person_name} — {selectedRequest.contact_person_role}</div>
                                            <div><strong>Email:</strong> <span className="font-mono">{selectedRequest.contact_email}</span></div>
                                            {selectedRequest.college_official_email && (
                                                <div><strong>College Email:</strong> <span className="font-mono">{selectedRequest.college_official_email}</span></div>
                                            )}
                                            {selectedRequest.contact_phone && (
                                                <div><strong>Phone:</strong> {selectedRequest.contact_phone}</div>
                                            )}

                                            {/* Reference URLs */}
                                            <div className="pt-1.5 flex flex-wrap gap-2">
                                                {selectedRequest.college_website_url && (
                                                    <a
                                                        href={selectedRequest.college_website_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded-full border border-black/20 hover:underline"
                                                    >
                                                        <span>College Web</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {selectedRequest.club_website_url && (
                                                    <a
                                                        href={selectedRequest.club_website_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded-full border border-black/20 hover:underline"
                                                    >
                                                        <span>Club Web</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {selectedRequest.club_social_url && (
                                                    <a
                                                        href={selectedRequest.club_social_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded-full border border-black/20 hover:underline"
                                                    >
                                                        <span>Social/Directory</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mandatory Verification Checklist */}
                                        <div className="space-y-3 pt-1">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                                <span>College Verification Checklist</span>
                                            </h4>

                                            <div className="space-y-2 p-3.5 rounded-2xl bg-neutral-50 border-2 border-black/15 text-xs font-medium">
                                                {/* College Contact Status */}
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">
                                                        College Contact Status
                                                    </label>
                                                    <select
                                                        value={editForm.collegeContactStatus}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                collegeContactStatus: e.target.value,
                                                            })
                                                        }
                                                        className="w-full h-9 px-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold focus:outline-none"
                                                    >
                                                        <option value="not_started">Not Started</option>
                                                        <option value="contacted">College Contacted</option>
                                                        <option value="confirmed">Confirmed with College</option>
                                                        <option value="not_found">Institution / Club Not Found</option>
                                                        <option value="no_response">No Response from Institution</option>
                                                    </select>
                                                </div>

                                                {/* Checklist Checkboxes */}
                                                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.clubExistenceConfirmed}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                clubExistenceConfirmed: e.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 rounded border-2 border-black accent-black"
                                                    />
                                                    <span>1. Club Existence Confirmed</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.collegeAuthorizationConfirmed}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                collegeAuthorizationConfirmed: e.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 rounded border-2 border-black accent-black"
                                                    />
                                                    <span>2. College Association Confirmed</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.representativeAuthorityConfirmed}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                representativeAuthorityConfirmed: e.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 rounded border-2 border-black accent-black"
                                                    />
                                                    <span>3. Representative Authority Confirmed</span>
                                                </label>

                                                {/* Last Contacted Date */}
                                                <div className="pt-1">
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">
                                                        Last College Contact Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={editForm.lastCollegeContactedAt}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                lastCollegeContactedAt: e.target.value,
                                                            })
                                                        }
                                                        className="w-full h-8 px-2.5 rounded-xl bg-white border border-black/30 text-xs font-mono font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Internal Notes (Hidden from applicant) */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1">
                                                Internal Review Notes (Confidential to Staff)
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={editForm.internalNotes}
                                                onChange={(e) =>
                                                    setEditForm({ ...editForm, internalNotes: e.target.value })
                                                }
                                                placeholder="Record contact person at college, email verification notes, etc..."
                                                className="w-full p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium resize-none focus:outline-none focus:bg-white"
                                            />
                                        </div>

                                        {/* Status Transitions */}
                                        <div className="pt-2 border-t-2 border-black/10 space-y-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                Transition Application Status:
                                            </span>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleSaveReview("under_review")}
                                                    className="px-3 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                                >
                                                    Move Under Review
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleSaveReview("needs_information")}
                                                    className="px-3 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                                >
                                                    Needs Information
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleSaveReview("rejected")}
                                                    className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 border-2 border-black text-rose-900 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                                >
                                                    Reject Request
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isSaving || !isAllChecklistConfirmed}
                                                    onClick={() => handleSaveReview("ready_for_promotion")}
                                                    className={`px-3 py-2 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all ${
                                                        isAllChecklistConfirmed
                                                            ? "bg-emerald-300 hover:bg-emerald-400 text-black cursor-pointer"
                                                            : "bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed shadow-none"
                                                    }`}
                                                    title={
                                                        isAllChecklistConfirmed
                                                            ? "Approve application as Ready for Promotion"
                                                            : "Must confirm all checklist items first"
                                                    }
                                                >
                                                    Ready for Promotion
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleSaveReview()}
                                                className="w-full mt-2 py-2 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 cursor-pointer disabled:opacity-50"
                                            >
                                                {isSaving ? "Saving Updates..." : "Save Checklist & Notes Only"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
