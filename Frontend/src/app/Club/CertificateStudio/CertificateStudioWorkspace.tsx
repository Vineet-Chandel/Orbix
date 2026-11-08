import React, { useState, useEffect, useCallback } from "react";
import {
    Award,
    Sparkles,
    Palette,
    Send,
    RefreshCw,
    ShieldCheck,
    CalendarDays,
    ChevronRight,
    Clock,
    AlertCircle,
    UploadCloud,
    Users,
    UserCheck,
    Ban,
    Settings,
    Layers,
    History,
    ExternalLink,
    Eye,
} from "lucide-react";
import type {
    CertificateDesign,
    CertificateTemplateRecord,
} from "../../../types/certificateStudio";
import {
    fetchCertificateTemplates,
    fetchCertificateStats,
    createCertificateTemplate,
    verifyCertificatePublic,
    type CertificateDashboardStats,
    type PublicVerificationResult,
} from "../../../api/certificateStudioApi";
import { TemplateSelectionView } from "./TemplateSelectionView";
import { CertificateDesignEditor } from "./CertificateDesignEditor";
import { PreviewAndValidationStudio } from "./PreviewAndValidationStudio";
import { IssuanceConsoleView } from "./IssuanceConsoleView";
import { ManualIssuanceView } from "./ManualIssuanceView";
import { IssuanceHistoryView } from "./IssuanceHistoryView";
import { BatchesAndRegistryView } from "./BatchesAndRegistryView";
import { CertificateSettingsView } from "./CertificateSettingsView";

export type StudioWorkspaceTab =
    | "overview"
    | "studio"
    | "preview-studio"
    | "templates"
    | "event-issuance"
    | "manual-issuance"
    | "batches"
    | "history"
    | "verification"
    | "settings";

interface CertificateStudioWorkspaceProps {
    clubId: string;
    clubName?: string;
    clubLogo?: string | null;
    onOpenLegacyModal?: () => void;
}

const defaultDesign: CertificateDesign = {
    page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
    background: {
        type: "color",
        color: "#FFFFFF",
        borderStyle: "double",
        borderColor: "#000000",
        borderWidth: 4,
    },
    elements: [
        {
            id: "el_title",
            type: "static-text",
            x: 50,
            y: 60,
            width: 742,
            height: 50,
            zIndex: 1,
            text: "CERTIFICATE OF EXCELLENCE",
            style: {
                fontFamily: "Space Grotesk",
                fontSize: 28,
                fontWeight: "900",
                color: "#000000",
                textAlign: "center",
            },
        },
        {
            id: "el_presented",
            type: "static-text",
            x: 50,
            y: 130,
            width: 742,
            height: 25,
            zIndex: 1,
            text: "PROUDLY PRESENTED TO",
            style: {
                fontFamily: "Inter",
                fontSize: 12,
                fontWeight: "700",
                color: "#666666",
                textAlign: "center",
                letterSpacing: 2,
            },
        },
        {
            id: "el_recipient",
            type: "dynamic-text",
            x: 80,
            y: 175,
            width: 682,
            height: 60,
            zIndex: 2,
            fieldKey: "recipient.name",
            fallbackValue: "Participant Name",
            style: {
                fontFamily: "Playfair Display",
                fontSize: 36,
                fontWeight: "bold",
                color: "#000000",
                textAlign: "center",
            },
        },
        {
            id: "el_desc",
            type: "static-text",
            x: 100,
            y: 260,
            width: 642,
            height: 50,
            zIndex: 1,
            text: "For demonstrating exemplary technical prowess and outstanding collaborative spirit.",
            style: {
                fontFamily: "Inter",
                fontSize: 14,
                fontWeight: "500",
                color: "#333333",
                textAlign: "center",
            },
        },
        {
            id: "el_qr",
            type: "qr-code",
            x: 50,
            y: 470,
            width: 70,
            height: 70,
            zIndex: 2,
            fieldKey: "certificate.credentialCode",
        },
        {
            id: "el_sig_line",
            type: "shape",
            x: 590,
            y: 505,
            width: 190,
            height: 2,
            zIndex: 1,
            shapeType: "rectangle",
            fillColor: "#000000",
        },
        {
            id: "el_signer",
            type: "dynamic-text",
            x: 590,
            y: 515,
            width: 190,
            height: 20,
            zIndex: 2,
            fieldKey: "certificate.signerName",
            fallbackValue: "Faculty Advisor",
            style: {
                fontFamily: "Inter",
                fontSize: 13,
                fontWeight: "bold",
                color: "#000000",
                textAlign: "center",
            },
        },
    ],
};

