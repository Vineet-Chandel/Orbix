import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Award,
    Copy,
    Download,
    Share2,
    ShieldCheck,
    Calendar,
    Building2,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import type { CertificateItem } from "../../api/clubCertificatesApi";
import { OrbixLogo } from "../../components/OrbixLogo";
import { downloadPassPdf } from "../../utils/passPdfGenerator";

interface CertificateModalProps {
    certificate: CertificateItem | null;
    isOpen: boolean;
    onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
    certificate,
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const certRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !certificate) return null;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(certificate.credentialCode);
        toast.success("Credential Code copied to clipboard!");
    };

    const handleCopyVerificationLink = () => {
        const url = `${window.location.origin}/verify-cert/${encodeURIComponent(certificate.credentialCode)}`;
        navigator.clipboard.writeText(url);
        toast.success("Verification link copied to clipboard!");
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadCertificatePdf = async () => {
        if (!certificate || isDownloading) return;
        const safeTitle = (certificate.title || certificate.eventTitle || "Certificate").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `Orbix-Certificate-${safeTitle}.pdf`;

        try {
            await downloadPassPdf({
                elementId: "official-certificate-frame",
                filename,
                backgroundColor: "#fffdf9",
                pixelRatio: 2.5,
                onStart: () => setIsDownloading(true),
                onSuccess: () => {
                    setIsDownloading(false);
                    toast.success("Certificate PDF downloaded successfully!");
                },
                onError: (err) => {
                    setIsDownloading(false);
                    console.error("Certificate PDF generation error:", err);
                    toast.error("Could not download certificate PDF. Please try again.");
                },
            });
        } catch {
            setIsDownloading(false);
        }
    };

    const formattedDate = new Date(certificate.issueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const getCertTypeBadge = (type: string) => {
        switch (type) {
            case "excellence":
                return { text: "Excellence", bg: "bg-[#FFDE59]", border: "border-black" };
            case "merit":
                return { text: "Merit & Distinction", bg: "bg-[#A6E3E9]", border: "border-black" };
            case "contributor":
                return { text: "Core Contributor", bg: "bg-[#B4F8C8]", border: "border-black" };
            case "organizer":
                return { text: "Event Organizer", bg: "bg-[#FFAEBC]", border: "border-black" };
            case "appreciation":
                return { text: "Appreciation", bg: "bg-[#FBE7C6]", border: "border-black" };
            case "participation":
            default:
                return { text: "Participation", bg: "bg-[#d8b4fe]", border: "border-black" };
        }
    };

    const badge = getCertTypeBadge(certificate.certificateType);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
            <div className="relative w-full max-w-4xl bg-[#FAF6EE] rounded-2xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full">
                {/* Modal Top Bar (Hidden during Print) */}
                <div className="px-5 py-3.5 bg-white border-b-3 border-black flex items-center justify-between gap-3 print:hidden">
                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-black" />
                        <span className="font-black text-sm tracking-wide uppercase">
                            Official Verified Certificate
                        </span>
                        <span className={`px-2 py-0.5 text-[11px] font-black rounded-md border ${badge.border} ${badge.bg}`}>
                            {badge.text}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyVerificationLink}
                            title="Copy Verification Link"
                            className="px-2.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Share Link</span>
                        </button>
                        <button
                            onClick={handleDownloadCertificatePdf}
                            disabled={isDownloading}
                            title="Download Certificate as PDF"
                            className="px-2.5 py-1.5 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{isDownloading ? "Generating..." : "Download PDF"}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Certificate Frame */}
                <div
                    id="official-certificate-frame"
                    ref={certRef}
                    className="p-6 sm:p-10 bg-[#fffdf9] border-[10px] border-double border-black m-4 sm:m-6 rounded-xl relative shadow-inner overflow-hidden select-text"
                >
                    {/* Background Subtle Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                        <Award className="w-96 h-96" />
                    </div>

                    {/* Corner Ornaments */}
                    <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-black" />
                    <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-black" />
                    <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-black" />
                    <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-black" />

                    {/* Content */}
                    <div className="relative z-10 text-center space-y-6">
                        {/* Club & Platform Brand Header */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-black/10 pb-4">
                            <div className="flex items-center gap-3">
                                {certificate.clubLogoUrl ? (
                                    <img
                                        src={certificate.clubLogoUrl}
                                        alt={certificate.clubName}
                                        className="w-12 h-12 rounded-xl border-2 border-black object-cover shadow-[2px_2px_0px_#000]"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_#000]">
                                        {certificate.clubName.charAt(0)}
                                    </div>
                                )}
                                <div className="text-left">
                                    <h4 className="font-black text-base text-black tracking-tight leading-tight">
                                        {certificate.clubName}
                                    </h4>
                                    <p className="text-xs font-bold text-neutral-600 flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        {certificate.collegeName || "Verified Campus Chapter"}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg border-2 border-black bg-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                    <OrbixLogo className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-[11px] font-black uppercase tracking-wider text-black">
                                        Orbix Verified Credential
                                    </div>
                                    <div className="text-[10px] font-mono text-neutral-500">
                                        ID: {certificate.credentialCode}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Title Section */}
                        <div className="space-y-2 pt-2">
                            <p className="text-xs uppercase tracking-[0.25em] font-black text-neutral-500">
                                Certificate of {certificate.certificateType}
                            </p>
                            <h1 className="text-2xl sm:text-4xl font-black text-black tracking-tight font-serif uppercase">
                                {certificate.title}
                            </h1>
                        </div>

                        {/* Recipient Statement */}
                        <div className="space-y-2 py-2">
                            <p className="text-sm font-semibold italic text-neutral-600">
                                This official certificate is proudly conferred to
                            </p>
                            <div className="inline-block relative">
                                <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 px-6 py-1 border-b-4 border-black">
                                    {certificate.recipientName}
                                </h2>
                            </div>
                        </div>

                        {/* Description / Citation */}
                        <div className="max-w-2xl mx-auto px-4">
                            <p className="text-sm sm:text-base font-medium text-neutral-700 leading-relaxed">
                                {certificate.description}
                            </p>
                            {certificate.eventTitle && (
                                <p className="mt-2 text-xs font-bold text-neutral-500">
                                    Conducted for Session: <span className="text-black font-black">"{certificate.eventTitle}"</span>
                                </p>
                            )}
                        </div>

                        {/* Signatures & Seal Footer */}
                        <div className="pt-6 border-t-2 border-black/15 flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
                            {/* Signatory 1 */}
                            <div className="text-center sm:text-left space-y-1">
                                <div className="font-serif italic text-lg sm:text-xl text-black border-b border-black/40 pb-1 px-4 inline-block">
                                    {certificate.signerName || certificate.clubName}
                                </div>
                                <div className="text-[11px] font-black uppercase text-neutral-800 tracking-wider">
                                    {certificate.signerRole || "Lead Club Coordinator"}
                                </div>
                                <div className="text-[10px] font-bold text-neutral-500">
                                    {certificate.clubName}
                                </div>
                            </div>

                            {/* Verified Digital Seal Badge */}
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full border-3 border-black bg-[#a2ff86] flex flex-col items-center justify-center shadow-[3px_3px_0px_#000] rotate-[-5deg]">
                                    <ShieldCheck className="w-7 h-7 text-black stroke-[2.5]" />
                                    <span className="text-[8px] font-black uppercase tracking-tighter">VERIFIED</span>
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-600">
                                    <Calendar className="w-3 h-3" />
                                    {formattedDate}
                                </div>
                            </div>

                            {/* Signatory 2 / Platform Authenticity */}
                            <div className="text-center sm:text-right space-y-1">
                                <div className="font-serif italic text-lg sm:text-xl text-black border-b border-black/40 pb-1 px-4 inline-block">
                                    Orbix Academic Network
                                </div>
                                <div className="text-[11px] font-black uppercase text-neutral-800 tracking-wider">
                                    Campus Chapter Verification
                                </div>
                                <div className="text-[10px] font-mono text-neutral-500">
                                    Cryptographically Signed
                                </div>
                            </div>
                        </div>

                        {/* Credential Code Bar */}
                        <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-neutral-100 border-2 border-black p-2.5 rounded-lg">
                            <span className="font-bold text-neutral-700">
                                Credential ID: <span className="text-black font-black">{certificate.credentialCode}</span>
                            </span>
                            <button
                                onClick={handleCopyCode}
                                className="px-2 py-1 bg-white hover:bg-neutral-200 border border-black rounded text-[11px] font-black flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                            >
                                <Copy className="w-3 h-3" /> Copy Code
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
