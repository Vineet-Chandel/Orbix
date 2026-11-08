import React, { useState, useEffect } from "react";
import {
    Search,
    Download,
    Share2,
    Trash2,
    Eye,
    AlertTriangle,
    RefreshCw,
    X,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchIssuedClubCertificates,
    type CertificateItem,
} from "../../../api/clubCertificatesApi";
import {
    fetchCertificateBatches,
    revokeCertificate,
    type CertificateBatchRecord,
} from "../../../api/certificateStudioApi";
import { CertificateModal } from "../../common/CertificateModal";

export const BatchesAndRegistryView: React.FC = () => {
    const toast = useToast();

    const [activeSubTab, setActiveSubTab] = useState<"registry" | "batches">("registry");

    // Issued credentials
    const [certificates, setCertificates] = useState<CertificateItem[]>([]);
    const [loadingCerts, setLoadingCerts] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Batches
    const [batches, setBatches] = useState<CertificateBatchRecord[]>([]);

    // Modal
    const [inspectCert, setInspectCert] = useState<CertificateItem | null>(null);

    // Revocation Modal
    const [revokingCert, setRevokingCert] = useState<CertificateItem | null>(null);
    const [revocationReason, setRevocationReason] = useState("");
    const [isRevoking, setIsRevoking] = useState(false);

    const loadData = async () => {
        setLoadingCerts(true);
        try {
            const list = await fetchIssuedClubCertificates();
            setCertificates(list);
        } catch (err: any) {
            console.error("Failed to load certificates:", err);
            toast.error(err.message || "Failed to load certificates.");
        } finally {
            setLoadingCerts(false);
        }

        try {
            const batchList = await fetchCertificateBatches();
            setBatches(batchList);
        } catch (err) {
            console.error("Failed to load batches:", err);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered certificates
    const filteredCerts = certificates.filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.recipientName.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.credentialCode.toLowerCase().includes(q) ||
            (c.eventTitle && c.eventTitle.toLowerCase().includes(q))
        );
    });

    const handleCopyVerifyLink = (code: string) => {
        const url = `${window.location.origin}/verify/certificate/${encodeURIComponent(code)}`;
        navigator.clipboard.writeText(url);
        toast.success("Public verification URL copied to clipboard!");
    };

    const handleConfirmRevoke = async () => {
        if (!revokingCert) return;
        setIsRevoking(true);
        try {
            await revokeCertificate(revokingCert.id, revocationReason.trim() || "Administrative revocation");
            toast.success(`Revoked credential ${revokingCert.credentialCode}.`);
            setRevokingCert(null);
            setRevocationReason("");
            await loadData();
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke certificate.");
        } finally {
            setIsRevoking(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sub-tabs header */}
            <div className="p-4 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveSubTab("registry")}
                        className={`px-4 py-2 rounded-xl border-2 border-black text-xs font-black transition-all ${
                            activeSubTab === "registry"
                                ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                    >
                        1. Issued Credentials Registry ({certificates.length})
                    </button>

                    <button
                        onClick={() => setActiveSubTab("batches")}
                        className={`px-4 py-2 rounded-xl border-2 border-black text-xs font-black transition-all ${
                            activeSubTab === "batches"
                                ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                    >
                        2. Batch Issuance History ({batches.length})
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4 text-black" />
                    </button>
                </div>
            </div>

            {/* SUB-TAB 1: ISSUED CREDENTIALS REGISTRY */}
            {activeSubTab === "registry" && (
                <div className="p-5 sm:p-6 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by student name, credential ID, or title..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black text-xs font-bold focus:outline-none bg-[#FAF6EE]"
                        />
                    </div>

                    {loadingCerts ? (
                        <div className="p-12 text-center text-xs font-bold text-neutral-500">
                            Loading issued credentials...
                        </div>
                    ) : filteredCerts.length === 0 ? (
                        <div className="p-12 text-center text-xs font-bold text-neutral-500 border-2 border-dashed border-neutral-300 rounded-2xl">
                            No credentials found. Issue certificates from an event roster or template to populate this registry.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b-2 border-black/15 bg-[#FAF6EE] text-black">
                                        <th className="p-3 font-black">Credential ID</th>
                                        <th className="p-3 font-black">Recipient</th>
                                        <th className="p-3 font-black">Award Title</th>
                                        <th className="p-3 font-black">Event / Session</th>
                                        <th className="p-3 font-black">Date</th>
                                        <th className="p-3 font-black text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {filteredCerts.map((c) => (
                                        <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="p-3 font-mono font-black text-black">
                                                {c.credentialCode}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-black text-black">{c.recipientName}</div>
                                                <div className="text-[10px] text-neutral-500">@{c.recipientEmail || "student"}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-black">{c.title}</div>
                                                <span className="px-1.5 py-0.5 text-[9px] font-black rounded uppercase bg-[#FAF6EE] border border-black/20">
                                                    {c.certificateType}
                                                </span>
                                            </td>
                                            <td className="p-3 font-medium text-neutral-700">
                                                {c.eventTitle || "—"}
                                            </td>
                                            <td className="p-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(c.issueDate).toLocaleDateString()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setInspectCert(c)}
                                                        className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                        title="View Certificate"
                                                    >
                                                        <Eye className="w-3.5 h-3.5 text-black" />
                                                    </button>

                                                    <a
                                                        href={`/api/club/certificates/${c.id}/download`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                        title="Download Official PDF"
                                                    >
                                                        <Download className="w-3.5 h-3.5 text-black" />
                                                    </a>

                                                    <button
                                                        onClick={() => handleCopyVerifyLink(c.credentialCode)}
                                                        className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                        title="Copy Verification URL"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5 text-black" />
                                                    </button>

                                                    <button
                                                        onClick={() => setRevokingCert(c)}
                                                        className="p-1.5 rounded-lg border border-black bg-white hover:bg-red-50 text-red-600 shadow-[1px_1px_0px_#000]"
                                                        title="Revoke Credential"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* SUB-TAB 2: BATCH ISSUANCE HISTORY */}
            {activeSubTab === "batches" && (
                <div className="p-5 sm:p-6 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    {batches.length === 0 ? (
                        <div className="p-12 text-center text-xs font-bold text-neutral-500 border-2 border-dashed border-neutral-300 rounded-2xl">
                            No batches recorded. When you issue event or bulk certificates, batch progress logs appear here.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b-2 border-black/15 bg-[#FAF6EE] text-black">
                                        <th className="p-3 font-black">Batch Title</th>
                                        <th className="p-3 font-black">Event / Source</th>
                                        <th className="p-3 font-black">Template</th>
                                        <th className="p-3 font-black">Recipients</th>
                                        <th className="p-3 font-black">Status</th>
                                        <th className="p-3 font-black">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {batches.map((b) => (
                                        <tr key={b.id} className="hover:bg-neutral-50">
                                            <td className="p-3 font-black text-black">
                                                {b.title}
                                            </td>
                                            <td className="p-3 text-neutral-700">
                                                {b.eventTitle || b.issuanceSource.toUpperCase()}
                                            </td>
                                            <td className="p-3 text-neutral-600">
                                                {b.templateName || "Standard Design"} (v{b.templateVersion})
                                            </td>
                                            <td className="p-3 font-bold text-black">
                                                {b.successfulCount} / {b.totalRecipients} Issued
                                            </td>
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                                        b.status === "completed"
                                                            ? "bg-[#a2ff86] border-emerald-800 text-black"
                                                            : b.status === "processing"
                                                            ? "bg-blue-100 border-blue-400 text-blue-800"
                                                            : "bg-red-100 border-red-400 text-red-800"
                                                    }`}
                                                >
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(b.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Inspect Certificate Modal */}
            <CertificateModal
                certificate={inspectCert}
                isOpen={Boolean(inspectCert)}
                onClose={() => setInspectCert(null)}
            />

            {/* Revoke Confirmation Modal */}
            {revokingCert && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white border-3 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-6 space-y-4">
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2 text-red-600 font-black">
                                <AlertTriangle className="w-5 h-5" />
                                <span>Revoke Digital Credential</span>
                            </div>
                            <button
                                onClick={() => setRevokingCert(null)}
                                className="p-1 hover:bg-neutral-100 rounded-lg"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <p className="text-xs text-neutral-600 font-medium">
                            Are you sure you want to revoke credential{" "}
                            <strong className="text-black font-mono">{revokingCert.credentialCode}</strong> conferred to{" "}
                            <strong className="text-black">{revokingCert.recipientName}</strong>? Once revoked, public
                            verification will state the credential is void.
                        </p>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Revocation Audit Reason
                            </label>
                            <input
                                type="text"
                                value={revocationReason}
                                onChange={(e) => setRevocationReason(e.target.value)}
                                placeholder="e.g. Administrative error, Attendance falsification"
                                className="w-full p-2 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE]"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setRevokingCert(null)}
                                className="px-3 py-1.5 rounded-xl border-2 border-black bg-white text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRevoke}
                                disabled={isRevoking}
                                className="px-4 py-1.5 rounded-xl border-2 border-black bg-red-500 hover:bg-red-600 text-white text-xs font-black shadow-[2px_2px_0px_#000]"
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
