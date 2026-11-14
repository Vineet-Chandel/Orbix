import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Heart,
    Share2,
    Users,
    Copy,
    Check,
    Clock,
    ShieldCheck,
    Sparkles,
    Send,
    CheckCircle2,
    RotateCcw,
    Globe,
    Bell,
    Search,
    Link2,
    Flame,
    Lock,
    TrendingUp,
} from "lucide-react";
import { BlogLikeButton, type BlogLikeButtonSize } from "../../Blog/components/ui/BlogLikeButton";
import { EventActionRow, type EventActionRowSize } from "../../../components/events/EventActionRow";
import { NeoSelect } from "../../../components/NeoSelect";

interface SimulatedConnection {
    id: string;
    name: string;
    username: string;
    role: string;
    avatarBg: string;
}

const DEMO_CONNECTIONS: SimulatedConnection[] = [
    { id: "user_01", name: "Priya Patel", username: "@priya_dev", role: "AI & ML Club Lead", avatarBg: "bg-[#FFE566]" },
    { id: "user_02", name: "Aarav Sharma", username: "@aarav_codes", role: "Full Stack Engineer", avatarBg: "bg-[#a2ff86]" },
    { id: "user_03", name: "Rohan Verma", username: "@rohan_v", role: "Competitive Programmer", avatarBg: "bg-[#70D6FF]" },
    { id: "user_04", name: "Ananya Iyer", username: "@ananya_ai", role: "Cloud Architect", avatarBg: "bg-[#FF70A6]" },
    { id: "user_05", name: "Vikram Malhotra", username: "@vikram_m", role: "Hackathon Organizer", avatarBg: "bg-[#FFBD2E]" },
];

