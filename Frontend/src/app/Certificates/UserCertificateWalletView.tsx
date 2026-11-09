import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Award,
    ShieldCheck,
    Search,
    Download,
    Eye,
    Share2,
    Copy,
    Check,
    Building2,
    Calendar,
    Users,
    AlertTriangle,
    ExternalLink,
    Hash,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    X,
    Gift,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
    fetchUserCertificateWallet,
    revealCertificateNotification,
    type UserWalletItem,
} from "../../api/certificateStudioApi";
import { OrbixLoader } from "../../components/ui/loader";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { NeoSelect } from "../../components/NeoSelect";

interface UserCertificateWalletViewProps {
    onOpenMobileSidebar?: () => void;
    compact?: boolean;
}

export const UserCertificateWalletView: React.FC<UserCertificateWalletViewProps> = ({
    onOpenMobileSidebar,
    compact = false,
}) => {
    const toast = useToast();

    // Data State
    const [loading, setLoading] = useState(true);
    const [certificates, setCertificates] = useState<UserWalletItem[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        valid: 0,
        teamAwards: 0,
        uniqueClubs: 0,
    });

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClub, setSelectedClub] = useState<string>("all");
    const [selectedEvent, setSelectedEvent] = useState<string>("all");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<"all" | "individual" | "team">("all");

    // UI States
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [copiedHash, setCopiedHash] = useState<string | null>(null);
    const [expandedTeamRosters, setExpandedTeamRosters] = useState<Set<string>>(new Set());
    const [previewCert, setPreviewCert] = useState<UserWalletItem | null>(null);
    const [previewSvg, setPreviewSvg] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [revealingCertId, setRevealingCertId] = useState<string | null>(null);

    // Load Wallet Data
    const loadWallet = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchUserCertificateWallet();
            setCertificates(data.certificates || []);
            setStats(data.stats || { total: 0, valid: 0, teamAwards: 0, uniqueClubs: 0 });
        } catch (err: any) {
            toast.error(err.message || "Failed to load certificates from wallet.");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadWallet();
    }, [loadWallet]);

    // Unique filter options extracted from user certificates
    const availableClubs = useMemo(() => {
        const map = new Map<string, string>();
        certificates.forEach((c) => {
            if (c.clubId && c.clubName) map.set(c.clubId, c.clubName);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [certificates]);

    const availableEvents = useMemo(() => {
        const map = new Map<string, string>();
        certificates.forEach((c) => {
            if (c.eventId && c.eventTitle) map.set(c.eventId, c.eventTitle);
        });
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [certificates]);

    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        certificates.forEach((c) => {
            if (c.certificateType) set.add(c.certificateType);
        });
        return Array.from(set);
    }, [certificates]);

    // Filtered Certificates
    const filteredCertificates = useMemo(() => {
        return certificates.filter((cert) => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const match =
                    cert.title.toLowerCase().includes(q) ||
                    cert.recipientName.toLowerCase().includes(q) ||
                    cert.credentialCode.toLowerCase().includes(q) ||
                    cert.clubName.toLowerCase().includes(q) ||
                    (cert.eventTitle && cert.eventTitle.toLowerCase().includes(q)) ||
                    (cert.teamName && cert.teamName.toLowerCase().includes(q)) ||
                    cert.description.toLowerCase().includes(q);
                if (!match) return false;
            }

            // Club filter
            if (selectedClub !== "all" && cert.clubId !== selectedClub) return false;

            // Event filter
            if (selectedEvent !== "all" && cert.eventId !== selectedEvent) return false;

            // Category filter
            if (selectedCategory !== "all" && cert.certificateType !== selectedCategory) return false;

            // Status filter
            if (selectedStatus !== "all" && cert.status !== selectedStatus) return false;

            // Type filter
            if (selectedType === "individual" && cert.isTeam) return false;
            if (selectedType === "team" && !cert.isTeam) return false;

            return true;
        });
    }, [certificates, searchQuery, selectedClub, selectedEvent, selectedCategory, selectedStatus, selectedType]);

    // Toggle team roster expansion
    const toggleTeamRoster = (certId: string) => {
        setExpandedTeamRosters((prev) => {
            const next = new Set(prev);
            if (next.has(certId)) next.delete(certId);
            else next.add(certId);
            return next;
        });
    };

    // Copy Credential Code
    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`Copied Credential Code: ${code}`);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // Copy Verification Link
    const handleCopyVerificationLink = (code: string) => {
        const url = `${window.location.origin}/verify/certificate/${encodeURIComponent(code)}`;
        navigator.clipboard.writeText(url);
        toast.success("Verification link copied to clipboard!");
    };

    // Copy SHA-256 Digest
    const handleCopyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        toast.success("SHA-256 cryptographic digest copied!");
        setTimeout(() => setCopiedHash(null), 2000);
    };

    // Download PDF directly
    const handleDownloadPdf = (code: string) => {
        const downloadUrl = `/api/club/certificates/${encodeURIComponent(code)}/download`;
        window.open(downloadUrl, "_blank");
    };

    // Open Vector Preview Modal
    const handleOpenPreview = async (cert: UserWalletItem) => {
        setPreviewCert(cert);
        setLoadingPreview(true);
        setPreviewSvg(null);

        try {
            const res = await fetch(`/api/club/certificates/${encodeURIComponent(cert.credentialCode)}/preview`);
            if (res.ok) {
                const svgText = await res.text();
                setPreviewSvg(svgText);
            } else {
                toast.error("Failed to load vector preview.");
            }
        } catch {
            toast.error("Failed to retrieve vector certificate preview.");
        } finally {
            setLoadingPreview(false);
        }
    };

    // Reveal Certificate Animation (Phase 15)
    const handleRevealCertificate = async (cert: UserWalletItem) => {
        setRevealingCertId(cert.id);
        try {
            await revealCertificateNotification(cert.id);
            setCertificates((prev) =>
                prev.map((c) => (c.id === cert.id ? { ...c, isRevealed: true, isSpoiler: false } : c))
            );
            toast.success("Certificate officially revealed & stamped!");
        } catch (err: any) {
            toast.error(err.message || "Failed to reveal certificate.");
        } finally {
            setRevealingCertId(null);
        }
    };

    return (
        <div className={`w-full ${compact ? "p-0" : "p-4 sm:p-6 lg:p-8 space-y-6"}`}>
            {/* Wallet Header & Title */}
            {!compact && (
                <div className="pb-6 border-b-3 border-black flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                    aria-label="Open sidebar"
                                >
                                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                </button>
                            )}
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-black text-[#FFE566] flex items-center justify-center font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Award className="w-5 h-5" />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                    Certificate Wallet
                                </h1>
                            </div>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-neutral-600 pl-0 sm:pl-12">
                            Your immutable, cryptographically verifiable campus achievements, merit awards, and team honors.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadWallet}
                            disabled={loading}
                            className="px-3.5 py-2 rounded-xl bg-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-neutral-100 flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                            title="Refresh Wallet"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Metrics Dossier Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                        Total Earned
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-black">{stats.total}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#a2ff86] border-3 border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <span className="text-[10px] font-black uppercase text-neutral-800 tracking-wider">
                        Active & Valid
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-black">{stats.valid}</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-100 border-3 border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <span className="text-[10px] font-black uppercase text-purple-900 tracking-wider">
                        Team Honors
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-purple-950">{stats.teamAwards}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFE566] border-3 border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <span className="text-[10px] font-black uppercase text-neutral-800 tracking-wider">
                        Issuing Clubs
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-black">{stats.uniqueClubs}</div>
                </div>
            </div>

            {/* Search & Filters Console */}
            <div className="p-4 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by certificate title, club name, event, or credential code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-black text-xs sm:text-sm font-bold bg-[#FAF6EE] focus:bg-white focus:outline-none shadow-[2px_2px_0px_#000]"
                    />
                </div>

                {/* Dropdowns Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {/* Club Filter */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Issuing Club
                        </label>
                        <NeoSelect
                            value={selectedClub}
                            onChange={(val) => setSelectedClub(val)}
                            size="sm"
                            options={[
                                { value: "all", label: "All Issuing Clubs" },
                                ...availableClubs.map((club) => ({ value: club.id, label: club.name })),
                            ]}
                        />
                    </div>

                    {/* Event Filter */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Event
                        </label>
                        <NeoSelect
                            value={selectedEvent}
                            onChange={(val) => setSelectedEvent(val)}
                            size="sm"
                            options={[
                                { value: "all", label: "All Events" },
                                ...availableEvents.map((ev) => ({ value: ev.id, label: ev.title })),
                            ]}
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Category
                        </label>
                        <NeoSelect
                            value={selectedCategory}
                            onChange={(val) => setSelectedCategory(val)}
                            size="sm"
                            options={[
                                { value: "all", label: "All Categories" },
                                ...availableCategories.map((cat) => ({ value: cat, label: cat })),
                            ]}
                        />
                    </div>

                    {/* Validity Status Filter */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Validity Status
                        </label>
                        <NeoSelect
                            value={selectedStatus}
                            onChange={(val) => setSelectedStatus(val)}
                            size="sm"
                            options={[
                                { value: "all", label: "All Statuses" },
                                { value: "valid", label: "Valid & Active Only" },
                                { value: "superseded", label: "Superseded Versions" },
                                { value: "revoked", label: "Revoked" },
                            ]}
                        />
                    </div>
                </div>

                {/* Filter Pills: Type and Categories */}
                <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                    {/* Type Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSelectedType("all")}
                            className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedType === "all"
                                    ? "bg-black text-[#FFE566] shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                            }`}
                        >
                            All Types
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedType("individual")}
                            className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedType === "individual"
                                    ? "bg-black text-[#FFE566] shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                            }`}
                        >
                            Individual
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedType("team")}
                            className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedType === "team"
                                    ? "bg-purple-900 text-purple-100 shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                            }`}
                        >
                            Team Awards
                        </button>
                    </div>

                    {/* Reset Filters */}
                    {(searchQuery || selectedClub !== "all" || selectedEvent !== "all" || selectedStatus !== "all" || selectedType !== "all" || selectedCategory !== "all") && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedClub("all");
                                setSelectedEvent("all");
                                setSelectedStatus("all");
                                setSelectedType("all");
                                setSelectedCategory("all");
                            }}
                            className="text-xs font-black text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content: Loading / Empty / Cards Grid */}
            {loading ? (
                <div className="p-16 text-center space-y-3 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
                    <OrbixLoader size="md" />
                    <span className="text-xs font-black text-black">Decrypting & verifying wallet credentials...</span>
                </div>
            ) : filteredCertificates.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-3 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                        <Award className="w-8 h-8 text-black" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-black">No Certificates Found</h3>
                        <p className="text-xs sm:text-sm font-semibold text-neutral-600 max-w-md mx-auto">
                            {certificates.length === 0
                                ? "You haven't been awarded any certificates yet. Participate in campus club events, hackathons, and activities to earn official credentials."
                                : "No certificates match your current search and filter criteria. Try resetting filters."}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredCertificates.map((cert) => {
                        const isExpanded = expandedTeamRosters.has(cert.id);
                        const isRevoked = cert.status === "revoked";
                        const isSuperseded = cert.status === "superseded";
                        const isValid = cert.status === "valid";

                        const issueDateFormatted = new Date(cert.issueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        });

                        return (
                            <div
                                key={cert.id}
                                className={`rounded-2xl border-3 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between overflow-hidden transition-all ${
                                    isRevoked
                                        ? "bg-rose-50/70"
                                        : isSuperseded
                                        ? "bg-amber-50/70"
                                        : "bg-white hover:shadow-[7px_7px_0px_#000]"
                                }`}
                            >
                                <div className="p-5 sm:p-6 space-y-4">
                                    {/* Top Status Badges Row */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {/* Validity Pill */}
                                            {isValid && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-800" />
                                                    <span>Verified & Active</span>
                                                </span>
                                            )}
                                            {isSuperseded && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-300 text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3 text-amber-800" />
                                                    <span>Superseded (v{cert.version})</span>
                                                </span>
                                            )}
                                            {isRevoked && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3 text-white" />
                                                    <span>Revoked</span>
                                                </span>
                                            )}

                                            {/* Category Pill */}
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                {cert.certificateType}
                                            </span>

                                            {/* Team Honor Pill */}
                                            {cert.isTeam && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-300 shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                    <Users className="w-3 h-3 text-purple-700" />
                                                    <span>Team Honor</span>
                                                </span>
                                            )}
                                        </div>

                                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                                            {issueDateFormatted}
                                        </span>
                                    </div>

                                    {/* Certificate Title & Club */}
                                    <div className="space-y-1">
                                        <h3 className="text-lg sm:text-xl font-black text-black leading-snug">
                                            {cert.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                                                <span>{cert.clubName}</span>
                                            </div>
                                            {cert.eventTitle && (
                                                <>
                                                    <span>·</span>
                                                    <div className="flex items-center gap-1 text-neutral-500">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>{cert.eventTitle}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {cert.description && (
                                        <p className="text-xs font-medium text-neutral-700 line-clamp-2 leading-relaxed">
                                            {cert.description}
                                        </p>
                                    )}

                                    {/* Credential ID Strip */}
                                    <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between text-xs font-mono">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-bold text-neutral-500">ID:</span>
                                            <span className="font-black text-black truncate">{cert.credentialCode}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyCode(cert.credentialCode)}
                                            className="p-1 rounded hover:bg-neutral-200 text-neutral-700 hover:text-black transition-colors cursor-pointer shrink-0"
                                            title="Copy Credential ID"
                                        >
                                            {copiedCode === cert.credentialCode ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>

                                    {/* SHA-256 Digest Strip */}
                                    {cert.sha256Hash && (
                                        <div className="px-2.5 py-1.5 rounded-lg bg-neutral-900 text-[#a2ff86] flex items-center justify-between text-[10px] font-mono border border-black/40">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Hash className="w-3 h-3 text-[#a2ff86] shrink-0" />
                                                <span className="truncate">{cert.sha256Hash}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyHash(cert.sha256Hash)}
                                                className="text-neutral-300 hover:text-white shrink-0 ml-1.5 cursor-pointer font-sans text-[10px] font-bold"
                                            >
                                                {copiedHash === cert.sha256Hash ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                    )}

                                    {/* Spoiler / Unrevealed Stamp Alert */}
                                    {(cert.isSpoiler || cert.isRevealed === false) && (
                                        <div className="p-3 rounded-xl bg-[#FFE566] border-2 border-black text-black flex items-center justify-between gap-2">
                                            <div className="text-xs font-black inline-flex items-center gap-1.5">
                                                <Gift className="w-4 h-4 text-black shrink-0" />
                                                <span>Unrevealed Certificate Award!</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRevealCertificate(cert)}
                                                disabled={revealingCertId === cert.id}
                                                className="px-3 py-1 rounded-lg bg-black text-[#a2ff86] text-xs font-black border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                            >
                                                {revealingCertId === cert.id ? "Revealing..." : "Reveal Award"}
                                            </button>
                                        </div>
                                    )}

                                    {/* Frozen Team Roster Snapshot if Team Award */}
                                    {cert.isTeam && cert.teamSnapshot?.memberSnapshot && (
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={() => toggleTeamRoster(cert.id)}
                                                className="w-full px-3 py-1.5 rounded-lg border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-[11px] font-black flex items-center justify-between cursor-pointer transition-colors"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5" />
                                                    <span>
                                                        Awarded to Team: {cert.teamName || "Engineering Team"} (
                                                        {cert.teamSnapshot.memberSnapshot.length} Members)
                                                    </span>
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                )}
                                            </button>

                                            {isExpanded && (
                                                <div className="mt-2 p-3 rounded-xl bg-purple-50/80 border-2 border-purple-200 space-y-1.5 animate-in fade-in duration-200">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                                                        Immutable Roster at Issuance:
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        {cert.teamSnapshot.memberSnapshot.map((member: any, mIdx: number) => (
                                                            <div
                                                                key={mIdx}
                                                                className="px-2.5 py-1 rounded-md bg-white border border-purple-200 text-xs font-bold text-neutral-800 flex items-center justify-between"
                                                            >
                                                                <span>{member.name || member.userName}</span>
                                                                {member.customPosition ? (
                                                                    <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                                                                        {member.customPosition}
                                                                    </span>
                                                                ) : member.role ? (
                                                                    <span className="text-[10px] font-medium text-neutral-500">
                                                                        {member.role}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Superseded Warning Banner inside card */}
                                    {isSuperseded && (
                                        <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 flex items-center justify-between gap-2">
                                            <span>This credential was superseded by an administrative update.</span>
                                            {cert.supersededBy && (
                                                <Link
                                                    to={`/verify/certificate/${encodeURIComponent(cert.supersededBy.credentialCode || "")}`}
                                                    className="font-black text-black underline flex items-center gap-1 shrink-0"
                                                >
                                                    <span>View Newest</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            )}
                                        </div>
                                    )}

                                    {/* Revocation notice inside card */}
                                    {isRevoked && cert.revocationReason && (
                                        <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900">
                                            Revocation Reason: &quot;{cert.revocationReason}&quot;
                                        </div>
                                    )}
                                </div>

                                {/* Card Bottom Action Toolbar */}
                                <div className="p-4 sm:p-5 bg-[#FAF6EE] border-t-3 border-black flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        {/* Vector Preview Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenPreview(cert)}
                                            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Preview</span>
                                        </button>

                                        {/* Download Official PDF */}
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPdf(cert.credentialCode)}
                                            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>PDF</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Public Verification Link */}
                                        <Link
                                            to={`/verify/certificate/${encodeURIComponent(cert.credentialCode)}`}
                                            className="p-2 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                            title="Public Verification Portal"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                        </Link>

                                        {/* Share Verification Link */}
                                        <button
                                            type="button"
                                            onClick={() => handleCopyVerificationLink(cert.credentialCode)}
                                            className="p-2 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                            title="Share Credential Link"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom Illustration */}
            {!compact && <SectionBottomIllustration alt="Certificate Wallet Illustration" />}

            {/* Vector SVG Modal Preview */}
            {previewCert && (
                <div
                    onClick={() => setPreviewCert(null)}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl bg-white rounded-2xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-3.5 bg-[#FAF6EE] border-b-3 border-black flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                <span className="font-black text-sm tracking-wide uppercase text-black">
                                    Official Vector Preview: {previewCert.title}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewCert(null)}
                                className="p-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body: Vector SVG */}
                        <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[300px] bg-neutral-100">
                            {loadingPreview ? (
                                <div className="p-12 text-center space-y-3">
                                    <OrbixLoader size="md" />
                                    <span className="text-xs font-black text-neutral-700">Rendering vector preview...</span>
                                </div>
                            ) : previewSvg ? (
                                <div
                                    className="w-full flex items-center justify-center overflow-hidden rounded-xl border-2 border-black/20 shadow-md bg-white p-2"
                                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                                />
                            ) : (
                                <div className="text-xs font-bold text-neutral-500">
                                    Unable to render SVG preview. You can still download the official PDF.
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t-3 border-black flex items-center justify-between flex-wrap gap-2">
                            <div className="text-xs font-mono font-bold text-neutral-600">
                                Credential: <span className="font-black text-black">{previewCert.credentialCode}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(previewCert.credentialCode)}
                                    className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download PDF</span>
                                </button>
                                <Link
                                    to={`/verify/certificate/${encodeURIComponent(previewCert.credentialCode)}`}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Verify Online</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
