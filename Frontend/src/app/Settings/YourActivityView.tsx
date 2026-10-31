import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Laptop,
    Monitor,
    Smartphone,
    Tablet,
    Shield,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    LogOut,
    Clock,
    MapPin,
    RefreshCw,
    Info,
    X,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Radio,
    Sparkles,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import {
    fetchSessionOverview,
    fetchSessionHistory,
    fetchSecurityEvents,
    terminateSession,
    terminateOtherSessions,
    type UserSessionItem,
    type SecurityEventItem,
    type SessionOverviewData,
} from "../../api/sessionActivityApi";

export const YourActivityView: React.FC = () => {
    const toast = useToast();

    // Data states
    const [overview, setOverview] = useState<SessionOverviewData | null>(null);
    const [history, setHistory] = useState<UserSessionItem[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Active sub-tab: "devices" | "security-events"
    const [activeTab, setActiveTab] = useState<"devices" | "security-events">("devices");

    // Modal & Inspection states
    const [inspectedSession, setInspectedSession] = useState<UserSessionItem | null>(null);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Confirmation Modals
    const [sessionToTerminate, setSessionToTerminate] = useState<UserSessionItem | null>(null);
    const [isTerminatingSingle, setIsTerminatingSingle] = useState<boolean>(false);
    const [isRevokeOthersModalOpen, setIsRevokeOthersModalOpen] = useState<boolean>(false);
    const [isRevokingOthers, setIsRevokingOthers] = useState<boolean>(false);

    // Suspicious report modal
    const [suspiciousSessionToReport, setSuspiciousSessionToReport] = useState<UserSessionItem | null>(null);
    const [isReportingSuspicious, setIsReportingSuspicious] = useState<boolean>(false);

    // Deep linking support from Inbox / Security notifications
    const [searchParams] = useSearchParams();
    const deepLinkedSessionId = searchParams.get("sessionId") || searchParams.get("highlight");

    // Fetch all session & security data
    const loadSessionData = useCallback(async (showToast = false) => {
        try {
            if (showToast) setIsRefreshing(true);
            else setIsLoading(true);

            const [overviewRes, historyRes, eventsRes] = await Promise.all([
                fetchSessionOverview(),
                fetchSessionHistory({ limit: 15 }).catch(() => ({ success: true, total: 0, sessions: [] as UserSessionItem[] })),
                fetchSecurityEvents({ limit: 25 }).catch(() => ({ success: true, total: 0, events: [] as SecurityEventItem[] })),
            ]);

            setOverview(overviewRes.overview);
            setHistory(historyRes.sessions || []);
            setSecurityEvents(eventsRes.events || []);

            if (showToast) {
                toast.success("Login activity & device sessions refreshed.");
            }
        } catch (err: any) {
            console.error("[YourActivity] Failed to load sessions:", err);
            toast.error(err?.message || "Failed to load active login sessions.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSessionData();
    }, [loadSessionData]);

    // Auto-inspect deep-linked session if ?sessionId= or ?highlight= is provided
    useEffect(() => {
        if (!deepLinkedSessionId || !overview) return;
        const allSessions = [
            ...(overview.activeSessions || []),
            ...(overview.currentSession ? [overview.currentSession] : []),
            ...(history || []),
        ];
        const match = allSessions.find(
            (s) => s.id === deepLinkedSessionId || s.sessionId === deepLinkedSessionId
        );
        if (match) {
            setInspectedSession(match);
        }
    }, [deepLinkedSessionId, overview, history]);

    // Handle terminating a single session
    const handleConfirmTerminateSession = async () => {
        if (!sessionToTerminate) return;
        setIsTerminatingSingle(true);
        try {
            await terminateSession(sessionToTerminate.sessionId);
            toast.success(`Logged out of ${sessionToTerminate.deviceName || "device"} successfully.`);
            setSessionToTerminate(null);
            if (inspectedSession?.sessionId === sessionToTerminate.sessionId) {
                setInspectedSession(null);
            }
            await loadSessionData();
        } catch (err: any) {
            console.error("[YourActivity] Terminate error:", err);
            toast.error(err?.message || "Failed to terminate device session.");
        } finally {
            setIsTerminatingSingle(false);
        }
    };

    // Handle terminating other sessions
    const handleConfirmTerminateOthers = async () => {
        setIsRevokingOthers(true);
        try {
            const res = await terminateOtherSessions();
            toast.success(`Logged out of ${res.revokedCount} other device(s) successfully.`);
            setIsRevokeOthersModalOpen(false);
            if (inspectedSession && !inspectedSession.isCurrentSession) {
                setInspectedSession(null);
            }
            await loadSessionData();
        } catch (err: any) {
            console.error("[YourActivity] Terminate others error:", err);
            toast.error(err?.message || "Failed to terminate other sessions.");
        } finally {
            setIsRevokingOthers(false);
        }
    };

    // Handle reporting suspicious session ("This Wasn't Me")
    const handleConfirmSuspiciousReport = async () => {
        if (!suspiciousSessionToReport) return;
        setIsReportingSuspicious(true);
        try {
            // Terminate session with suspicious reason
            await terminateSession(suspiciousSessionToReport.sessionId);
            toast.warning(
                `Unrecognized device session for ${suspiciousSessionToReport.deviceName} terminated. We recommend changing your password.`,
                { title: "Suspicious Login Terminated" }
            );
            setSuspiciousSessionToReport(null);
            if (inspectedSession?.sessionId === suspiciousSessionToReport.sessionId) {
                setInspectedSession(null);
            }
            await loadSessionData();
        } catch (err: any) {
            console.error("[YourActivity] Report suspicious error:", err);
            toast.error(err?.message || "Failed to report suspicious session.");
        } finally {
            setIsReportingSuspicious(false);
        }
    };

    // Copy to clipboard helper
    const handleCopy = (text: string, fieldKey: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast.info("Copied to clipboard!");
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Helper to pick device icon
    const renderDeviceIcon = (deviceType: string, className = "w-5 h-5") => {
        switch (deviceType.toLowerCase()) {
            case "mobile":
                return <Smartphone className={className} />;
            case "tablet":
                return <Tablet className={className} />;
            case "desktop":
                return <Monitor className={className} />;
            case "laptop":
            default:
                return <Laptop className={className} />;
        }
    };

    // Helper for relative time
    const formatTimeAgo = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

            if (diffSeconds < 60) return "Just now";
            if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
            if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
            if (diffSeconds < 172800) return "Yesterday";
            return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        } catch {
            return dateStr;
        }
    };

    const formatFullDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    const currentSession = overview?.currentSession || overview?.activeSessions?.[0] || null;
    const otherSessions = (overview?.activeSessions || []).filter(
        (s) => s.id !== currentSession?.id && s.sessionId !== currentSession?.sessionId
    );

    return (
        <div className="space-y-6">
            {/* ========================================================================= */}
            {/* 1. TOP OVERVIEW HERO CARD & METRICS                                       */}
            {/* ========================================================================= */}
            <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-black">Your Activity & Sessions</h3>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black text-xs font-black border border-black shadow-[1.5px_1.5px_0px_#000]">
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                <span>Real-Time Security</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                            Manage where you're logged in, inspect active devices, and monitor account security events.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => loadSessionData(true)}
                            disabled={isRefreshing || isLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isRefreshing ? "animate-spin" : ""}`} />
                            <span>{isRefreshing ? "Checking..." : "Refresh"}</span>
                        </button>

                        {otherSessions.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsRevokeOthersModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Log Out Other Devices</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 4 Metric KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {/* Active Sessions */}
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Active Sessions
                            </span>
                            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse stroke-[2.5]" />
                        </div>
                        <p className="text-2xl font-black text-black">
                            {isLoading ? "..." : (overview?.totalActiveSessions || 1)}
                        </p>
                        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Authorized online</span>
                        </p>
                    </div>

                    {/* Recognized Devices */}
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Recognized Devices
                            </span>
                            <Laptop className="w-3.5 h-3.5 text-neutral-600 stroke-[2.5]" />
                        </div>
                        <p className="text-2xl font-black text-black">
                            {isLoading ? "..." : (overview?.recognizedDevicesCount || 1)}
                        </p>
                        <p className="text-[11px] font-bold text-neutral-600">
                            First-party fingerprinted
                        </p>
                    </div>

                    {/* Current Device Summary */}
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Current Device
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-black text-white text-[9px] font-black uppercase">
                                This
                            </span>
                        </div>
                        <p className="text-sm font-black text-black truncate" title={currentSession?.deviceName || "Current Device"}>
                            {currentSession?.deviceName || "This Device"}
                        </p>
                        <p className="text-[11px] font-bold text-neutral-600 truncate">
                            {currentSession?.operatingSystem || "Web Browser"}
                        </p>
                    </div>

                    {/* Security Standing */}
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Account Standing
                            </span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        </div>
                        <p className="text-sm font-black text-black flex items-center gap-1.5">
                            <span>Protected</span>
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </p>
                        <p className="text-[11px] font-bold text-emerald-700">
                            Zero unverified logins
                        </p>
                    </div>
                </div>

                {/* Sub-Tabs Switcher */}
                <div className="flex items-center gap-2 pt-2 border-t-2 border-black/10">
                    <button
                        type="button"
                        onClick={() => setActiveTab("devices")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                            activeTab === "devices"
                                ? "bg-[#FFE566] text-black shadow-[2.5px_2.5px_0px_#000]"
                                : "bg-white hover:bg-[#FAF6EE] text-neutral-600 shadow-[1px_1px_0px_#000]"
                        }`}
                    >
                        <Laptop className="w-4 h-4 stroke-[2.5]" />
                        <span>Where You're Logged In</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-black text-white text-[10px] font-mono">
                            {overview?.totalActiveSessions || 1}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("security-events")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                            activeTab === "security-events"
                                ? "bg-[#FFE566] text-black shadow-[2.5px_2.5px_0px_#000]"
                                : "bg-white hover:bg-[#FAF6EE] text-neutral-600 shadow-[1px_1px_0px_#000]"
                        }`}
                    >
                        <Shield className="w-4 h-4 stroke-[2.5]" />
                        <span>Security Activity Timeline</span>
                        {securityEvents.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-neutral-200 text-black text-[10px] font-mono border border-black">
                                {securityEvents.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. TAB CONTENT: WHERE YOU'RE LOGGED IN                                    */}
            {/* ========================================================================= */}
            {activeTab === "devices" && (
                <div className="space-y-6">
                    {/* CURRENT DEVICE (HERO CARD) */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Current Active Session</span>
                            </span>
                            <span className="text-[11px] font-mono font-bold text-neutral-500">
                                This Browser
                            </span>
                        </div>

                        {currentSession ? (
                            <div className="p-5 sm:p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] relative overflow-hidden group">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                                        {/* Device Icon */}
                                        <div className="w-13 h-13 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                            {renderDeviceIcon(currentSession.deviceType, "w-6 h-6 text-black stroke-[2.5]")}
                                        </div>

                                        {/* Device Details */}
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-base sm:text-lg font-black text-black">
                                                    {currentSession.deviceName}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-800 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                    <span>Active now</span>
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black text-[10px] font-black border border-black shadow-[1px_1px_0px_#000]">
                                                    This Device
                                                </span>
                                            </div>

                                            <p className="text-xs font-bold text-neutral-700">
                                                {currentSession.browser} {currentSession.browserVersion ? `(${currentSession.browserVersion})` : ""} · {currentSession.operatingSystem}
                                            </p>

                                            <div className="flex items-center gap-3 text-xs text-neutral-600 font-medium flex-wrap pt-0.5">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5 text-neutral-500 stroke-[2.5]" />
                                                    <span>{currentSession.locationSummary || "Location unavailable"}</span>
                                                </span>
                                                <span>·</span>
                                                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                                    <Shield className="w-3 h-3 text-neutral-500 stroke-[2.5]" />
                                                    <span>{currentSession.ipAddressMasked}</span>
                                                </span>
                                                <span>·</span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-neutral-500 stroke-[2.5]" />
                                                    <span>Signed in {formatTimeAgo(currentSession.createdAt)}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setInspectedSession(currentSession)}
                                            className="px-3.5 py-2 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                        >
                                            Inspect Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black text-center font-bold text-xs text-neutral-600">
                                {isLoading ? "Detecting current session..." : "No active session detected."}
                            </div>
                        )}
                    </div>

                    {/* OTHER ACTIVE DEVICES */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                    Other Active Devices
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-black text-[10px] font-mono font-bold border border-black">
                                    {otherSessions.length}
                                </span>
                            </div>

                            {otherSessions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIsRevokeOthersModalOpen(true)}
                                    className="text-xs font-black text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer"
                                >
                                    Log out of all {otherSessions.length} other devices
                                </button>
                            )}
                        </div>

                        {otherSessions.length === 0 ? (
                            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 border-2 border-black flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-5 h-5 text-emerald-800 stroke-[2.5]" />
                                </div>
                                <div className="space-y-0.5">
                                    <h5 className="text-sm font-black text-black">No other active devices</h5>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        You are currently logged in only on this device. When you log in on another laptop, tablet, or phone, it will appear here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {otherSessions.map((session) => (
                                    <div
                                        key={session.sessionId}
                                        className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                            {/* Device Icon */}
                                            <div className="w-11 h-11 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                                {renderDeviceIcon(session.deviceType, "w-5 h-5 text-black stroke-[2.5]")}
                                            </div>

                                            {/* Info */}
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-black text-black">
                                                        {session.deviceName}
                                                    </h5>
                                                    {session.isNewDevice && (
                                                        <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-900">
                                                            New Device
                                                        </span>
                                                    )}
                                                    {session.riskLevel === "suspicious" && (
                                                        <span className="px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-800">
                                                            Flagged
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs font-bold text-neutral-700">
                                                    {session.browser} · {session.operatingSystem}
                                                </p>

                                                <div className="flex items-center gap-2.5 text-xs text-neutral-600 font-medium flex-wrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-neutral-500 stroke-[2.5]" />
                                                        <span>{session.locationSummary || "Location unavailable"}</span>
                                                    </span>
                                                    <span>·</span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-neutral-500 stroke-[2.5]" />
                                                        <span>Last active {formatTimeAgo(session.lastActiveAt)}</span>
                                                    </span>
                                                    <span>·</span>
                                                    <span className="font-mono text-[10.5px]">
                                                        {session.ipAddressMasked}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setInspectedSession(session)}
                                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            >
                                                Details
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSessionToTerminate(session)}
                                                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer inline-flex items-center gap-1"
                                            >
                                                <LogOut className="w-3 h-3 stroke-[2.5]" />
                                                <span>Log Out</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSuspiciousSessionToReport(session)}
                                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black border border-rose-300 hover:border-rose-700 transition-all cursor-pointer"
                                                title="Report unrecognized login and terminate immediately"
                                            >
                                                This Wasn't Me
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PAST / ENDED SESSIONS (COLLAPSIBLE) */}
                    <div className="space-y-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            className="w-full p-4 rounded-2xl bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:bg-[#FAF6EE] transition-all cursor-pointer flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-black stroke-[2.5]" />
                                <div>
                                    <p className="text-xs font-black text-black">
                                        Recently Ended Sessions History
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Inspect previously logged out, expired, or terminated devices.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-neutral-500">
                                    {history.length} record(s)
                                </span>
                                {isHistoryExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-black stroke-[2.5]" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-black stroke-[2.5]" />
                                )}
                            </div>
                        </button>

                        {isHistoryExpanded && (
                            <div className="space-y-2 pl-2 animate-fadeIn">
                                {history.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-center text-xs font-bold text-neutral-600">
                                        No ended session records found.
                                    </div>
                                ) : (
                                    history.map((hSession) => (
                                        <div
                                            key={hSession.id}
                                            className="p-3.5 rounded-xl bg-neutral-50 border-2 border-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-neutral-200 border border-black/40 flex items-center justify-center shrink-0">
                                                    {renderDeviceIcon(hSession.deviceType, "w-4 h-4 text-neutral-700")}
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <p className="font-black text-black truncate">
                                                        {hSession.deviceName} · {hSession.browser}
                                                    </p>
                                                    <p className="text-[11px] text-neutral-600 truncate">
                                                        {hSession.locationSummary || "Location unavailable"} · {hSession.ipAddressMasked}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 text-[10px] font-bold">
                                                    {hSession.revocationReason === "user_logout"
                                                        ? "Logged Out"
                                                        : hSession.revocationReason === "remote_logout"
                                                        ? "Terminated Remotely"
                                                        : hSession.revocationReason === "suspicious_report"
                                                        ? "Terminated (Suspicious)"
                                                        : "Expired"}
                                                </span>
                                                <span className="text-[11px] text-neutral-500 font-medium">
                                                    {formatTimeAgo(hSession.revokedAt || hSession.lastActiveAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. TAB CONTENT: SECURITY ACTIVITY TIMELINE                                */}
            {/* ========================================================================= */}
            {activeTab === "security-events" && (
                <div className="space-y-4">
                    <div className="p-5 sm:p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <h4 className="text-base sm:text-lg font-black text-black flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                                    <span>Account Security Audit Log</span>
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Chronological log of authentications, credential changes, and session management actions.
                                </p>
                            </div>
                        </div>

                        {securityEvents.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-black text-center space-y-2">
                                <ShieldCheck className="w-8 h-8 text-neutral-400 mx-auto stroke-[2]" />
                                <p className="text-sm font-black text-black">No security events recorded yet</p>
                                <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                                    Orbix records authentications, new device alerts, password resets, and session revocations here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 pt-2">
                                {securityEvents.map((evt) => {
                                    const isWarning = evt.severity === "warning";
                                    const isCritical = evt.severity === "high" || evt.severity === "critical";

                                    return (
                                        <div
                                            key={evt.id}
                                            className={`p-4 rounded-2xl border-2 border-black transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                                                isCritical
                                                    ? "bg-rose-50 shadow-[2.5px_2.5px_0px_#e11d48]"
                                                    : isWarning
                                                    ? "bg-amber-50 shadow-[2.5px_2.5px_0px_#d97706]"
                                                    : "bg-[#FAF6EE] shadow-[2.5px_2.5px_0px_#000]"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div
                                                    className={`w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000] ${
                                                        isCritical
                                                            ? "bg-rose-200 text-rose-900"
                                                            : isWarning
                                                            ? "bg-amber-200 text-amber-900"
                                                            : "bg-white text-black"
                                                    }`}
                                                >
                                                    {isCritical ? (
                                                        <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                                                    ) : isWarning ? (
                                                        <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                                                    ) : (
                                                        <Shield className="w-4 h-4 stroke-[2.5]" />
                                                    )}
                                                </div>

                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h5 className="text-xs sm:text-sm font-black text-black">
                                                            {evt.title}
                                                        </h5>
                                                        <span
                                                            className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                isCritical
                                                                    ? "bg-rose-600 text-white"
                                                                    : isWarning
                                                                    ? "bg-amber-500 text-black"
                                                                    : "bg-black text-white"
                                                            }`}
                                                        >
                                                            {evt.severity}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-neutral-700 font-medium">
                                                        {evt.description}
                                                    </p>

                                                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-medium flex-wrap pt-0.5">
                                                        {evt.deviceSummary && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Laptop className="w-3 h-3 stroke-[2]" />
                                                                <span>{evt.deviceSummary}</span>
                                                            </span>
                                                        )}
                                                        {evt.locationSummary && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <MapPin className="w-3 h-3 stroke-[2]" />
                                                                <span>{evt.locationSummary}</span>
                                                            </span>
                                                        )}
                                                        {evt.ipAddressMasked && (
                                                            <span className="font-mono text-[10px]">
                                                                {evt.ipAddressMasked}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="shrink-0 self-end sm:self-start">
                                                <span className="text-[11px] font-mono font-bold text-neutral-600">
                                                    {formatTimeAgo(evt.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. INSPECT SESSION DETAILS MODAL                                          */}
            {/* ========================================================================= */}
            {inspectedSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-xl rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
                                    {renderDeviceIcon(inspectedSession.deviceType, "w-5 h-5 text-black stroke-[2.5]")}
                                </div>
                                <div>
                                    <h4 className="text-base font-black text-black">
                                        {inspectedSession.deviceName}
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        {inspectedSession.isCurrentSession ? "Current active device" : "Remote session"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectedSession(null)}
                                className="w-8 h-8 rounded-lg bg-[#FAF6EE] hover:bg-neutral-200 border-2 border-black flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Grid of Session Attributes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Device Type</span>
                                <p className="font-black text-black capitalize">{inspectedSession.deviceType}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Operating System</span>
                                <p className="font-black text-black">{inspectedSession.operatingSystem} {inspectedSession.operatingSystemVersion || ""}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Browser</span>
                                <p className="font-black text-black">{inspectedSession.browser} {inspectedSession.browserVersion || ""}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Approximate Location</span>
                                <p className="font-black text-black">{inspectedSession.locationSummary || "Location unavailable"}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Client IP (Masked)</span>
                                <p className="font-mono font-bold text-black">{inspectedSession.ipAddressMasked}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Authentication Method</span>
                                <p className="font-black text-black capitalize">{inspectedSession.loginMethod.replace("_", " ")}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">First Signed In</span>
                                <p className="font-bold text-black">{formatFullDate(inspectedSession.createdAt)}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/50 space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Last Active</span>
                                <p className="font-bold text-black">{formatFullDate(inspectedSession.lastActiveAt)}</p>
                            </div>
                        </div>

                        {/* MFA & Risk Pills */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border border-black ${
                                inspectedSession.isMfaAuthenticated ? "bg-[#a2ff86] text-black" : "bg-neutral-100 text-neutral-700"
                            }`}>
                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{inspectedSession.isMfaAuthenticated ? "MFA Verified Session" : "Standard Auth Session"}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-800">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Security Risk: Low</span>
                            </span>
                        </div>

                        {/* Collapsible Technical Details */}
                        <div className="p-3.5 rounded-2xl bg-neutral-100 border-2 border-black/30 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-black flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-neutral-600 stroke-[2.5]" />
                                    <span>Technical Device Signature</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(inspectedSession.userAgentSummary, "ua")}
                                    className="text-[11px] font-bold text-black hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                    {copiedField === "ua" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedField === "ua" ? "Copied" : "Copy UA"}</span>
                                </button>
                            </div>
                            <p className="font-mono text-[10.5px] text-neutral-700 break-all bg-white p-2.5 rounded-xl border border-black/20">
                                {inspectedSession.userAgentSummary}
                            </p>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center justify-between pt-2">
                            {inspectedSession.isCurrentSession ? (
                                <p className="text-xs font-bold text-neutral-500 italic">
                                    This is your current device session.
                                </p>
                            ) : (
                                <div className="flex items-center gap-2 w-full justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const s = inspectedSession;
                                            setInspectedSession(null);
                                            setSuspiciousSessionToReport(s);
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black border border-rose-300 hover:border-rose-700 transition-all cursor-pointer"
                                    >
                                        This Wasn't Me
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const s = inspectedSession;
                                            setInspectedSession(null);
                                            setSessionToTerminate(s);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                        <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Log Out of Device</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. CONFIRMATION MODALS                                                    */}
            {/* ========================================================================= */}
            {/* Single Session Terminate Modal */}
            <ConfirmationModal
                isOpen={!!sessionToTerminate}
                onClose={() => setSessionToTerminate(null)}
                onConfirm={handleConfirmTerminateSession}
                title="Log out of this device?"
                description={
                    <div className="space-y-2">
                        <p>
                            Are you sure you want to end the session for{" "}
                            <strong>{sessionToTerminate?.deviceName || "this device"}</strong> (
                            {sessionToTerminate?.browser} · {sessionToTerminate?.locationSummary})?
                        </p>
                        <p className="text-xs text-neutral-600">
                            The user on this device will be immediately logged out and will need to sign in again to access Orbix.
                        </p>
                    </div>
                }
                confirmLabel="Log Out Device"
                cancelLabel="Keep Device"
                variant="warning"
                isLoading={isTerminatingSingle}
            />

            {/* Revoke All Other Sessions Modal */}
            <ConfirmationModal
                isOpen={isRevokeOthersModalOpen}
                onClose={() => setIsRevokeOthersModalOpen(false)}
                onConfirm={handleConfirmTerminateOthers}
                title="Log out of all other devices?"
                description={
                    <div className="space-y-2">
                        <p>
                            This will immediately terminate <strong>{otherSessions.length} active session(s)</strong> across
                            all other laptops, phones, or tablets.
                        </p>
                        <p className="text-xs text-neutral-600">
                            Your current device will remain logged in. Any other active browser tab will require re-authentication.
                        </p>
                    </div>
                }
                confirmLabel={`Log Out of ${otherSessions.length} Device(s)`}
                cancelLabel="Cancel"
                variant="warning"
                isLoading={isRevokingOthers}
            />

            {/* Suspicious Session ("This Wasn't Me") Modal */}
            <ConfirmationModal
                isOpen={!!suspiciousSessionToReport}
                onClose={() => setSuspiciousSessionToReport(null)}
                onConfirm={handleConfirmSuspiciousReport}
                title="Unrecognized Device Alert"
                description={
                    <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-medium space-y-1">
                            <p className="font-black">Immediate Security Action</p>
                            <p>
                                We will immediately terminate the session for{" "}
                                <strong>{suspiciousSessionToReport?.deviceName}</strong> (
                                {suspiciousSessionToReport?.locationSummary} · {suspiciousSessionToReport?.ipAddressMasked})
                                and log a security alert on your account.
                            </p>
                        </div>
                        <p className="text-xs text-neutral-600">
                            If you believe your account password was compromised, we strongly recommend updating your password and enabling Two-Factor Authentication.
                        </p>
                    </div>
                }
                confirmLabel="Terminate & Protect Account"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={isReportingSuspicious}
            />
        </div>
    );
};