export const LikesEventSharingDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Workbench 1: Blog Like Interactive Sandbox State
    // -------------------------------------------------------------------------
    const [likeButtonSize, setLikeButtonSize] = useState<BlogLikeButtonSize>("lg");
    const [likeButtonVariant, setLikeButtonVariant] = useState<"card" | "header" | "badge">("card");
    const [simulatedLiked, setSimulatedLiked] = useState<boolean>(false);
    const [simulatedLikeCount, setSimulatedLikeCount] = useState<number>(142);
    const [isOptimisticLiking, setIsOptimisticLiking] = useState<boolean>(false);

    const handleToggleSimulatedLike = () => {
        setIsOptimisticLiking(true);
        if (simulatedLiked) {
            setSimulatedLiked(false);
            setSimulatedLikeCount((prev) => Math.max(0, prev - 1));
        } else {
            setSimulatedLiked(true);
            setSimulatedLikeCount((prev) => prev + 1);
        }
        setTimeout(() => setIsOptimisticLiking(false), 300);
    };

    // -------------------------------------------------------------------------
    // Workbench 2: Event Action Row & Share Modal Interactive Simulation
    // -------------------------------------------------------------------------
    const [eventActionSize, setEventActionSize] = useState<EventActionRowSize>("md");
    const [demoShareModalOpen, setDemoShareModalOpen] = useState<boolean>(false);
    const [shareModalTab, setShareModalTab] = useState<"internal" | "external">("internal");
    const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set(["user_01"]));
    const [personalNoteText, setPersonalNoteText] = useState<string>("Hey! Check out this national AI hackathon on Orbix. Let's form a team!");
    const [connectionSearch, setConnectionSearch] = useState<string>("");
    const [copiedModalLink, setCopiedModalLink] = useState<boolean>(false);
    const [simulatedInviteSent, setSimulatedInviteSent] = useState<boolean>(false);

    const filteredConnections = useMemo(() => {
        const q = connectionSearch.toLowerCase().trim();
        if (!q) return DEMO_CONNECTIONS;
        return DEMO_CONNECTIONS.filter((c) => c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q));
    }, [connectionSearch]);

    const handleToggleConnection = (id: string) => {
        setSelectedConnectionIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleCopyDemoLink = () => {
        navigator.clipboard?.writeText("https://orbix.dev/college-events?event=national-ai-hackathon-2026");
        setCopiedModalLink(true);
        setTimeout(() => setCopiedModalLink(false), 2000);
    };

    const handleSendSimulatedInvitation = () => {
        setSimulatedInviteSent(true);
        setTimeout(() => {
            setSimulatedInviteSent(false);
            setDemoShareModalOpen(false);
        }, 1200);
    };

    // -------------------------------------------------------------------------
    // Workbench 3: Invitation Limits & 1-Hour Cooldown Simulator
    // -------------------------------------------------------------------------
    const [invitationCycleCount, setInvitationCycleCount] = useState<number>(0);
    const [isCooldownActive, setIsCooldownActive] = useState<boolean>(false);
    const [cooldownSecondsRemaining, setCooldownSecondsRemaining] = useState<number>(3600);
    const [simulationPublicShareCount, setSimulationPublicShareCount] = useState<number>(18);
    const [invitationHistory, setInvitationHistory] = useState<
        Array<{ id: number; timestamp: string; action: string; countDelta: number; status: string }>
    >([
        {
            id: 1,
            timestamp: "14:10:00",
            action: "Cycle Initialized",
            countDelta: 0,
            status: "Ready for Cycle",
        },
    ]);

    // Cooldown countdown timer simulation
    useEffect(() => {
        if (!isCooldownActive) return;
        const interval = setInterval(() => {
            setCooldownSecondsRemaining((prev) => {
                if (prev <= 1) {
                    setIsCooldownActive(false);
                    setInvitationCycleCount(0);
                    return 3600;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isCooldownActive]);

    const handleTriggerInvitationAttempt = () => {
        if (isCooldownActive) return;

        const nextCount = invitationCycleCount + 1;
        const now = new Date().toLocaleTimeString();

        if (nextCount === 1) {
            // First share with this recipient: Public Count +1
            setInvitationCycleCount(1);
            setSimulationPublicShareCount((prev) => prev + 1);
            setInvitationHistory((prev) => [
                {
                    id: Date.now(),
                    timestamp: now,
                    action: "1st Invitation Sent to Priya Patel",
                    countDelta: 1,
                    status: "Qualifying Share: +1 Public Count",
                },
                ...prev,
            ]);
        } else if (nextCount === 2) {
            // Second share: Allowed, Public Count +0
            setInvitationCycleCount(2);
            setInvitationHistory((prev) => [
                {
                    id: Date.now(),
                    timestamp: now,
                    action: "2nd Invitation Sent to Priya Patel",
                    countDelta: 0,
                    status: "Delivered: +0 (Repeat Recipient)",
                },
                ...prev,
            ]);
        } else if (nextCount === 3) {
            // Third share: Allowed, Public Count +0, Triggers 1-Hour Cooldown!
            setInvitationCycleCount(3);
            setIsCooldownActive(true);
            setCooldownSecondsRemaining(3600);
            setInvitationHistory((prev) => [
                {
                    id: Date.now(),
                    timestamp: now,
                    action: "3rd Invitation Sent to Priya Patel",
                    countDelta: 0,
                    status: "Delivered & Cooldown Triggered (1 Hour)",
                },
                ...prev,
            ]);
        }
    };

    const handleFastForwardCooldown = () => {
        setIsCooldownActive(false);
        setInvitationCycleCount(0);
        setCooldownSecondsRemaining(3600);
        setInvitationHistory((prev) => [
            {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                action: "1-Hour Cooldown Expired (Refreshed)",
                countDelta: 0,
                status: "Allowance Refreshed (3 Invites Available, Count Idempotent)",
            },
            ...prev,
        ]);
    };

    const handleResetCooldownSimulation = () => {
        setInvitationCycleCount(0);
        setIsCooldownActive(false);
        setCooldownSecondsRemaining(3600);
        setSimulationPublicShareCount(18);
        setInvitationHistory([
            {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                action: "Simulator Reset",
                countDelta: 0,
                status: "Ready for Cycle",
            },
        ]);
    };

    const formatSeconds = (totalSec: number) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    return (
        <article className="space-y-16 sm:space-y-24">
            {/* ========================================================================= */}
            {/* DOCUMENTARY HERO HEADER                                                   */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF70A6] text-black text-xs font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000]">
                            <Heart className="w-3.5 h-3.5 fill-black stroke-black" />
                            <span>Community &amp; Engagement Standard</span>
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-mono font-bold border border-black shadow-[1.5px_1.5px_0px_#000]">
                            DOCS // INTERACTION_ENGINE
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500">
                        <Clock className="w-4 h-4 text-black" />
                        <span>10 min read</span>
                        <span>•</span>
                        <span>Updated November 2026</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-tight">
                        Orbix Likes &amp; Event Sharing
                    </h1>
                    <p className="text-lg sm:text-2xl font-bold text-neutral-700 leading-snug">
                        Express Appreciation. Share Opportunities. Stay Connected.
                    </p>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed max-w-4xl">
                    Orbix makes it easier for students to engage with content and bring their communities closer to meaningful
                    opportunities. The Likes and Event Sharing features are designed to make interactions across the platform
                    seamless, responsive, and reliable. Whether you're appreciating a technical publication or inviting your accepted
                    connections to participate in a college event, Orbix provides simple, fault-tolerant ways to engage and share.
                </p>

                {/* Technical Metadata Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t-2 border-black/10">
                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                            Blog Appreciation
                        </span>
                        <span className="text-sm font-black text-black">Publication-Bound ID</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                            Sharing Vectors
                        </span>
                        <span className="text-sm font-black text-black">3 Available Actions</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                            Anti-Inflation
                        </span>
                        <span className="text-sm font-black text-black">Unique Public Metric</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                            Cycle Allowance
                        </span>
                        <span className="text-sm font-black text-black">3 Invites / 1h Cooldown</span>
                    </div>
                </div>
            </header>

            {/* Banner Graphic Illustration */}
            <div className="rounded-3xl border-2 sm:border-[3px] border-black overflow-hidden bg-black shadow-[6px_6px_0px_#000] w-full">
                <img
                    src="/assets/likes-sharing-banner.svg"
                    alt="Orbix Likes and Event Sharing Architecture"
                    className="w-full h-auto block select-none"
                />
            </div>

            {/* ========================================================================= */}
            {/* LIVE INTERACTIVE WORKBENCH: REAL COMPONENTS IN ACTION                     */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-black">
                            <Sparkles className="w-4 h-4 text-[#FF70A6]" />
                            <span>Interactive Component Studio</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-black tracking-tight">
                            Live Engagement Workbench
                        </h2>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                        Real Frontend Components Tested
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* ------------------------------------------------------------- */}
                    {/* PANEL 1: BLOG LIKE BUTTON WORKBENCH                           */}
                    {/* ------------------------------------------------------------- */}
                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#FFF5F7] border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                    <span className="text-xs font-black text-black">Blog Like Component</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-neutral-500">
                                    Optimistic UI &bull; Zero Delay
                                </span>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">
                                    Blog Publication Appreciation
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                    Test the live interactive Blog Like button. Toggling triggers an instant optimistic state change
                                    with spring physics animations while persisting the like state to the publication identity.
                                </p>
                            </div>

                            {/* Controls */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                                        Size Preset
                                    </label>
                                    <NeoSelect
                                        value={likeButtonSize}
                                        onChange={(val) => setLikeButtonSize(val as BlogLikeButtonSize)}
                                        options={[
                                            { value: "sm", label: "Small (sm) - 16px" },
                                            { value: "md", label: "Medium (md) - 20px" },
                                            { value: "lg", label: "Large (lg) - 28px" },
                                            { value: "xl", label: "Extra Large (xl) - 36px" },
                                        ]}
                                        size="sm"
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                                        Style Variant
                                    </label>
                                    <NeoSelect
                                        value={likeButtonVariant}
                                        onChange={(val) => setLikeButtonVariant(val as any)}
                                        options={[
                                            { value: "card", label: "Card Layout" },
                                            { value: "header", label: "Article Header" },
                                            { value: "badge", label: "Compact Badge" },
                                        ]}
                                        size="sm"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Interactive Testing Arena */}
                        <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-black flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                            <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                                Click Button Below to Toggle Like
                            </span>

                            {/* Simulated Interactive Like Button with Real UI Specs */}
                            <motion.button
                                type="button"
                                onClick={handleToggleSimulatedLike}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.92 }}
                                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer select-none transition-colors ${
                                    simulatedLiked
                                        ? "bg-red-50 hover:bg-red-100"
                                        : "bg-white hover:bg-neutral-50"
                                }`}
                            >
                                <motion.div
                                    key={simulatedLiked ? "liked" : "unliked"}
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: [0.8, 1.35, 1] }}
                                    transition={{ type: "spring", stiffness: 450, damping: 14 }}
                                >
                                    <Heart
                                        className={`w-6 h-6 transition-colors duration-150 ${
                                            simulatedLiked
                                                ? "fill-red-500 text-red-500 stroke-red-500 stroke-[1.5]"
                                                : "fill-none text-neutral-800 hover:text-red-500 stroke-[2.2]"
                                        }`}
                                    />
                                </motion.div>
                                <span
                                    className={`font-mono text-base tracking-tight tabular-nums font-black ${
                                        simulatedLiked ? "text-red-600" : "text-black"
                                    }`}
                                >
                                    {simulatedLikeCount}
                                </span>
                            </motion.button>

                            {/* State Indicator */}
                            <div className="flex items-center gap-3 text-xs font-mono font-bold pt-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-black">
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            simulatedLiked ? "bg-red-500 animate-pulse" : "bg-neutral-400"
                                        }`}
                                    />
                                    <span>likedByViewer: {String(simulatedLiked)}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-black">
                                    <span>status: {isOptimisticLiking ? "syncing..." : "settled"}</span>
                                </span>
                            </div>
                        </div>

                        {/* Live Production Component Preview */}
                        <div className="p-4 rounded-xl bg-white border-2 border-black flex items-center justify-between text-xs font-bold text-neutral-700">
                            <span className="font-mono">Live Component: &lt;BlogLikeButton /&gt;</span>
                            <BlogLikeButton
                                hoster="aws-sbg-psit"
                                blogName="aws-launchpad-2026"
                                variant={likeButtonVariant}
                                size={likeButtonSize}
                            />
                        </div>
                    </div>

                    {/* ------------------------------------------------------------- */}
                    {/* PANEL 2: EVENT ACTION ROW & SHARING WORKBENCH                 */}
                    {/* ------------------------------------------------------------- */}
                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#F0FDF4] border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Share2 className="w-4 h-4 text-emerald-600" />
                                    <span className="text-xs font-black text-black">Event Action Row &amp; Share</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-neutral-500">
                                    Internal &bull; External &bull; Copy
                                </span>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">
                                    College Event Engagement Bar
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                    Explore the compact action toolbar used across college event listings and details.
                                    Clicking the Share button opens the multi-channel distribution console.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-neutral-600 uppercase">
                                    Row Display Size
                                </label>
                                <NeoSelect
                                    value={eventActionSize}
                                    onChange={(val) => setEventActionSize(val as EventActionRowSize)}
                                    options={[
                                        { value: "sm", label: "Small (sm) - Compact Card View" },
                                        { value: "md", label: "Medium (md) - Standard Listing" },
                                        { value: "lg", label: "Large (lg) - Detailed Modal" },
                                        { value: "xl", label: "Extra Large (xl) - Hero View" },
                                    ]}
                                    size="sm"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Interactive Testing Arena */}
                        <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-black flex flex-col items-center justify-center gap-5 relative">
                            <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                                Click Share to Trigger Modal Preview
                            </span>

                            {/* Simulated Event Action Bar */}
                            <div className="inline-flex items-center gap-6 p-3 px-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                                {/* Like Icon */}
                                <button
                                    type="button"
                                    onClick={handleToggleSimulatedLike}
                                    className="inline-flex items-center gap-2 bg-transparent border-0 cursor-pointer select-none"
                                >
                                    <Heart
                                        className={`w-6 h-6 ${
                                            simulatedLiked
                                                ? "fill-rose-500 text-rose-500 stroke-rose-500"
                                                : "fill-none text-rose-500 stroke-[2.2]"
                                        }`}
                                    />
                                    <span className="font-mono text-base font-black text-black tabular-nums">
                                        {simulatedLikeCount}
                                    </span>
                                </button>

                                <div className="w-[1.5px] h-6 bg-black/15" />

                                {/* Share Icon */}
                                <button
                                    type="button"
                                    onClick={() => setDemoShareModalOpen(true)}
                                    className="inline-flex items-center gap-2 bg-transparent border-0 cursor-pointer select-none group"
                                >
                                    <Share2 className="w-6 h-6 text-neutral-800 group-hover:text-black stroke-[2.2] transition-transform group-hover:scale-110" />
                                    <span className="font-mono text-base font-black text-black tabular-nums">
                                        {simulationPublicShareCount}
                                    </span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setDemoShareModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFE566] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFD700] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Open Event Share Modal Preview</span>
                            </button>
                        </div>

                        {/* Live Production Component Preview */}
                        <div className="p-4 rounded-xl bg-white border-2 border-black flex items-center justify-between text-xs font-bold text-neutral-700">
                            <span className="font-mono">Live Component: &lt;EventActionRow /&gt;</span>
                            <EventActionRow
                                eventId="demo-doc-event-preview"
                                eventTitle="Orbix National Hackathon"
                                initialLikeCount={128}
                                initialShareCount={24}
                                size={eventActionSize}
                            />
                        </div>
                    </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* EMBEDDED MODAL PREVIEW (Interactive Dialog Simulator)        */}
                {/* ------------------------------------------------------------- */}
                <AnimatePresence>
                    {demoShareModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                                className="w-full max-w-lg bg-[#FAF6EE] border-2 sm:border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[8px_8px_0px_#000] space-y-5 max-h-[90vh] overflow-y-auto"
                            >
                                {/* Modal Header */}
                                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black text-[10px] font-black uppercase border border-black">
                                                Share Event
                                            </span>
                                            <span className="text-xs font-mono font-bold text-neutral-500">
                                                {simulationPublicShareCount} Public Shares
                                            </span>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-black">
                                            National AI Hackathon 2026
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDemoShareModalOpen(false)}
                                        className="p-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                    >
                                        <Check className="w-4 h-4 hidden" />
                                        <span className="font-black text-sm px-1">✕</span>
                                    </button>
                                </div>

                                {/* Tab Selector */}
                                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <button
                                        type="button"
                                        onClick={() => setShareModalTab("internal")}
                                        className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            shareModalTab === "internal"
                                                ? "bg-black text-white"
                                                : "bg-transparent text-black hover:bg-neutral-100"
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        <span>Within Orbix (Connections)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShareModalTab("external")}
                                        className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            shareModalTab === "external"
                                                ? "bg-black text-white"
                                                : "bg-transparent text-black hover:bg-neutral-100"
                                        }`}
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        <span>External &bull; Copy Link</span>
                                    </button>
                                </div>

                                {/* Internal Sharing View */}
                                {shareModalTab === "internal" && (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={connectionSearch}
                                                onChange={(e) => setConnectionSearch(e.target.value)}
                                                placeholder="Search accepted connections..."
                                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none shadow-[2px_2px_0px_#000]"
                                            />
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {filteredConnections.map((conn) => {
                                                const isSelected = selectedConnectionIds.has(conn.id);
                                                return (
                                                    <div
                                                        key={conn.id}
                                                        onClick={() => handleToggleConnection(conn.id)}
                                                        className={`p-2.5 rounded-xl border-2 border-black flex items-center justify-between cursor-pointer transition-all ${
                                                            isSelected
                                                                ? "bg-[#F0FDF4] shadow-[3px_3px_0px_#000]"
                                                                : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className={`w-8 h-8 rounded-full border border-black flex items-center justify-center font-black text-xs ${conn.avatarBg}`}
                                                            >
                                                                {conn.name[0]}
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-black text-black block leading-tight">
                                                                    {conn.name}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-neutral-500 block leading-tight">
                                                                    {conn.role}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`w-5 h-5 rounded-md border-2 border-black flex items-center justify-center transition-colors ${
                                                                isSelected ? "bg-[#a2ff86]" : "bg-white"
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Personal Note */}
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-mono font-bold text-neutral-700 uppercase flex items-center justify-between">
                                                <span>Add Optional Personal Note</span>
                                                <span>{personalNoteText.length}/140</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                maxLength={140}
                                                value={personalNoteText}
                                                onChange={(e) => setPersonalNoteText(e.target.value)}
                                                placeholder="Write a quick message to your connections..."
                                                className="w-full p-2.5 rounded-xl bg-white border-2 border-black text-xs font-medium text-black focus:outline-none shadow-[2px_2px_0px_#000]"
                                            />
                                        </div>

                                        {/* Send Action */}
                                        <button
                                            type="button"
                                            disabled={selectedConnectionIds.size === 0 || simulatedInviteSent}
                                            onClick={handleSendSimulatedInvitation}
                                            className="w-full py-2.5 rounded-xl bg-[#a2ff86] text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#90f573] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            {simulatedInviteSent ? (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4 text-black" />
                                                    <span>Invitations Delivered via Orbix Notifications!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    <span>
                                                        Send Invitations ({selectedConnectionIds.size} Selected)
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* External Sharing View */}
                                {shareModalTab === "external" && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-blue-600" />
                                                <span className="text-xs font-black text-black">
                                                    Native Device Sharing
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                                Use your device's native sharing sheet to share this event on WhatsApp, Telegram,
                                                X (Twitter), LinkedIn, or system dialogs.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => alert("Simulated Native Device Sharing Sheet Launched!")}
                                                className="w-full py-2.5 rounded-xl bg-[#70D6FF] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#5ec4ee] cursor-pointer flex items-center justify-center gap-2"
                                            >
                                                <Share2 className="w-3.5 h-3.5" />
                                                <span>Trigger Native Share Dialog</span>
                                            </button>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Link2 className="w-4 h-4 text-amber-600" />
                                                <span className="text-xs font-black text-black">Direct Event URL</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value="https://orbix.dev/college-events?event=national-ai-hackathon-2026"
                                                    className="w-full p-2 rounded-lg bg-[#FAF6EE] border border-black font-mono text-[11px] text-neutral-800 select-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCopyDemoLink}
                                                    className="px-3 py-2 rounded-lg bg-black text-white font-mono text-xs font-bold border border-black cursor-pointer flex items-center gap-1 shrink-0"
                                                >
                                                    {copiedModalLink ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-[#a2ff86]" />
                                                            <span className="text-[#a2ff86]">Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-[10px] font-mono text-neutral-500">
                                                Note: Simple link-copy actions do not increment the public share count (+0).
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 1: FEATURE OVERVIEW                                               */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#FF70A6] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Feature Overview
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        Orbix provides two distinct interaction experiences engineered for responsive performance, audit
                        accountability, and spam-resilient community expansion:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                        {/* A. Blog Likes */}
                        <div className="p-6 rounded-2xl bg-[#FFF5F7] border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-[#FF70A6] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <Heart className="w-5 h-5 text-black fill-black" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black">A. Blog Likes</h3>
                                    <span className="text-xs font-mono font-bold text-neutral-500">
                                        Publication Appreciation
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                The Blog Like feature allows users to express appreciation for published blog content. Users can
                                like or unlike a blog post, view its total likes, and see whether they have already liked it.
                            </p>
                            <div className="space-y-2 pt-2 border-t-2 border-black/10">
                                <span className="text-[11px] font-mono font-bold text-neutral-600 uppercase block">
                                    Key Capabilities:
                                </span>
                                <ul className="space-y-1.5 text-xs text-neutral-800 font-bold">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        <span>Like and unlike published blog posts seamlessly.</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        <span>View total likes with compact formatting (1.2k, 1M).</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        <span>Maintain consistent like state across visits &amp; devices.</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        <span>Receive immediate visual feedback with spring physics.</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        <span>Retrieve updated engagement without page reloads.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* B. College Event Sharing */}
                        <div className="p-6 rounded-2xl bg-[#F0FDF4] border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <Share2 className="w-5 h-5 text-black" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black">B. College Event Sharing</h3>
                                    <span className="text-xs font-mono font-bold text-neutral-500">
                                        Multi-Channel Opportunity Distribution
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                The College Event Share feature allows users to distribute event information within Orbix and
                                through external platforms. Every event can be shared through three available actions:
                            </p>
                            <div className="space-y-2.5 pt-2 border-t-2 border-black/10">
                                <div className="p-2.5 rounded-xl bg-white border border-black space-y-0.5">
                                    <span className="text-xs font-black text-black block">1. Share Within Orbix</span>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Invite accepted connections directly with an optional personal note via Orbix notifications.
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-white border border-black space-y-0.5">
                                    <span className="text-xs font-black text-black block">2. Share Externally</span>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Distribute the event across third-party apps using your device's native sharing sheet.
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-white border border-black space-y-0.5">
                                    <span className="text-xs font-black text-black block">3. Copy Event Link</span>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Copy the event's direct URL to share independently wherever you prefer.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: HOW EVENT SHARING WORKS                                        */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        How Event Sharing Works
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        Orbix supports both internal invitations and external sharing while maintaining strict architectural
                        boundaries and clear counting rules for how event engagement is registered.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Step Card 1 */}
                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-lg bg-[#70D6FF] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black">
                                    01
                                </span>
                                <Users className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-base font-black text-black">Internal Peer Sharing</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                When sharing with Orbix connections:
                            </p>
                            <ol className="space-y-1.5 text-xs text-neutral-800 font-bold list-decimal list-inside">
                                <li>Open the event you want to share.</li>
                                <li>Select the Share option.</li>
                                <li>Choose your target connections.</li>
                                <li>Optionally add a personal note.</li>
                                <li>Send the invitation.</li>
                            </ol>
                            <div className="p-3 rounded-xl bg-white border border-black text-[11px] text-neutral-700 font-mono">
                                Delivered as in-app notification with sender info, note, and 1-click event link. Never sent as DMs.
                            </div>
                        </div>

                        {/* Step Card 2 */}
                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black">
                                    02
                                </span>
                                <Globe className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-base font-black text-black">External Native Sharing</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                To share outside Orbix via native apps:
                            </p>
                            <ol className="space-y-1.5 text-xs text-neutral-800 font-bold list-decimal list-inside">
                                <li>Open the event and tap Share.</li>
                                <li>Choose the external share option.</li>
                                <li>Select an app in the device sheet.</li>
                                <li>Complete the sharing action.</li>
                            </ol>
                            <div className="p-3 rounded-xl bg-white border border-black text-[11px] text-neutral-700 font-mono">
                                External shares are incremented ONLY when the native sharing operation successfully completes.
                            </div>
                        </div>

                        {/* Step Card 3 */}
                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black">
                                    03
                                </span>
                                <Link2 className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-base font-black text-black">Copying Event Link</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Distribute direct links independently:
                            </p>
                            <ol className="space-y-1.5 text-xs text-neutral-800 font-bold list-decimal list-inside">
                                <li>Open the event and select Share.</li>
                                <li>Choose "Copy Event Link".</li>
                                <li>URL is copied to system clipboard.</li>
                                <li>Share wherever you prefer.</li>
                            </ol>
                            <div className="p-3 rounded-xl bg-white border border-black text-[11px] text-neutral-700 font-mono">
                                Copying a link does not increase the public share count (+0), keeping metrics focused on actual shares.
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: UNDERSTANDING EVENT SHARE COUNTS (ACCOUNTING MATRIX)           */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Understanding Event Share Counts
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        Orbix maintains clear, deterministic counting rules to ensure that event engagement figures remain
                        authentic and immune to artificial manipulation:
                    </p>

                    {/* Official Accounting Table */}
                    <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#FAF6EE] border-b-2 border-black">
                                    <th className="p-4 text-xs font-black uppercase tracking-wider text-black">
                                        Sharing Action
                                    </th>
                                    <th className="p-4 text-xs font-black uppercase tracking-wider text-black text-center w-48">
                                        Public Share Count
                                    </th>
                                    <th className="p-4 text-xs font-black uppercase tracking-wider text-black hidden sm:table-cell">
                                        Architectural Rationale
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-black/10 text-xs sm:text-sm font-medium">
                                <tr className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4 font-black text-black flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>First internal share with a recipient</span>
                                    </td>
                                    <td className="p-4 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                                        +1
                                    </td>
                                    <td className="p-4 text-neutral-600 hidden sm:table-cell">
                                        Unique new discovery touchpoint created between sender, recipient, and event.
                                    </td>
                                </tr>
                                <tr className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4 font-black text-neutral-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                        <span>Repeated internal share with the same recipient</span>
                                    </td>
                                    <td className="p-4 text-center font-mono font-black text-neutral-600 bg-neutral-50">
                                        +0
                                    </td>
                                    <td className="p-4 text-neutral-600 hidden sm:table-cell">
                                        Prevents deliberate blast-radius spam from inflating public engagement.
                                    </td>
                                </tr>
                                <tr className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4 font-black text-black flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>Successful external share (Native Sheet)</span>
                                    </td>
                                    <td className="p-4 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                                        +1
                                    </td>
                                    <td className="p-4 text-neutral-600 hidden sm:table-cell">
                                        Confirmed distribution event completed through third-party platform.
                                    </td>
                                </tr>
                                <tr className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4 font-black text-neutral-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                        <span>Cancelled external sharing dialog</span>
                                    </td>
                                    <td className="p-4 text-center font-mono font-black text-neutral-600 bg-neutral-50">
                                        +0
                                    </td>
                                    <td className="p-4 text-neutral-600 hidden sm:table-cell">
                                        Aborted action does not emit payload to outside recipients.
                                    </td>
                                </tr>
                                <tr className="hover:bg-neutral-50 transition-colors">
                                    <td className="p-4 font-black text-neutral-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                        <span>Copy event direct link</span>
                                    </td>
                                    <td className="p-4 text-center font-mono font-black text-neutral-600 bg-neutral-50">
                                        +0
                                    </td>
                                    <td className="p-4 text-neutral-600 hidden sm:table-cell">
                                        Focuses public metric on verified distribution rather than clipboard access.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-3">
                        <h3 className="text-base font-black text-black flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            <span>Unique Internal Sharing Invariant</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            An internal invitation contributes to the public share count exactly once for any combination of:
                            <span className="font-bold text-black"> (Event ID, Sender User ID, Recipient User ID)</span>.
                            For example, when you share an event with the same connection multiple times across different days,
                            the public share count increases only on the first qualifying share.
                        </p>
                        <div className="p-3.5 rounded-xl bg-white border border-black text-xs font-bold text-neutral-800">
                            <strong>Important Architectural Rule:</strong> Invitation delivery and public share counting are completely
                            independent. A repeated invitation may still be successfully delivered via notification when permitted
                            by the sharing allowance, even though it produces zero additional increments to the public count.
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: INVITATION LIMITS AND COOLDOWN WORKBENCH                       */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#70D6FF] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Invitation Limits and Cooldown
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        To maintain a balanced sharing experience and prevent repetitive invitations, Orbix applies an
                        authoritative sharing allowance per recipient:
                    </p>

                    {/* Three Invitations Table */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="text-lg font-black text-black">Three Invitations Per Sharing Cycle</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                Users can successfully send up to three invitations to the same recipient for the same event
                                within a single sharing cycle:
                            </p>
                            <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]">
                                <table className="w-full text-left text-xs font-bold">
                                    <thead className="bg-[#FAF6EE] border-b-2 border-black">
                                        <tr>
                                            <th className="p-3 uppercase">Action</th>
                                            <th className="p-3 uppercase">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/10">
                                        <tr className="bg-white">
                                            <td className="p-3">First successful invitation</td>
                                            <td className="p-3 text-emerald-600">Allowed (+1 Public Count)</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="p-3">Second successful invitation</td>
                                            <td className="p-3 text-emerald-600">Allowed (+0 Public Count)</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="p-3">Third successful invitation</td>
                                            <td className="p-3 text-amber-600">Allowed (Triggers 1h Cooldown)</td>
                                        </tr>
                                        <tr className="bg-neutral-50">
                                            <td className="p-3 text-red-600">Fourth invitation attempt</td>
                                            <td className="p-3 text-red-600">Temporarily Restricted</td>
                                        </tr>
                                        <tr className="bg-emerald-50/50">
                                            <td className="p-3">After 1-hour cooldown expires</td>
                                            <td className="p-3 text-black">Three invitations available again</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Cooldown Explanation */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-black text-black">Understanding the Cooldown</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                Once the third successful invitation has been sent, a one-hour cooldown begins automatically:
                            </p>
                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2.5 text-xs text-neutral-800 font-medium leading-relaxed">
                                <p>
                                    &bull; <strong>Recorded Timestamp:</strong> The cooldown is strictly calculated from the exact recorded
                                    timestamp of the 3rd successful invitation.
                                </p>
                                <p>
                                    &bull; <strong>Refreshed Allowance:</strong> Once the 60 minutes elapse, the invitation allowance refreshes
                                    back to three.
                                </p>
                                <p>
                                    &bull; <strong>Independent Evaluation:</strong> The allowance is evaluated separately for each unique
                                    tuple: <code>(Sender, Recipient, Event)</code>. Inviting a different friend is never restricted.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#FFF5F7] border-2 border-black space-y-1 text-xs">
                                <span className="font-black text-black block">Does Cooldown Reset Share Count?</span>
                                <p className="text-neutral-700 font-medium">
                                    <strong>No.</strong> The allowance and the public count are decoupled. Even in a subsequent cycle,
                                    repeated invitations to the same connection will never increase the event's public share count again.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* LIVE INTERACTIVE COOLDOWN & INVITATION SIMULATOR */}
                    <div className="p-6 sm:p-8 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black space-y-6 shadow-[6px_6px_0px_#000]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                                    Live Interactive Lab
                                </span>
                                <h3 className="text-xl font-black text-black">
                                    Sharing Allowance &amp; Cooldown Simulator
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleResetCooldownSimulation}
                                    className="px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reset Lab</span>
                                </button>
                                {isCooldownActive && (
                                    <button
                                        type="button"
                                        onClick={handleFastForwardCooldown}
                                        className="px-3 py-1.5 rounded-xl bg-[#a2ff86] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#90f573] flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Fast-Forward 1h Cooldown</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Interactive Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                    Recipient Connection
                                </span>
                                <span className="text-sm font-black text-black block truncate">Priya Patel (@priya_dev)</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                    Cycle Progress
                                </span>
                                <span className="text-xl font-black text-black font-mono">
                                    {invitationCycleCount} / 3 <span className="text-xs text-neutral-500 font-sans">Used</span>
                                </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                    Cooldown Timer
                                </span>
                                <span
                                    className={`text-xl font-black font-mono ${
                                        isCooldownActive ? "text-red-600 animate-pulse" : "text-neutral-400"
                                    }`}
                                >
                                    {isCooldownActive ? formatSeconds(cooldownSecondsRemaining) : "Inactive"}
                                </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                    Event Public Shares
                                </span>
                                <span className="text-xl font-black text-emerald-600 font-mono">
                                    {simulationPublicShareCount}
                                </span>
                            </div>
                        </div>

                        {/* Action Trigger Button */}
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <button
                                type="button"
                                disabled={isCooldownActive}
                                onClick={handleTriggerInvitationAttempt}
                                className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl border-2 sm:border-[3px] border-black text-sm font-black shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                                    isCooldownActive
                                        ? "bg-red-100 text-red-600 border-red-500 opacity-80 cursor-not-allowed"
                                        : "bg-[#FFE566] text-black hover:bg-[#FFD700] active:translate-x-[2px] active:translate-y-[2px]"
                                }`}
                            >
                                <Send className="w-4 h-4" />
                                <span>
                                    {isCooldownActive
                                        ? `Cooldown Active (${formatSeconds(cooldownSecondsRemaining)}) — Cannot Send`
                                        : `Send Invitation to Priya Patel (${3 - invitationCycleCount} Left in Cycle)`}
                                </span>
                            </button>

                            {isCooldownActive && (
                                <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-400">
                                    Temporary Sharing Restriction Active: Cycle limit reached.
                                </span>
                            )}
                        </div>

                        {/* Live Audit Log */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black space-y-2">
                            <span className="text-xs font-mono font-bold text-neutral-600 uppercase block">
                                Real-Time Invitation Audit Trail:
                            </span>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-xs">
                                {invitationHistory.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-2 rounded-lg bg-[#FAF6EE] border border-black/10 flex items-center justify-between text-[11px]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-neutral-500">[{item.timestamp}]</span>
                                            <span className="font-bold text-black">{item.action}</span>
                                        </div>
                                        <span
                                            className={`font-black ${
                                                item.countDelta > 0
                                                    ? "text-emerald-600"
                                                    : item.status.includes("Cooldown")
                                                    ? "text-red-600"
                                                    : "text-neutral-600"
                                            }`}
                                        >
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: RELIABLE BLOG ENGAGEMENT                                       */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#FF70A6] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Reliable Blog Engagement
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        The Blog Like feature is architected from the ground up for high-throughput reliability, multi-tab
                        synchronization, and resilient data retrieval:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2.5">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span>Consistent Like Status</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                Your Like state is bound directly to the canonical publication identity (<code>hoster + blogName</code>),
                                preventing inconsistencies when the same publication is reached through different URLs or sub-paths.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2.5">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <Flame className="w-4 h-4 text-red-500" />
                                <span>Responsive Interaction</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                The Like button immediately reflects your interaction with spring physics rather than blocking
                                on network roundtrips. In the event of a network disruption, state rolls back gracefully.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2.5">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                <span>Updated Engagement Information</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                Like counts and your individual Like status are fetched with lightweight SWR-cached queries,
                                keeping displayed engagement information up-to-date across all open instances.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2.5">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                <span>Resilient Data Retrieval</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                Orbix retrieves authoritative engagement records directly from primary storage when caching or
                                performance-optimization services are temporarily undergoing maintenance.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: NOTIFICATIONS AND EVENT ACCESS                                 */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        06
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Notifications and Event Access
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        Internal event sharing is natively integrated with the Orbix in-app notification infrastructure:
                    </p>

                    <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                <Bell className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-black">
                                    Direct Opportunity Context via Notification Center
                                </h3>
                                <span className="text-xs font-mono font-bold text-neutral-500">
                                    Structured Invitation Delivery
                                </span>
                            </div>
                        </div>

                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            When an invitation is dispatched successfully:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl bg-white border border-black space-y-1">
                                <span className="text-xs font-black text-black block">Sender Attribution</span>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Clearly displays who sent the invitation and their verified college standing.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-black space-y-1">
                                <span className="text-xs font-black text-black block">Optional Personal Note</span>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Includes contextual team formation or invitation message (up to 140 chars).
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-black space-y-1">
                                <span className="text-xs font-black text-black block">1-Click Deep Link</span>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Opens the event registration page directly without manual navigation.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border-2 border-black text-xs font-bold text-neutral-800 flex items-center gap-2.5">
                            <Lock className="w-4 h-4 text-neutral-600 shrink-0" />
                            <span>
                                <strong>Privacy Guarantee:</strong> Internal sharing is strictly architected around event invitations.
                                It does not open direct-message channels or expose personal contact info.
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 7: A BETTER ENGAGEMENT EXPERIENCE                                 */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        07
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        A Better Engagement Experience
                    </h2>
                </div>

                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                    <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed">
                        Orbix approaches community engagement with an emphasis on consistency, dignity, and authentic interactions:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Authentic Engagement</span>
                            </span>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Repeated interactions cannot artificially inflate public engagement figures or leaderboard standings.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Reliable Interactions</span>
                            </span>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Like and Share operations produce consistent, predictable results across all devices and sessions.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Meaningful Discovery</span>
                            </span>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Students can introduce relevant opportunities to their verified peers and team members easily.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Controlled Sharing</span>
                            </span>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                3-invitation cycle allowances and 1-hour cooldowns preserve a respectful campus community environment.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Accessible Distribution</span>
                            </span>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Event links can travel seamlessly within Orbix or across supported native external applications.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-xs font-black text-black flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-black" />
                                <span>Zero-Bot Invariance</span>
                            </span>
                            <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                                Every internal invitation requires an active authenticated connection, blocking unauthorized outreach.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 8: GETTING STARTED                                                */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#70D6FF] border-2 border-black flex items-center justify-center font-mono font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000]">
                        08
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Getting Started
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    {/* To Like a Blog Post */}
                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#FF70A6] border-2 border-black flex items-center justify-center">
                                <Heart className="w-4 h-4 text-black fill-black" />
                            </div>
                            <h3 className="text-lg font-black text-black">To Like a Blog Post</h3>
                        </div>
                        <ol className="space-y-2 text-xs sm:text-sm text-neutral-800 font-bold list-decimal list-inside">
                            <li>Open the blog publication in the Orbix Blog Explorer.</li>
                            <li>Locate the Heart Like button in the card or article header.</li>
                            <li>Select it to register your Like with instant visual feedback.</li>
                            <li>Select it again at any time to remove your Like.</li>
                        </ol>
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black text-xs text-neutral-700 font-medium">
                            Your interaction and the displayed Like count will update immediately without reloading the page.
                        </div>
                    </div>

                    {/* To Share a College Event */}
                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center">
                                <Share2 className="w-4 h-4 text-black" />
                            </div>
                            <h3 className="text-lg font-black text-black">To Share a College Event</h3>
                        </div>
                        <ol className="space-y-2 text-xs sm:text-sm text-neutral-800 font-bold list-decimal list-inside">
                            <li>Navigate to the event you want to share.</li>
                            <li>Select the Share option in the event toolbar.</li>
                            <li>
                                Choose how you want to share it:
                                <ul className="pl-6 pt-1 space-y-1 font-medium text-xs list-disc">
                                    <li>Share within Orbix (invite accepted connections).</li>
                                    <li>Share externally (use native device sheet).</li>
                                    <li>Copy event link (direct URL to clipboard).</li>
                                </ul>
                            </li>
                            <li>Complete the selected action.</li>
                        </ol>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* CALL TO ACTION & BRAND FOOTER                                             */}
            {/* ========================================================================= */}
            <div className="rounded-3xl bg-black text-white p-8 sm:p-12 border-2 sm:border-[3px] border-black shadow-[8px_8px_0px_#000] space-y-6 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FF70A6] text-black text-xs font-black uppercase">
                    <Heart className="w-3.5 h-3.5 fill-black stroke-black" />
                    <span>Making Every Interaction Count</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-white max-w-2xl mx-auto">
                    Discover. Engage. Share. Grow with Orbix.
                </h3>
                <p className="text-neutral-300 text-xs sm:text-sm max-w-2xl mx-auto font-medium leading-relaxed">
                    At Orbix, meaningful engagement is about more than vanity metrics. Likes help students appreciate
                    ideas, technical publications, and student contributions. Event Sharing helps opportunities travel
                    across college communities and personal networks. Together, these features contribute to a more
                    connected, interactive, and opportunity-driven student ecosystem.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        to="/college-events"
                        className="px-6 py-3 rounded-xl bg-[#a2ff86] text-black font-black text-xs border-2 border-white shadow-[3px_3px_0px_#fff] hover:bg-[#90f573] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                        Explore College Events
                    </Link>
                    <Link
                        to="/blog"
                        className="px-6 py-3 rounded-xl bg-white text-black font-black text-xs border-2 border-white shadow-[3px_3px_0px_#fff] hover:bg-neutral-100 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                        Explore Engineering Blog
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default LikesEventSharingDocumentary;
