import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    Award,
    X,
    Calendar,
    Search,
    ShieldCheck,
    Send,
    Trash2,
    Eye,
    Check,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
    fetchClubEventsForCertificates,
    fetchClubEventRecipients,
    fetchClubEligibleRecipients,
    issueClubCertificates,
    fetchIssuedClubCertificates,
    revokeClubCertificate,
    type CertificateEventItem,
    type EventRecipientItem,
    type EligibleRecipient,
    type CertificateItem,
} from "../../api/clubCertificatesApi";
import { CertificateModal } from "../common/CertificateModal";
import { NeoSelect } from "../../components/NeoSelect";

interface ClubCertificateStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedEventId?: string | null;
}

export const ClubCertificateStudioModal: React.FC<ClubCertificateStudioModalProps> = ({
    isOpen,
    onClose,
    preselectedEventId = null,
}) => {
    const toast = useToast();

    // Perspective Tab: "event" | "network" | "issued"
    const [activePerspective, setActivePerspective] = useState<"event" | "network" | "issued">(
        preselectedEventId ? "event" : "event"
    );

    // Event-based Perspective state
    const [events, setEvents] = useState<CertificateEventItem[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>(preselectedEventId || "");
    const [eventRecipients, setEventRecipients] = useState<EventRecipientItem[]>([]);
    const [eventFilter, setEventFilter] = useState<"all" | "attended" | "registered">("attended");

    // Network-based Perspective state
    const [networkRecipients, setNetworkRecipients] = useState<EligibleRecipient[]>([]);
    const [networkCategory, setNetworkCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Selected Recipient User IDs (shared across perspectives)
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    // Certificate Customization Form
    const [title, setTitle] = useState<string>("Certificate of Participation");
    const [certType, setCertType] = useState<"participation" | "excellence" | "merit" | "contributor" | "organizer" | "appreciation">("participation");
    const [description, setDescription] = useState<string>("");
    const [signerName, setSignerName] = useState<string>("");
    const [signerRole, setSignerRole] = useState<string>("Lead Club Coordinator");

    // Issued Certificates state
    const [issuedCerts, setIssuedCerts] = useState<CertificateItem[]>([]);
    const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);

    // Loading states
    const [, setLoadingEvents] = useState(false);
    const [loadingRecipients, setLoadingRecipients] = useState(false);
    const [loadingNetwork, setLoadingNetwork] = useState(false);
    const [loadingIssued, setLoadingIssued] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load initial events
    useEffect(() => {
        if (!isOpen) return;

        const loadEvents = async () => {
            setLoadingEvents(true);
            try {
                const list = await fetchClubEventsForCertificates();
                setEvents(list);
                if (!selectedEventId && list.length > 0) {
                    setSelectedEventId(list[0].id);
                }
            } catch (err: any) {
                console.error("Failed to load events:", err);
            } finally {
                setLoadingEvents(false);
            }
        };

        loadEvents();
    }, [isOpen]);

    // Load recipients when selectedEventId changes
    useEffect(() => {
        if (!isOpen || !selectedEventId || activePerspective !== "event") return;

        const loadEventRecipients = async () => {
            setLoadingRecipients(true);
            try {
                const data = await fetchClubEventRecipients(selectedEventId);
                setEventRecipients(data.recipients);

                // Auto-select attended participants by default
                const attendedIds = data.recipients
                    .filter((r) => r.status === "attended")
                    .map((r) => r.userId);
                setSelectedUserIds(new Set(attendedIds));

                // Auto-fill title if empty or default
                const curEvent = events.find((e) => e.id === selectedEventId);
                if (curEvent) {
                    setTitle(`Certificate of Participation - ${curEvent.title}`);
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to load event participants.");
            } finally {
                setLoadingRecipients(false);
            }
        };

        loadEventRecipients();
    }, [isOpen, selectedEventId, activePerspective]);

    // Load network recipients when switching to network tab
    useEffect(() => {
        if (!isOpen || activePerspective !== "network") return;

        const loadNetwork = async () => {
            setLoadingNetwork(true);
            try {
                const list = await fetchClubEligibleRecipients(networkCategory, searchQuery);
                setNetworkRecipients(list);
            } catch (err: any) {
                toast.error(err.message || "Failed to load connected students.");
            } finally {
                setLoadingNetwork(false);
            }
        };

        loadNetwork();
    }, [isOpen, activePerspective, networkCategory, searchQuery]);

    // Load issued certificates when switching to issued tab
    useEffect(() => {
        if (!isOpen || activePerspective !== "issued") return;

        const loadIssued = async () => {
            setLoadingIssued(true);
            try {
                const list = await fetchIssuedClubCertificates();
                setIssuedCerts(list);
            } catch (err: any) {
                toast.error(err.message || "Failed to load issued certificates.");
            } finally {
                setLoadingIssued(false);
            }
        };

        loadIssued();
    }, [isOpen, activePerspective]);

    // Filtered event recipients
    const filteredEventRecipients = useMemo(() => {
        if (eventFilter === "all") return eventRecipients;
        return eventRecipients.filter((r) => r.status === eventFilter);
    }, [eventRecipients, eventFilter]);

    // Toggle single user selection
    const toggleUser = (userId: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    // Bulk selection handlers
    const selectAllCurrentEvent = () => {
        const ids = filteredEventRecipients.map((r) => r.userId);
        setSelectedUserIds(new Set(ids));
    };

    const selectAllNetwork = () => {
        const ids = networkRecipients.map((r) => r.id);
        setSelectedUserIds(new Set(ids));
    };

    const deselectAll = () => {
        setSelectedUserIds(new Set());
    };

    // Issue Certificates handler
    const handleIssueCertificates = async () => {
        if (selectedUserIds.size === 0) {
            toast.error("Please select at least one student recipient.");
            return;
        }

        if (!title.trim()) {
            toast.error("Please provide a valid certificate title.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                recipientUserIds: Array.from(selectedUserIds),
                eventId: activePerspective === "event" ? selectedEventId : null,
                title: title.trim(),
                certificateType: certType,
                description: description.trim() || undefined,
                signerName: signerName.trim() || undefined,
                signerRole: signerRole.trim() || undefined,
            };

            const result = await issueClubCertificates(payload);
            toast.success(result.message || `Issued ${result.issuedCount} certificate(s)!`);
            setSelectedUserIds(new Set());

            // Switch to issued tab to show newly created credentials
            setActivePerspective("issued");
        } catch (err: any) {
            toast.error(err.message || "Failed to issue certificates.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevoke = async (certId: string) => {
        if (!confirm("Are you sure you want to revoke this certificate? The student's credential will become invalid.")) {
            return;
        }

        try {
            await revokeClubCertificate(certId);
            toast.success("Certificate revoked successfully.");
            setIssuedCerts((prev) => prev.filter((c) => c.id !== certId));
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke certificate.");
        }
    };

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[110] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-5xl bg-[#FAF6EE] rounded-2xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-white border-b-3 border-black flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Award className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg sm:text-xl text-black leading-tight">
                                Certificate Issuance Studio
                            </h2>
                            <p className="text-xs font-bold text-neutral-600">
                                Issue cryptographically verified digital credentials to campus students & participants
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <X className="w-5 h-5 text-black" />
                    </button>
                </div>

                {/* Perspective Tabs Bar */}
                <div className="px-6 py-3 bg-[#f3ede1] border-b-3 border-black flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActivePerspective("event")}
                            className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all flex items-center gap-2 shadow-[2px_2px_0px_#000] ${
                                activePerspective === "event"
                                    ? "bg-[#a2ff86] text-black"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100"
                            }`}
                        >
                            <Calendar className="w-4 h-4" />
                            <span>1. Event Turnout & Attendees</span>
                        </button>

                        <button
                            onClick={() => setActivePerspective("network")}
                            className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all flex items-center gap-2 shadow-[2px_2px_0px_#000] ${
                                activePerspective === "network"
                                    ? "bg-[#FFDE59] text-black"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100"
                            }`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            <span>2. Connected & Credible Network</span>
                        </button>

                        <button
                            onClick={() => setActivePerspective("issued")}
                            className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all flex items-center gap-2 shadow-[2px_2px_0px_#000] ${
                                activePerspective === "issued"
                                    ? "bg-[#A6E3E9] text-black"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100"
                            }`}
                        >
                            <Award className="w-4 h-4" />
                            <span>Issued Archive ({issuedCerts.length})</span>
                        </button>
                    </div>

                    {activePerspective !== "issued" && (
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-lg border-2 border-black bg-white text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                Selected: <span className="text-black font-black">{selectedUserIds.size}</span>
                            </span>
                            {selectedUserIds.size > 0 && (
                                <button
                                    onClick={deselectAll}
                                    className="px-2.5 py-1 rounded-lg border border-black bg-neutral-100 hover:bg-neutral-200 text-[11px] font-bold"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {activePerspective === "issued" ? (
                        /* Issued Certificates View */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-base text-black">
                                    Previously Issued Club Certificates
                                </h3>
                                <span className="text-xs font-bold text-neutral-500">
                                    Total: {issuedCerts.length} credentials
                                </span>
                            </div>

                            {loadingIssued ? (
                                <div className="p-12 text-center font-black text-sm">
                                    Loading issued certificates...
                                </div>
                            ) : issuedCerts.length === 0 ? (
                                <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                                    <Award className="w-10 h-10 text-neutral-400 mx-auto" />
                                    <h4 className="font-black text-base text-black">No certificates issued yet</h4>
                                    <p className="text-xs font-bold text-neutral-600">
                                        Use Perspective 1 (Events) or Perspective 2 (Connected Network) to issue your first credentials.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {issuedCerts.map((cert) => (
                                        <div
                                            key={cert.id}
                                            className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#FAF6EE] border border-black">
                                                            {cert.certificateType}
                                                        </span>
                                                        <h4 className="font-black text-sm text-black mt-1">
                                                            {cert.title}
                                                        </h4>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold text-neutral-500">
                                                        {new Date(cert.issueDate).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="text-xs font-bold text-neutral-700">
                                                    Recipient: <span className="text-black font-black">{cert.recipientName}</span>
                                                    {cert.recipientEmail && <span className="text-neutral-500 text-[11px] block">{cert.recipientEmail}</span>}
                                                </div>

                                                <div className="p-2 rounded bg-neutral-50 border border-black/20 text-[11px] font-mono break-all">
                                                    ID: {cert.credentialCode}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                                <button
                                                    onClick={() => setPreviewCert(cert)}
                                                    className="px-3 py-1 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> View Certificate
                                                </button>

                                                <button
                                                    onClick={() => handleRevoke(cert.id)}
                                                    className="px-2.5 py-1 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 text-xs font-black flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Revoke
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Issuance View (Perspective 1 or 2) */
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left Panel: Student Selector (7 cols) */}
                            <div className="lg:col-span-7 space-y-4">
                                {activePerspective === "event" ? (
                                    /* PERSPECTIVE 1: Event-Centric */
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                                Select Event / Workshop:
                                            </label>
                                            <NeoSelect
                                                value={selectedEventId}
                                                onChange={(val) => setSelectedEventId(val)}
                                                size="sm"
                                                triggerClassName="!bg-[#FAF6EE] !rounded-xl !py-2 text-xs"
                                            >
                                                {events.map((ev) => (
                                                    <option key={ev.id} value={ev.id}>
                                                        {ev.title} ({ev.attendeesCount} Attended, {ev.registrationsCount} RSVPs) - {new Date(ev.startsAt).toLocaleDateString()}
                                                    </option>
                                                ))}
                                            </NeoSelect>

                                            {/* Sub-filter */}
                                            <div className="flex items-center justify-between pt-1">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <button
                                                        onClick={() => setEventFilter("attended")}
                                                        className={`px-2.5 py-1 rounded-lg border font-black ${
                                                            eventFilter === "attended"
                                                                ? "bg-[#a2ff86] border-black text-black"
                                                                : "bg-white border-neutral-300 text-neutral-600"
                                                        }`}
                                                    >
                                                        Attended Only
                                                    </button>
                                                    <button
                                                        onClick={() => setEventFilter("registered")}
                                                        className={`px-2.5 py-1 rounded-lg border font-black ${
                                                            eventFilter === "registered"
                                                                ? "bg-[#FFDE59] border-black text-black"
                                                                : "bg-white border-neutral-300 text-neutral-600"
                                                        }`}
                                                    >
                                                        Registered
                                                    </button>
                                                    <button
                                                        onClick={() => setEventFilter("all")}
                                                        className={`px-2.5 py-1 rounded-lg border font-black ${
                                                            eventFilter === "all"
                                                                ? "bg-black border-black text-white"
                                                                : "bg-white border-neutral-300 text-neutral-600"
                                                        }`}
                                                    >
                                                        All
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={selectAllCurrentEvent}
                                                    className="px-2.5 py-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                                                >
                                                    Select All
                                                </button>
                                            </div>
                                        </div>

                                        {/* Event Participants List */}
                                        <div className="space-y-2">
                                            <div className="text-xs font-black uppercase tracking-wider text-neutral-600 flex justify-between">
                                                <span>Participants ({filteredEventRecipients.length})</span>
                                                <span>Click card or checkbox to select</span>
                                            </div>

                                            {loadingRecipients ? (
                                                <div className="p-8 text-center font-bold text-xs">
                                                    Loading event participants...
                                                </div>
                                            ) : filteredEventRecipients.length === 0 ? (
                                                <div className="p-8 text-center bg-white border-2 border-black rounded-xl text-xs font-bold text-neutral-600">
                                                    No participants match the selected filter.
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                                    {filteredEventRecipients.map((rec) => {
                                                        const isSelected = selectedUserIds.has(rec.userId);
                                                        return (
                                                            <div
                                                                key={rec.registrationId}
                                                                onClick={() => toggleUser(rec.userId)}
                                                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                                    isSelected
                                                                        ? "bg-[#e8ffd6] border-black shadow-[2.5px_2.5px_0px_#000]"
                                                                        : "bg-white border-neutral-300 hover:border-black"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                                            isSelected
                                                                                ? "bg-black border-black text-[#a2ff86]"
                                                                                : "bg-white border-black/40"
                                                                        }`}
                                                                    >
                                                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                                    </div>

                                                                    {rec.avatarUrl ? (
                                                                        <img
                                                                            src={rec.avatarUrl}
                                                                            alt=""
                                                                            className="w-8 h-8 rounded-full border border-black object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded-full border border-black bg-neutral-200 flex items-center justify-center font-black text-xs">
                                                                            {rec.name.charAt(0)}
                                                                        </div>
                                                                    )}

                                                                    <div>
                                                                        <div className="font-black text-xs text-black flex items-center gap-2">
                                                                            <span>{rec.name}</span>
                                                                            {rec.alreadyHasCert && (
                                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#A6E3E9] text-black border border-black">
                                                                                    Has Cert
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[11px] font-bold text-neutral-500">
                                                                            @{rec.username} · {rec.email}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                                            rec.status === "attended"
                                                                                ? "bg-[#a2ff86] text-black border border-black"
                                                                                : "bg-neutral-100 text-neutral-700 border border-neutral-300"
                                                                        }`}
                                                                    >
                                                                        {rec.status}
                                                                    </span>
                                                                    {rec.department && (
                                                                        <span className="text-[10px] font-mono text-neutral-500">
                                                                            {rec.department}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* PERSPECTIVE 2: Club Credible Network */
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                            {/* Category Filter Tabs */}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    onClick={() => setNetworkCategory("all")}
                                                    className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                                                        networkCategory === "all"
                                                            ? "bg-[#a2ff86] border-black text-black"
                                                            : "bg-white border-neutral-300 text-neutral-600"
                                                    }`}
                                                >
                                                    All Connected
                                                </button>
                                                <button
                                                    onClick={() => setNetworkCategory("attendees")}
                                                    className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                                                        networkCategory === "attendees"
                                                            ? "bg-[#FFDE59] border-black text-black"
                                                            : "bg-white border-neutral-300 text-neutral-600"
                                                    }`}
                                                >
                                                    Verified Attendees
                                                </button>
                                                <button
                                                    onClick={() => setNetworkCategory("team")}
                                                    className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                                                        networkCategory === "team"
                                                            ? "bg-[#A6E3E9] border-black text-black"
                                                            : "bg-white border-neutral-300 text-neutral-600"
                                                    }`}
                                                >
                                                    Team & Leads
                                                </button>
                                                <button
                                                    onClick={() => setNetworkCategory("campus")}
                                                    className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                                                        networkCategory === "campus"
                                                            ? "bg-[#FFAEBC] border-black text-black"
                                                            : "bg-white border-neutral-300 text-neutral-600"
                                                    }`}
                                                >
                                                    Same Campus
                                                </button>
                                            </div>

                                            {/* Search input */}
                                            <div className="relative">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search credible students by name, username, email..."
                                                    className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black font-bold text-xs bg-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-xs font-bold text-neutral-500">
                                                    Eligible recipients: {networkRecipients.length}
                                                </span>
                                                <button
                                                    onClick={selectAllNetwork}
                                                    className="px-2.5 py-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                                                >
                                                    Select All
                                                </button>
                                            </div>
                                        </div>

                                        {/* Network Students List */}
                                        <div className="space-y-2">
                                            {loadingNetwork ? (
                                                <div className="p-8 text-center font-bold text-xs">
                                                    Loading eligible students...
                                                </div>
                                            ) : networkRecipients.length === 0 ? (
                                                <div className="p-8 text-center bg-white border-2 border-black rounded-xl text-xs font-bold text-neutral-600">
                                                    No connected students found matching this criteria.
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                                    {networkRecipients.map((st) => {
                                                        const isSelected = selectedUserIds.has(st.id);
                                                        return (
                                                            <div
                                                                key={st.id}
                                                                onClick={() => toggleUser(st.id)}
                                                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                                    isSelected
                                                                        ? "bg-[#e8ffd6] border-black shadow-[2.5px_2.5px_0px_#000]"
                                                                        : "bg-white border-neutral-300 hover:border-black"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                                            isSelected
                                                                                ? "bg-black border-black text-[#a2ff86]"
                                                                                : "bg-white border-black/40"
                                                                        }`}
                                                                    >
                                                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                                    </div>

                                                                    {st.avatarUrl ? (
                                                                        <img
                                                                            src={st.avatarUrl}
                                                                            alt=""
                                                                            className="w-8 h-8 rounded-full border border-black object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded-full border border-black bg-neutral-200 flex items-center justify-center font-black text-xs">
                                                                            {st.name.charAt(0)}
                                                                        </div>
                                                                    )}

                                                                    <div>
                                                                        <div className="font-black text-xs text-black flex items-center gap-2">
                                                                            <span>{st.name}</span>
                                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#FFDE59] text-black border border-black">
                                                                                {st.credibilityBadge}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[11px] font-bold text-neutral-500">
                                                                            @{st.username} · {st.collegeName || "Campus Verified"}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    {st.eventsAttendedCount > 0 && (
                                                                        <span className="text-[10px] font-black text-green-700">
                                                                            {st.eventsAttendedCount} Events Attended
                                                                        </span>
                                                                    )}
                                                                    {st.isTeamMember && (
                                                                        <span className="text-[10px] font-black text-blue-700">
                                                                            {st.teamRole || "Team Member"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel: Certificate Customizer & Dispatch (5 cols) */}
                            <div className="lg:col-span-5 space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                    <h3 className="font-black text-sm text-black flex items-center gap-2 border-b-2 border-black/10 pb-2">
                                        <Award className="w-4 h-4 text-black" />
                                        Certificate Configuration
                                    </h3>

                                    {/* Certificate Title */}
                                    <div className="space-y-1">
                                        <label className="block text-xs font-black text-neutral-800">
                                            Certificate Title:
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g. Certificate of Participation"
                                            className="w-full px-3 py-2 rounded-xl border-2 border-black font-bold text-xs bg-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                                        />
                                    </div>

                                    {/* Certificate Type */}
                                    <div className="space-y-1">
                                        <label className="block text-xs font-black text-neutral-800">
                                            Credential Category:
                                        </label>
                                        <NeoSelect
                                            value={certType}
                                            onChange={(val) => setCertType(val as any)}
                                            size="sm"
                                            triggerClassName="!bg-[#FAF6EE] !rounded-xl !py-2 text-xs"
                                        >
                                            <option value="participation">Participation</option>
                                            <option value="excellence">Excellence</option>
                                            <option value="merit">Merit & Distinction</option>
                                            <option value="contributor">Core Contributor</option>
                                            <option value="organizer">Event Organizer</option>
                                            <option value="appreciation">Appreciation</option>
                                        </NeoSelect>
                                    </div>

                                    {/* Custom Citation / Description */}
                                    <div className="space-y-1">
                                        <label className="block text-xs font-black text-neutral-800">
                                            Citation / Citation Description:
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Leave empty for smart auto-generated citation based on event/club."
                                            className="w-full px-3 py-2 rounded-xl border-2 border-black font-medium text-xs bg-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#a2ff86] resize-none"
                                        />
                                    </div>

                                    {/* Signatory Info */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="block text-[11px] font-black text-neutral-800">
                                                Signer Name:
                                            </label>
                                            <input
                                                type="text"
                                                value={signerName}
                                                onChange={(e) => setSignerName(e.target.value)}
                                                placeholder="e.g. Club Lead"
                                                className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black font-bold text-xs bg-[#FAF6EE]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[11px] font-black text-neutral-800">
                                                Signer Role:
                                            </label>
                                            <input
                                                type="text"
                                                value={signerRole}
                                                onChange={(e) => setSignerRole(e.target.value)}
                                                placeholder="e.g. Lead Coordinator"
                                                className="w-full px-2.5 py-1.5 rounded-lg border-2 border-black font-bold text-xs bg-[#FAF6EE]"
                                            />
                                        </div>
                                    </div>

                                    {/* Eligibility Protection Note */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 text-[11px] font-semibold text-neutral-700 space-y-1">
                                        <div className="flex items-center gap-1.5 font-black text-black">
                                            <ShieldCheck className="w-4 h-4 text-green-700" />
                                            Strict Boundary Enforced
                                        </div>
                                        <p>
                                            Certificates are cryptographically issued strictly to students affiliated with your college campus, attended your sessions, or belong to your team.
                                        </p>
                                    </div>

                                    {/* Dispatch Button */}
                                    <button
                                        onClick={handleIssueCertificates}
                                        disabled={isSubmitting || selectedUserIds.size === 0}
                                        className={`w-full py-3 rounded-xl border-3 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                                            selectedUserIds.size === 0 || isSubmitting
                                                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-none"
                                                : "bg-[#a2ff86] text-black hover:bg-[#8cee70]"
                                        }`}
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>
                                            {isSubmitting
                                                ? "Issuing & Notifying..."
                                                : `Issue to ${selectedUserIds.size} Selected Students`}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Certificate Preview Modal */}
            <CertificateModal
                certificate={previewCert}
                isOpen={!!previewCert}
                onClose={() => setPreviewCert(null)}
            />
        </div>,
        document.body
    );
};
