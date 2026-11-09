import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    Download,
    Share2,
    Trash2,
    Check,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    ShieldCheck,
    RefreshCw,
    X,
    ExternalLink,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchCertificateHistory,
    revokeCertificate,
    type CertificateHistoryItem,
} from "../../../api/certificateStudioApi";
import { NeoSelect } from "../../../components/NeoSelect";

interface IssuanceHistoryViewProps {
    clubId: string;
    onNavigateToIssue?: () => void;
}

export const IssuanceHistoryView: React.FC<IssuanceHistoryViewProps> = ({
    onNavigateToIssue,
}) => {
    const toast = useToast();

    // Query states
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("newest");
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(15);

    // Data states
    const [loading, setLoading] = useState(true);
    const [certificates, setCertificates] = useState<CertificateHistoryItem[]>([]);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(0);

    // Revocation modal state
    const [revokingCert, setRevokingCert] = useState<CertificateHistoryItem | null>(null);
    const [revocationReason, setRevocationReason] = useState("");
    const [isRevoking, setIsRevoking] = useState(false);

    // Copy states
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchCertificateHistory({
                page,
                limit,
                search: searchQuery.trim(),
                filter: filterType,
                sortBy,
            });
            setCertificates(res.certificates || []);
            setTotalPages(res.pagination?.totalPages || 1);
            setTotalCount(res.pagination?.total || 0);
        } catch (err: any) {
            console.error("Failed to load certificate history:", err);
            toast.error(err.message || "Failed to load certificate history.");
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchQuery, filterType, sortBy, toast]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Handle search submission or typing
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    const handleCopyVerifyUrl = (code: string) => {
        const url = `${window.location.origin}/verify/certificate/${encodeURIComponent(code)}`;
        navigator.clipboard.writeText(url);
        setCopiedCode(code);
        toast.success("Verification link copied to clipboard!");
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleConfirmRevoke = async () => {
        if (!revokingCert) return;
        setIsRevoking(true);
        try {
            await revokeCertificate(
                revokingCert.id,
                revocationReason.trim() || "Administrative revocation"
            );
            toast.success(`Credential ${revokingCert.credentialCode} was officially revoked.`);
            setRevokingCert(null);
            setRevocationReason("");
            loadHistory();
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke certificate.");
        } finally {
            setIsRevoking(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Control Bar: Search, Filters, Sorting */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search recipient name, credential code, title, or event..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none focus:bg-white transition-colors"
                        />
                    </div>

                    {/* Filter and Sort Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <NeoSelect
                            value={filterType}
                            onChange={(val) => {
                                setFilterType(val);
                                setPage(1);
                            }}
                            size="sm"
                            triggerClassName="bg-white text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                        >
                            <option value="all">All Sources & Types</option>
                            <option value="event">Event Turnout Only</option>
                            <option value="manual">Manual Issuance Only</option>
                            <option value="team">Team Awards Only</option>
                            <option value="revoked">Revoked Only</option>
                            <option value="participation">Participation</option>
                            <option value="excellence">Excellence</option>
                            <option value="merit">Merit</option>
                            <option value="appreciation">Appreciation</option>
                        </NeoSelect>

                        <NeoSelect
                            value={sortBy}
                            onChange={(val) => {
                                setSortBy(val);
                                setPage(1);
                            }}
                            size="sm"
                            triggerClassName="bg-white text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="name_asc">Recipient (A → Z)</option>
                            <option value="name_desc">Recipient (Z → A)</option>
                            <option value="verifications">Most Verified</option>
                        </NeoSelect>

                        <button
                            type="button"
                            onClick={loadHistory}
                            disabled={loading}
                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000] text-black"
                            title="Refresh registry"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Subheader info bar */}
                <div className="flex items-center justify-between text-xs font-bold text-neutral-600 pt-1 border-t border-black/10">
                    <div>
                        Showing <span className="font-black text-black">{certificates.length}</span> of{" "}
                        <span className="font-black text-black">{totalCount}</span> total credentials.
                    </div>
                    {onNavigateToIssue && (
                        <button
                            type="button"
                            onClick={onNavigateToIssue}
                            className="text-xs font-black text-black hover:underline flex items-center gap-1"
                        >
                            <span>+ Issue New Certificate</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Credential Registry Table */}
            <div className="rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#FAF6EE] border-b-2 border-black text-[11px] font-black uppercase tracking-wider text-black">
                                <th className="p-3.5 pl-5">Recipient</th>
                                <th className="p-3.5">Credential Code</th>
                                <th className="p-3.5">Title & Type</th>
                                <th className="p-3.5">Event / Source</th>
                                <th className="p-3.5">Issue Date</th>
                                <th className="p-3.5 text-center">Status</th>
                                <th className="p-3.5 pr-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black/5 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-neutral-500 font-bold">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-black" />
                                            <span>Loading issuance records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : certificates.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-neutral-500">
                                        <div className="space-y-2 max-w-sm mx-auto">
                                            <ShieldCheck className="w-8 h-8 text-neutral-400 mx-auto" />
                                            <div className="font-black text-black text-sm">
                                                No Certificates Found
                                            </div>
                                            <p className="text-xs font-medium text-neutral-600">
                                                {searchQuery
                                                    ? `No certificates matched query "${searchQuery}".`
                                                    : "No certificates have been issued under this filter yet."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                certificates.map((cert) => (
                                    <tr
                                        key={cert.id}
                                        className={`hover:bg-[#FAF6EE]/50 transition-colors ${
                                            cert.isRevoked ? "bg-red-50/50" : ""
                                        }`}
                                    >
                                        {/* Recipient */}
                                        <td className="p-3.5 pl-5">
                                            <div className="font-black text-black">
                                                {cert.recipientName}
                                            </div>
                                            {cert.recipientEmail && (
                                                <div className="text-[11px] font-medium text-neutral-500">
                                                    {cert.recipientEmail}
                                                </div>
                                            )}
                                        </td>

                                        {/* Credential Code */}
                                        <td className="p-3.5">
                                            <div className="flex items-center gap-1.5 font-mono font-bold text-black text-[11px]">
                                                <span>{cert.credentialCode}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyVerifyUrl(cert.credentialCode)}
                                                    className="p-1 rounded hover:bg-neutral-200 text-neutral-500 hover:text-black transition-colors"
                                                    title="Copy verification link"
                                                >
                                                    {copiedCode === cert.credentialCode ? (
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                    ) : (
                                                        <Share2 className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                            {cert.verificationCount > 0 && (
                                                <div className="text-[10px] text-neutral-500 font-semibold">
                                                    {cert.verificationCount} {cert.verificationCount === 1 ? "lookup" : "lookups"}
                                                </div>
                                            )}
                                        </td>

                                        {/* Title & Type */}
                                        <td className="p-3.5">
                                            <div className="font-bold text-black line-clamp-1 max-w-[200px]">
                                                {cert.title}
                                            </div>
                                            <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-neutral-100 border border-neutral-300">
                                                {cert.certificateType}
                                            </span>
                                        </td>

                                        {/* Event / Source */}
                                        <td className="p-3.5">
                                            {cert.eventTitle ? (
                                                <span className="font-semibold text-neutral-800 line-clamp-1 max-w-[180px]">
                                                    {cert.eventTitle}
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400 font-medium">Direct / Manual</span>
                                            )}
                                        </td>

                                        {/* Issue Date */}
                                        <td className="p-3.5 text-neutral-600 font-medium whitespace-nowrap">
                                            {cert.issueDate
                                                ? new Date(cert.issueDate).toLocaleDateString("en-US", {
                                                      month: "short",
                                                      day: "numeric",
                                                      year: "numeric",
                                                  })
                                                : "—"}
                                        </td>

                                        {/* Status */}
                                        <td className="p-3.5 text-center">
                                            {cert.isRevoked ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                                                    Revoked
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    Authentic
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <a
                                                    href={`/api/club/certificates/${encodeURIComponent(cert.credentialCode)}/download`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 text-black shadow-[1px_1px_0px_#000]"
                                                    title="Download Official Signed PDF"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>

                                                <a
                                                    href={`/verify/certificate/${encodeURIComponent(cert.credentialCode)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 text-black shadow-[1px_1px_0px_#000]"
                                                    title="Public Verification Page"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>

                                                {!cert.isRevoked && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRevokingCert(cert)}
                                                        className="p-1.5 rounded-lg border border-black bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-[1px_1px_0px_#000]"
                                                        title="Revoke Certificate"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Server-Side Pagination Bar */}
                <div className="p-4 bg-[#FAF6EE] border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-black">
                    <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <NeoSelect
                            value={String(limit)}
                            onChange={(val) => {
                                setLimit(Number(val));
                                setPage(1);
                            }}
                            size="sm"
                            triggerClassName="bg-white font-black text-xs py-1 px-2"
                        >
                            <option value="10">10</option>
                            <option value="15">15</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                        </NeoSelect>
                        <span className="text-neutral-500 font-semibold ml-2">
                            Page {page} of {totalPages}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-white disabled:opacity-40 text-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 font-black cursor-pointer disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-white disabled:opacity-40 text-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 font-black cursor-pointer disabled:cursor-not-allowed"
                        >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Revocation Confirmation Modal */}
            {revokingCert && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border-4 border-black rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0px_#000] space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 text-rose-600">
                                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                                <h3 className="text-lg font-black text-black">
                                    Revoke Credential
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRevokingCert(null)}
                                className="p-1 hover:bg-neutral-100 rounded-lg text-black"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs font-semibold text-neutral-600 leading-relaxed">
                            Are you sure you want to revoke credential{" "}
                            <strong className="text-black font-mono">{revokingCert.credentialCode}</strong>{" "}
                            issued to <strong className="text-black">{revokingCert.recipientName}</strong>?
                            Public verification will immediately display a permanent revocation warning.
                        </p>

                        <div className="space-y-1">
                            <label className="text-xs font-black text-black block">
                                Reason for Revocation (Required for audit log)
                            </label>
                            <textarea
                                value={revocationReason}
                                onChange={(e) => setRevocationReason(e.target.value)}
                                rows={3}
                                placeholder="e.g. Administrative mistake, attendance criteria not fulfilled, or replacement reissued."
                                className="w-full p-2.5 text-xs border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none focus:bg-white resize-none font-medium"
                            />
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRevokingCert(null)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRevoke}
                                disabled={isRevoking || !revocationReason.trim()}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isRevoking ? "Revoking..." : "Confirm Revocation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssuanceHistoryView;
