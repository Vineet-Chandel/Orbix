import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ShieldCheck,
    AlertTriangle,
    Download,
    Share2,
    Copy,
    Check,
    Search,
    Calendar,
    Building2,
    UserCheck,
    ExternalLink,
    Hash,
} from "lucide-react";
import {
    verifyCertificatePublic,
    type PublicVerificationResult,
} from "../../api/certificateStudioApi";

export const PublicCertificateVerifyPage: React.FC = () => {
    const { credentialCode } = useParams<{ credentialCode: string }>();
    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState(credentialCode || "");
    const [loading, setLoading] = useState(Boolean(credentialCode));
    const [result, setResult] = useState<PublicVerificationResult | null>(null);
    const [copiedHash, setCopiedHash] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const performVerification = useCallback(async (code: string) => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const data = await verifyCertificatePublic(code.trim());
            setResult(data);
        } catch (err: any) {
            setResult({
                success: false,
                verified: false,
                message: err?.message || "Failed to reach credential verification server.",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (credentialCode) {
            performVerification(credentialCode);
        } else {
            setLoading(false);
            setResult(null);
        }
    }, [credentialCode, performVerification]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = searchInput.trim();
        if (!code) return;
        navigate(`/verify/certificate/${encodeURIComponent(code)}`);
    };

    const copySha256 = () => {
        if (!result?.certificate?.sha256Hash) return;
        navigator.clipboard.writeText(result.certificate.sha256Hash);
        setCopiedHash(true);
        setTimeout(() => setCopiedHash(false), 2000);
    };

    const copyShareUrl = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleDownloadPdf = async () => {
        const cert = result?.certificate;
        if (!cert) return;
        setDownloading(true);
        try {
            const downloadUrl = `/api/club/certificates/${encodeURIComponent(cert.credentialCode)}/download`;
            window.open(downloadUrl, "_blank");
        } catch (err) {
            console.error("PDF download failed:", err);
        } finally {
            setDownloading(false);
        }
    };

    const cert = result?.certificate;

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-black font-sans flex flex-col justify-between selection:bg-[#FFE566]">
            {/* Top Minimal Brand Navbar */}
            <header className="w-full bg-white border-b-3 border-black px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-[0_2px_0px_#000]">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="text-xl sm:text-2xl font-black tracking-tight text-black flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                        <div className="w-8 h-8 rounded-lg bg-black text-[#FFE566] flex items-center justify-center font-black text-sm border-2 border-black shadow-[2px_2px_0px_#FFE566]">
                            O
                        </div>
                        <span>Orbix</span>
                    </Link>
                    <span className="hidden sm:inline-block text-xs font-black uppercase tracking-wider px-2 py-0.5 bg-[#FFE566] border border-black rounded shadow-[1px_1px_0px_#000]">
                        Credential Registry
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/events"
                        className="text-xs font-black text-neutral-700 hover:text-black hidden sm:inline-block"
                    >
                        Explore Events
                    </Link>
                    <Link
                        to="/auth/signin"
                        className="text-xs font-black text-black px-3.5 py-1.5 rounded-lg border-2 border-black bg-[#a2ff86] shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        Sign In
                    </Link>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
                {/* Search Bar / Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Public Credential Verification Portal</span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-black tracking-tight">
                        Verify Authenticity & Integrity
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-neutral-600 max-w-xl mx-auto">
                        Verify any digital certificate, merit badge, or turnout recognition issued by campus clubs on the Orbix ecosystem.
                    </p>

                    {/* Quick Search Input */}
                    <form
                        onSubmit={handleSearchSubmit}
                        className="max-w-xl mx-auto pt-2 flex items-center gap-2"
                    >
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Enter Credential Code (e.g. ORB-2026-X89J)"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-3 border-black text-xs sm:text-sm font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-black shadow-[3px_3px_0px_#000]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-3 border-black text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-1.5 shrink-0"
                        >
                            <span>Verify</span>
                        </button>
                    </form>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="p-12 rounded-2xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-black border-t-[#a2ff86] rounded-full animate-spin mx-auto" />
                        <div>
                            <h3 className="text-lg font-black text-black">
                                Verifying Cryptographic Seal...
                            </h3>
                            <p className="text-xs font-semibold text-neutral-500">
                                Querying immutable ledger & checking SHA-256 digital signature
                            </p>
                        </div>
                    </div>
                )}

                {/* Result: NOT FOUND / INVALID */}
                {!loading && credentialCode && result && !result.verified && (
                    <div className="p-8 sm:p-10 rounded-2xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-red-100 border-3 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                            <AlertTriangle className="w-8 h-8 text-red-600 stroke-[2.5]" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl sm:text-2xl font-black text-black">
                                Credential Not Found
                            </h2>
                            <p className="text-xs sm:text-sm font-semibold text-neutral-600 max-w-md mx-auto">
                                No valid certificate was found matching code{" "}
                                <code className="px-1.5 py-0.5 rounded bg-neutral-100 font-mono font-bold text-red-700">
                                    {credentialCode}
                                </code>
                                . Please double-check the characters or contact the issuing club.
                            </p>
                        </div>
                    </div>
                )}

                {/* Result: VERIFIED CERTIFICATE CARD */}
                {!loading && cert && (
                    <div className="space-y-5">
                        {/* Revocation Warning Alert if revoked */}
                        {(cert.isRevoked || cert.status === "revoked") && (
                            <div className="p-5 rounded-2xl bg-red-500 text-white border-3 border-black shadow-[5px_5px_0px_#000] space-y-1">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-6 h-6 shrink-0 stroke-[3]" />
                                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
                                        Certificate Officially Revoked
                                    </h3>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-red-100 pl-8">
                                    This certificate was invalidated by the issuing club on{" "}
                                    {cert.revokedAt ? new Date(cert.revokedAt).toLocaleDateString() : "record"}.
                                    {cert.revocationReason && (
                                        <span className="block mt-1 font-mono text-white">
                                            Reason: &quot;{cert.revocationReason}&quot;
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}

                        {/* Superseded Warning Notice if superseded by newer version */}
                        {cert.status === "superseded" && (
                            <div className="p-5 rounded-2xl bg-amber-400 text-black border-3 border-black shadow-[5px_5px_0px_#000] space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-6 h-6 shrink-0 stroke-[3]" />
                                        <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
                                            Notice: Certificate Superseded by Newer Version
                                        </h3>
                                    </div>
                                    {cert.supersededBy && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/verify/certificate/${encodeURIComponent(cert.supersededBy!.credentialCode)}`)}
                                            className="px-3.5 py-1.5 rounded-xl bg-black text-[#FFE566] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 hover:bg-neutral-800 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                        >
                                            <span>View Version {cert.supersededBy.version || (cert.version ? cert.version + 1 : 2)}</span>
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-neutral-900 pl-8">
                                    An updated credential was reissued by {cert.clubName || "the issuing club"}. This historical record is preserved for immutable verification auditing.
                                </p>
                            </div>
                        )}

                        {/* Verified Credential Dossier */}
                        <div className="rounded-2xl bg-white border-3 border-black shadow-[7px_7px_0px_#000] overflow-hidden">
                            {/* Verification Banner */}
                            <div className={`p-5 sm:p-6 border-b-3 border-black flex flex-wrap items-center justify-between gap-4 ${
                                cert.isRevoked || cert.status === "revoked"
                                    ? "bg-red-50"
                                    : cert.status === "superseded"
                                    ? "bg-amber-100"
                                    : "bg-[#a2ff86]"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                        {cert.isRevoked || cert.status === "revoked" ? (
                                            <AlertTriangle className="w-6 h-6 text-red-600 stroke-[2.5]" />
                                        ) : cert.status === "superseded" ? (
                                            <AlertTriangle className="w-6 h-6 text-amber-600 stroke-[2.5]" />
                                        ) : (
                                            <ShieldCheck className="w-7 h-7 text-emerald-600 stroke-[2.5]" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                                                {cert.isRevoked || cert.status === "revoked"
                                                    ? "Status: Revoked"
                                                    : cert.status === "superseded"
                                                    ? "Status: Superseded"
                                                    : "Authentic Verified Credential"}
                                            </span>
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000]">
                                                v{cert.version || 1}
                                            </span>
                                            {cert.reissuedFrom && (
                                                <span className="text-[10px] font-mono font-bold text-neutral-600">
                                                    (Reissued from v{cert.reissuedFrom.version})
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-mono font-bold text-neutral-800">
                                            ID: {cert.credentialCode}
                                        </div>
                                    </div>
                                </div>

                                {/* Verification Counter */}
                                <div className="text-right">
                                    <span className="text-[11px] font-bold text-neutral-700 block">
                                        Total Verifications
                                    </span>
                                    <span className="text-lg font-black text-black">
                                        {cert.verificationCount} {cert.verificationCount === 1 ? "lookup" : "lookups"}
                                    </span>
                                </div>
                            </div>

                            {/* Dossier Body */}
                            <div className="p-6 sm:p-8 space-y-6">
                                {/* Recipient and Title */}
                                <div className="space-y-2 pb-6 border-b-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000]">
                                            {cert.certificateType}
                                        </span>
                                        {cert.eventTitle && (
                                            <span className="text-xs font-bold text-neutral-500">
                                                Event Turnout Verified
                                            </span>
                                        )}
                                    </div>

                                    <h2 className="text-2xl sm:text-4xl font-black text-black tracking-tight">
                                        {cert.recipientName}
                                    </h2>

                                    <h3 className="text-base sm:text-xl font-bold text-neutral-800">
                                        {cert.title}
                                    </h3>

                                    {cert.description && (
                                        <p className="text-xs sm:text-sm font-medium text-neutral-600 max-w-2xl leading-relaxed pt-1">
                                            {cert.description}
                                        </p>
                                    )}
                                </div>

                                {/* Key Metadata Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Issuing Organization */}
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                                        <div className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5" />
                                            <span>Issuing Authority</span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            {cert.clubLogoUrl ? (
                                                <img
                                                    src={cert.clubLogoUrl}
                                                    alt={cert.clubName}
                                                    className="w-8 h-8 rounded-lg border border-black object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-black text-[#FFE566] flex items-center justify-center font-black text-xs">
                                                    {cert.clubName?.[0] || "C"}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-xs sm:text-sm font-black text-black">
                                                    {cert.clubName}
                                                </div>
                                                {cert.collegeName && (
                                                    <div className="text-[11px] font-semibold text-neutral-500">
                                                        {cert.collegeName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {cert.clubSlug && (
                                            <Link
                                                to={`/clubs/${cert.clubSlug}`}
                                                className="text-[11px] font-black text-blue-700 hover:underline flex items-center gap-1 pt-1"
                                            >
                                                <span>View Club Campus Profile</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </div>

                                    {/* Issue Date & Signer */}
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                                        <div className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1.5">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            <span>Signer & Issuance Date</span>
                                        </div>
                                        <div className="text-xs sm:text-sm font-black text-black">
                                            {cert.signerName || cert.clubName || "Authorized Signer"}
                                            {cert.signerRole && (
                                                <span className="text-xs font-normal text-neutral-600 block">
                                                    {cert.signerRole}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1 pt-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>
                                                Issued on{" "}
                                                {cert.issueDate
                                                    ? new Date(cert.issueDate).toLocaleDateString("en-US", {
                                                          month: "long",
                                                          day: "numeric",
                                                          year: "numeric",
                                                      })
                                                    : "Official Record"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cryptographic Hash Section */}
                                {cert.sha256Hash && (
                                    <div className="p-4 rounded-xl bg-neutral-900 text-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300">
                                                <Hash className="w-3.5 h-3.5 text-[#a2ff86]" />
                                                <span>Cryptographic SHA-256 Digest (Authoritative)</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={copySha256}
                                                className="text-[11px] font-black text-neutral-300 hover:text-white flex items-center gap-1"
                                            >
                                                {copiedHash ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5 text-[#a2ff86]" />
                                                        <span className="text-[#a2ff86]">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div className="font-mono text-[11px] text-[#a2ff86] break-all select-all bg-black/50 p-2.5 rounded-lg border border-neutral-700">
                                            {cert.sha256Hash}
                                        </div>
                                    </div>
                                )}

                                {/* Signing Infrastructure & Authority Seal */}
                                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between text-xs flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="font-bold text-neutral-700">Digital Seal:</span>
                                        <span className="font-black text-black">
                                            {cert.signingMetadata?.infrastructure || "Orbix SHA-256 Authoritative Cryptographic Seal"}
                                        </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-neutral-600 font-bold">
                                        Algorithm: {cert.signingMetadata?.algorithm || "SHA-256"}
                                    </span>
                                </div>

                                {/* Action Buttons & Social Sharing */}
                                <div className="pt-2 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleDownloadPdf}
                                        disabled={downloading}
                                        className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-3 border-black font-black text-xs sm:text-sm shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                    >
                                        <Download className="w-4 h-4 stroke-[2.5]" />
                                        <span>{downloading ? "Preparing PDF..." : "Download Official PDF"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={copyShareUrl}
                                        className="px-5 py-3 rounded-xl bg-white hover:bg-neutral-50 text-black border-3 border-black font-black text-xs sm:text-sm shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                    >
                                        {copiedLink ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                                <span>Link Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Share2 className="w-4 h-4 stroke-[2.5]" />
                                                <span>Share Link</span>
                                            </>
                                        )}
                                    </button>

                                    <a
                                        href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.title)}&organizationName=${encodeURIComponent(cert.clubName || "Orbix Campus")}&issueYear=${cert.issueDate ? new Date(cert.issueDate).getFullYear() : new Date().getFullYear()}&issueMonth=${cert.issueDate ? new Date(cert.issueDate).getMonth() + 1 : 1}&certUrl=${encodeURIComponent(window.location.href)}&certId=${encodeURIComponent(cert.credentialCode)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-3 rounded-xl bg-[#0077B5] hover:bg-[#006097] text-white border-3 border-black font-black text-xs sm:text-sm shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        title="Add to LinkedIn Profile"
                                    >
                                        <span>Add to LinkedIn</span>
                                    </a>

                                    <a
                                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I earned a verified "${cert.title}" certificate from ${cert.clubName || "campus club"} on @Orbix! Verify authenticity:`)}&url=${encodeURIComponent(window.location.href)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white border-3 border-black font-black text-xs sm:text-sm shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        title="Post on X"
                                    >
                                        <span>Post on X</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="w-full bg-white border-t-3 border-black px-4 py-6 text-center text-xs font-semibold text-neutral-600 space-y-1">
                <div>
                    Powered by{" "}
                    <Link to="/" className="font-black text-black hover:underline">
                        Orbix Campus Network
                    </Link>{" "}
                    · Tamper-Proof Digital Credential Infrastructure
                </div>
                <div className="text-[11px] text-neutral-400">
                    All certificates are cryptographically verifiable and immutable.
                </div>
            </footer>
        </div>
    );
};

export default PublicCertificateVerifyPage;