export const CertificateStudioWorkspace: React.FC<CertificateStudioWorkspaceProps> = ({
    clubId,
    clubName,
    clubLogo,
    onOpenLegacyModal,
}) => {
    const [activeTab, setActiveTab] = useState<StudioWorkspaceTab>("overview");
    const [templates, setTemplates] = useState<CertificateTemplateRecord[]>([]);
    const [systemTemplates, setSystemTemplates] = useState<CertificateTemplateRecord[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Active design document and template reference
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [activeDesign, setActiveDesign] = useState<CertificateDesign>(defaultDesign);
    const [templateName, setTemplateName] = useState<string>("Orbix Standard Certificate");
    const [templateInitialTab, setTemplateInitialTab] = useState<"library" | "upload" | "scratch" | "my-templates">("library");

    // 8 Dashboard Metrics
    const [metrics, setMetrics] = useState<CertificateDashboardStats>({
        totalCertificatesIssued: 0,
        eventCertificates: 0,
        manualCertificates: 0,
        individualCertificates: 0,
        teamCertificates: 0,
        pendingIssuance: 0,
        failedGenerations: 0,
        revokedCertificates: 0,
    });

    // In-dashboard verification tester
    const [verifyTestCode, setVerifyTestCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState<PublicVerificationResult | null>(null);

    const loadWorkspaceData = useCallback(async () => {
        setLoadingData(true);
        try {
            const [tplRes, statsRes] = await Promise.allSettled([
                fetchCertificateTemplates(),
                fetchCertificateStats(),
            ]);

            if (tplRes.status === "fulfilled") {
                setSystemTemplates(tplRes.value.systemTemplates || []);
                setTemplates(tplRes.value.clubTemplates || []);
            }

            if (statsRes.status === "fulfilled") {
                setMetrics(statsRes.value);
            }
        } catch (err) {
            console.error("Failed to load certificate workspace data:", err);
        } finally {
            setLoadingData(false);
        }
    }, [clubId]);

    useEffect(() => {
        loadWorkspaceData();
    }, [loadWorkspaceData]);

    // Handle template picked from library
    const handleTemplateSelected = (tpl: any) => {
        setActiveTemplateId(tpl.id || null);
        setActiveDesign(tpl.design || defaultDesign);
        setTemplateName(tpl.name || "Custom Certificate");
        setActiveTab("studio");
    };

    // Quick Action: Create Certificate Design -> Opens professional template selection experience
    const handleActionCreateDesign = () => {
        setTemplateInitialTab("library");
        setActiveTab("templates");
    };

    // Quick Action: Upload Certificate Design -> Opens upload option
    const handleActionUploadDesign = () => {
        setTemplateInitialTab("upload");
        setActiveTab("templates");
    };

    // Quick Action: Choose Template -> Opens library option
    const handleActionChooseTemplate = () => {
        setTemplateInitialTab("library");
        setActiveTab("templates");
    };

    // Quick Action: Issue Event
    const handleActionIssueEvent = () => {
        setActiveTab("event-issuance");
    };

    // Quick Action: Issue Manual
    const handleActionIssueManual = () => {
        setActiveTab("manual-issuance");
    };

    // Quick Action: Test Code Verification
    const handleTestVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = verifyTestCode.trim();
        if (!code) return;
        setVerifying(true);
        try {
            const res = await verifyCertificatePublic(code);
            setVerifyResult(res);
        } catch (err: any) {
            setVerifyResult({
                success: false,
                verified: false,
                message: err.message || "Failed to query verification service.",
            });
        } finally {
            setVerifying(false);
        }
    };

    const allAvailableTemplates = [...systemTemplates, ...templates];

    // Navigation Tab Items Definition
    const navItems: Array<{ id: StudioWorkspaceTab; label: string; icon: any }> = [
        { id: "overview", label: "Overview", icon: Award },
        { id: "studio", label: "Certificate Studio", icon: Palette },
        ...(activeTab === "preview-studio"
            ? [{ id: "preview-studio" as StudioWorkspaceTab, label: "Preview & Validation", icon: Eye }]
            : []),
        { id: "templates", label: "My Templates", icon: Layers },
        { id: "event-issuance", label: "Event Issuance", icon: CalendarDays },
        { id: "manual-issuance", label: "Manual Issuance", icon: UserCheck },
        { id: "batches", label: "Certificate Batches", icon: Clock },
        { id: "history", label: "Issuance History", icon: History },
        { id: "verification", label: "Verification", icon: ShieldCheck },
        { id: "settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className="space-y-6">
            {/* Top Minimal Neo-brutalist Workspace Navigation Bar */}
            <div className="p-3 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
                <nav className="flex items-center gap-1.5 min-w-max">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-transparent"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Workspace Header Banner */}
                    <div className="p-6 sm:p-7 rounded-2xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] relative overflow-hidden">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                            <div className="space-y-2 max-w-3xl">
                                <div className="flex flex-wrap items-center gap-2">
                                    {clubLogo && (
                                        <img
                                            src={clubLogo}
                                            alt={clubName || "Club"}
                                            className="w-6 h-6 rounded-md border border-black object-cover"
                                        />
                                    )}
                                    {clubName && (
                                        <span className="text-xs font-black text-black">
                                            {clubName}
                                        </span>
                                    )}
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        <span>Phase 1 · Credential Hub</span>
                                    </span>
                                    <span className="text-xs font-bold text-neutral-500 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full">
                                        SHA-256 Verifiable
                                    </span>
                                </div>

                                <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                    Digital Credential Studio & Issuance
                                </h2>

                                <p className="text-xs sm:text-sm font-semibold text-neutral-600 leading-relaxed max-w-2xl">
                                    Create visual certificates, enforce verified turnout eligibility, issue individual and team awards, and maintain a tamper-proof credential registry.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {onOpenLegacyModal && (
                                    <button
                                        type="button"
                                        onClick={onOpenLegacyModal}
                                        className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-600"
                                    >
                                        Quick Modal
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={loadWorkspaceData}
                                    disabled={loadingData}
                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold text-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                                    title="Refresh metrics"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
                                    <span>Refresh</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* PROMINENT MAIN ACTIONS BAR (The 5 requested main actions) */}
                    <div className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-wider text-neutral-500">
                            Main Workflows & Actions
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                            <button
                                type="button"
                                onClick={handleActionCreateDesign}
                                className="p-4 rounded-xl bg-[#FFE566] hover:bg-[#fed93d] border-3 border-black shadow-[3px_3px_0px_#000] text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 group cursor-pointer flex flex-col justify-between h-full"
                            >
                                <div className="space-y-1">
                                    <div className="w-8 h-8 rounded-lg bg-black text-[#FFE566] flex items-center justify-center mb-2">
                                        <Palette className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <h4 className="font-black text-xs sm:text-sm text-black">
                                        Create Certificate Design
                                    </h4>
                                    <p className="text-[11px] font-semibold text-neutral-800 leading-snug">
                                        Start with visual canvas & dynamic data tokens
                                    </p>
                                </div>
                                <div className="mt-3 text-[11px] font-black text-black flex items-center gap-1">
                                    <span>Launch Canvas</span> &rarr;
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleActionUploadDesign}
                                className="p-4 rounded-xl bg-white hover:bg-neutral-50 border-3 border-black shadow-[3px_3px_0px_#000] text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 group cursor-pointer flex flex-col justify-between h-full"
                            >
                                <div className="space-y-1">
                                    <div className="w-8 h-8 rounded-lg bg-[#70D6FF] text-black border border-black flex items-center justify-center mb-2">
                                        <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <h4 className="font-black text-xs sm:text-sm text-black">
                                        Upload Certificate Design
                                    </h4>
                                    <p className="text-[11px] font-semibold text-neutral-600 leading-snug">
                                        Import custom PNG, JPG or sanitized SVG art
                                    </p>
                                </div>
                                <div className="mt-3 text-[11px] font-black text-black flex items-center gap-1">
                                    <span>Upload Art</span> &rarr;
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleActionChooseTemplate}
                                className="p-4 rounded-xl bg-white hover:bg-neutral-50 border-3 border-black shadow-[3px_3px_0px_#000] text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 group cursor-pointer flex flex-col justify-between h-full"
                            >
                                <div className="space-y-1">
                                    <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center mb-2">
                                        <Layers className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <h4 className="font-black text-xs sm:text-sm text-black">
                                        Choose Existing Template
                                    </h4>
                                    <p className="text-[11px] font-semibold text-neutral-600 leading-snug">
                                        Browse 6 Orbix system master presets
                                    </p>
                                </div>
                                <div className="mt-3 text-[11px] font-black text-black flex items-center gap-1">
                                    <span>Explore Presets</span> &rarr;
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleActionIssueEvent}
                                className="p-4 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] border-3 border-black shadow-[3px_3px_0px_#000] text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 group cursor-pointer flex flex-col justify-between h-full"
                            >
                                <div className="space-y-1">
                                    <div className="w-8 h-8 rounded-lg bg-black text-[#a2ff86] flex items-center justify-center mb-2">
                                        <CalendarDays className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <h4 className="font-black text-xs sm:text-sm text-black">
                                        Issue Event Certificates
                                    </h4>
                                    <p className="text-[11px] font-semibold text-neutral-800 leading-snug">
                                        Turnout-verified attendance roster delivery
                                    </p>
                                </div>
                                <div className="mt-3 text-[11px] font-black text-black flex items-center gap-1">
                                    <span>Select Event</span> &rarr;
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={handleActionIssueManual}
                                className="p-4 rounded-xl bg-white hover:bg-neutral-50 border-3 border-black shadow-[3px_3px_0px_#000] text-left transition-transform active:translate-x-0.5 active:translate-y-0.5 group cursor-pointer flex flex-col justify-between h-full"
                            >
                                <div className="space-y-1">
                                    <div className="w-8 h-8 rounded-lg bg-[#FFDE59] text-black border border-black flex items-center justify-center mb-2">
                                        <UserCheck className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <h4 className="font-black text-xs sm:text-sm text-black">
                                        Issue Manual Certificates
                                    </h4>
                                    <p className="text-[11px] font-semibold text-neutral-600 leading-snug">
                                        Direct search across campus student network
                                    </p>
                                </div>
                                <div className="mt-3 text-[11px] font-black text-black flex items-center gap-1">
                                    <span>Search Students</span> &rarr;
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* DASHBOARD METRICS: The 8 Requested Metrics in 4x2 Grid */}
                    <div className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-wider text-neutral-500">
                            Issuance & Credential Ledger Metrics
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* 1. Total Certificates Issued */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <Award className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.totalCertificatesIssued}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Total Issued
                                    </div>
                                </div>
                            </div>

                            {/* 2. Event Certificates */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <CalendarDays className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.eventCertificates}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Event Certificates
                                    </div>
                                </div>
                            </div>

                            {/* 3. Manual Certificates */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#70D6FF] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <UserCheck className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.manualCertificates}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Manual Certificates
                                    </div>
                                </div>
                            </div>

                            {/* 4. Individual Certificates */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#FF90E8] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <Sparkles className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.individualCertificates}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Individual Certs
                                    </div>
                                </div>
                            </div>

                            {/* 5. Team Certificates */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#FFDE59] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <Users className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.teamCertificates}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Team Certificates
                                    </div>
                                </div>
                            </div>

                            {/* 6. Pending Issuance */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-neutral-100 border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <Clock className="w-5 h-5 text-neutral-700 stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.pendingIssuance}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Pending Issuance
                                    </div>
                                </div>
                            </div>

                            {/* 7. Failed Generations */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-rose-100 border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <AlertCircle className="w-5 h-5 text-rose-700 stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.failedGenerations}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Failed Generations
                                    </div>
                                </div>
                            </div>

                            {/* 8. Revoked Certificates */}
                            <div className="p-4 rounded-xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-neutral-200 border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <Ban className="w-5 h-5 text-neutral-700 stroke-[2.5]" />
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-black leading-none">
                                        {metrics.revokedCertificates}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                        Revoked Certs
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Featured Templates Showcase */}
                    <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Master Templates & Club Designs
                                </h3>
                                <p className="text-xs font-semibold text-neutral-600">
                                    Pick any template to customize in the studio, or directly issue credentials with it.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setActiveTab("templates")}
                                className="text-xs font-black text-black flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <span>View All ({allAvailableTemplates.length})</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allAvailableTemplates.slice(0, 3).map((tpl) => (
                                <div
                                    key={tpl.id}
                                    className="p-4 rounded-xl border-2 border-black bg-[#FAF6EE] shadow-[3px_3px_0px_#000] flex flex-col justify-between"
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white border border-black shadow-[1px_1px_0px_#000]">
                                                {tpl.category}
                                            </span>
                                            {tpl.isSystem || tpl.is_system ? (
                                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                                                    Orbix System
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                                    Club Custom
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-sm font-black text-black">{tpl.name}</h4>
                                        <p className="text-xs text-neutral-600 line-clamp-2">
                                            {tpl.description || "Official cryptographically signed credential layout."}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleTemplateSelected(tpl)}
                                            className="text-xs font-black text-black px-2.5 py-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                                        >
                                            <Palette className="w-3.5 h-3.5" />
                                            <span>Customize</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTemplateId(tpl.id);
                                                setActiveDesign(tpl.design || defaultDesign);
                                                setTemplateName(tpl.name || "Custom Certificate");
                                                setActiveTab("event-issuance");
                                            }}
                                            className="text-xs font-black text-black px-3 py-1.5 rounded-lg border border-black bg-[#a2ff86] hover:bg-[#8ee673] flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Issue With This</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CERTIFICATE STUDIO (VISUAL BUILDER) */}
            {activeTab === "studio" && (
                <div className="space-y-4">
                    <CertificateDesignEditor
                        initialDesign={activeDesign}
                        templateName={templateName}
                        onSave={async (design, name) => {
                            setActiveDesign(design);
                            setTemplateName(name);
                            await createCertificateTemplate({
                                name,
                                design,
                                orientation: design.page?.orientation || "landscape",
                                pageWidth: design.page?.width || 842,
                                pageHeight: design.page?.height || 595,
                            });
                            loadWorkspaceData();
                        }}
                        onProceedToIssuance={(design) => {
                            setActiveDesign(design);
                            setActiveTab("preview-studio");
                        }}
                        onBack={() => setActiveTab("overview")}
                    />
                </div>
            )}

            {/* TAB: PREVIEW AND VALIDATION STUDIO (PHASE 7 - MANDATORY PRE-ISSUANCE STAGE) */}
            {activeTab === "preview-studio" && (
                <div className="space-y-4">
                    <PreviewAndValidationStudio
                        design={activeDesign}
                        templateName={templateName}
                        clubName={clubName || "Orbix Developer Society"}
                        clubCollege="Delhi Technological University"
                        onBackToEditor={() => setActiveTab("studio")}
                        onApproveAndProceed={(validatedDesign) => {
                            setActiveDesign(validatedDesign);
                            setActiveTab("event-issuance");
                        }}
                    />
                </div>
            )}

            {/* TAB: MY TEMPLATES / TEMPLATE SELECTION EXPERIENCE */}
            {activeTab === "templates" && (
                <div className="space-y-4">
                    <TemplateSelectionView
                        initialTab={templateInitialTab}
                        onSelectTemplate={(design, name, id) => {
                            setActiveDesign(design);
                            setTemplateName(name);
                            setActiveTemplateId(id || null);
                            setActiveTab("studio");
                        }}
                        onIssueWithTemplate={(design: CertificateDesign, name: string, id?: string) => {
                            setActiveDesign(design);
                            setTemplateName(name);
                            setActiveTemplateId(id || null);
                            setActiveTab("event-issuance");
                        }}
                        onStartScratch={(orientation, themePreset) => {
                            const width = orientation === "landscape" ? 842 : 595;
                            const height = orientation === "landscape" ? 595 : 842;
                            const scratchDesign: CertificateDesign = {
                                page: { width, height, orientation, unit: "pt" },
                                background: {
                                    type: "color",
                                    color: themePreset === "dark" ? "#0F172A" : "#FFFFFF",
                                    borderStyle: "double",
                                    borderColor: "#000000",
                                    borderWidth: 4,
                                },
                                elements: [
                                    {
                                        id: "el_title",
                                        type: "static-text",
                                        x: 50,
                                        y: 60,
                                        width: width - 100,
                                        height: 50,
                                        zIndex: 1,
                                        text: "CERTIFICATE OF ACHIEVEMENT",
                                        style: {
                                            fontFamily: "Space Grotesk",
                                            fontSize: 28,
                                            fontWeight: "900",
                                            color: themePreset === "dark" ? "#FFFFFF" : "#000000",
                                            textAlign: "center",
                                        },
                                    },
                                    {
                                        id: "el_name",
                                        type: "dynamic-text",
                                        x: 80,
                                        y: 180,
                                        width: width - 160,
                                        height: 60,
                                        zIndex: 2,
                                        fieldKey: "recipient.name",
                                        fallbackValue: "Jane Doe",
                                        style: {
                                            fontFamily: "Playfair Display",
                                            fontSize: 36,
                                            fontWeight: "bold",
                                            color: themePreset === "dark" ? "#FFE566" : "#000000",
                                            textAlign: "center",
                                        },
                                    },
                                    {
                                        id: "el_qr",
                                        type: "qr-code",
                                        x: 50,
                                        y: height - 120,
                                        width: 70,
                                        height: 70,
                                        zIndex: 2,
                                        fieldKey: "certificate.credentialCode",
                                    },
                                ],
                            };
                            setActiveDesign(scratchDesign);
                            setTemplateName("New Custom Certificate");
                            setActiveTemplateId(null);
                            setActiveTab("studio");
                        }}
                    />
                </div>
            )}

            {/* TAB: EVENT ISSUANCE */}
            {activeTab === "event-issuance" && (
                <div className="space-y-4">
                    <IssuanceConsoleView
                        design={activeDesign}
                        templateId={activeTemplateId}
                        templateName={templateName}
                        onBatchIssued={(_batchId) => {
                            loadWorkspaceData();
                            setActiveTab("history");
                        }}
                        onBackToEditor={() => setActiveTab("studio")}
                        onOpenPreview={() => setActiveTab("preview-studio")}
                    />
                </div>
            )}

            {/* TAB: MANUAL ISSUANCE */}
            {activeTab === "manual-issuance" && (
                <div className="space-y-4">
                    <ManualIssuanceView
                        clubId={clubId}
                        design={activeDesign}
                        templateId={activeTemplateId}
                        templateName={templateName}
                        onBatchIssued={(_batchId) => {
                            loadWorkspaceData();
                            setActiveTab("history");
                        }}
                        onNavigateToTemplates={() => setActiveTab("templates")}
                        onOpenPreview={() => setActiveTab("preview-studio")}
                    />
                </div>
            )}

            {/* TAB: CERTIFICATE BATCHES */}
            {activeTab === "batches" && (
                <div className="space-y-4">
                    <BatchesAndRegistryView />
                </div>
            )}

            {/* TAB: ISSUANCE HISTORY (SEARCH, FILTER, SORT, SERVER-SIDE PAGINATION) */}
            {activeTab === "history" && (
                <div className="space-y-4">
                    <IssuanceHistoryView
                        clubId={clubId}
                        onNavigateToIssue={() => setActiveTab("event-issuance")}
                    />
                </div>
            )}

            {/* TAB: VERIFICATION TOOL */}
            {activeTab === "verification" && (
                <div className="space-y-6 max-w-3xl">
                    <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-xs font-black">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Credential Verification Tester</span>
                        </div>
                        <h3 className="text-xl font-black text-black">
                            Look Up & Test Credential Authenticity
                        </h3>
                        <p className="text-xs font-semibold text-neutral-600 leading-relaxed">
                            Test any credential code issued by your club or campus chapters. Validates cryptographic signatures, issue dates, and revocation statuses.
                        </p>

                        <form onSubmit={handleTestVerification} className="pt-2 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Enter Credential Code (e.g. ORB-2026-X89J)"
                                value={verifyTestCode}
                                onChange={(e) => setVerifyTestCode(e.target.value)}
                                className="flex-1 p-2.5 text-xs sm:text-sm font-mono font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={verifying || !verifyTestCode.trim()}
                                className="px-5 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] disabled:opacity-50"
                            >
                                {verifying ? "Checking..." : "Verify Code"}
                            </button>
                        </form>
                    </div>

                    {verifyResult && (
                        <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            {verifyResult.verified && verifyResult.certificate ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                        <div className="flex items-center gap-2">
                                            <span className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-400 flex items-center justify-center text-emerald-800">
                                                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                                            </span>
                                            <div>
                                                <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                                                    Authentic Credential Verified
                                                </div>
                                                <div className="text-[11px] font-mono text-neutral-500">
                                                    ID: {verifyResult.certificate.credentialCode}
                                                </div>
                                            </div>
                                        </div>

                                        <a
                                            href={`/verify/certificate/${encodeURIComponent(verifyResult.certificate.credentialCode)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-black text-blue-700 hover:underline flex items-center gap-1"
                                        >
                                            <span>Open Public View</span>
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-neutral-500 font-bold block">Recipient:</span>
                                            <span className="font-black text-black">{verifyResult.certificate.recipientName}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 font-bold block">Title:</span>
                                            <span className="font-bold text-black">{verifyResult.certificate.title}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 font-bold block">Authority:</span>
                                            <span className="font-bold text-black">{verifyResult.certificate.clubName}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 font-bold block">Verifications:</span>
                                            <span className="font-black text-black">{verifyResult.certificate.verificationCount} lookups</span>
                                        </div>
                                    </div>

                                    {verifyResult.certificate.sha256Hash && (
                                        <div className="p-3 bg-neutral-900 text-[#a2ff86] font-mono text-[10px] rounded-lg break-all">
                                            SHA-256: {verifyResult.certificate.sha256Hash}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                    <span>{verifyResult.message || "Invalid or unrecognized credential code."}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: SETTINGS */}
            {activeTab === "settings" && (
                <div className="space-y-4">
                    <CertificateSettingsView clubId={clubId} />
                </div>
            )}
        </div>
    );
};

export default CertificateStudioWorkspace;
