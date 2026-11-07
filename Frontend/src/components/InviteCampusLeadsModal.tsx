import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
    X,
    Copy,
    Check,
    Mail,
    MessageCircle,
    Send,
    GraduationCap,
    ArrowUpRight,
    Users,
    CheckCircle2,
    Sparkles,
} from "lucide-react";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { useToast } from "../context/ToastContext";

export interface InviteCampusLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    collegeName: string;
    collegeId?: string | null;
    initialTab?: "wakeUpCall" | "official" | "panIndiaChallenge";
}

export function getInviteUrl(collegeName?: string, collegeId?: string | null): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    params.set("tab", "club");
    params.set("ref", "campus-invite");
    if (collegeName && collegeName !== "Your College Campus") {
        params.set("college", collegeName);
    }
    if (collegeId) {
        params.set("collegeId", collegeId);
    }
    return `${origin}/auth/signup?${params.toString()}`;
}

export function getInviteMessageTemplates(collegeName: string, inviteUrl: string) {
    const displayCollege = collegeName || "Our College Campus";
    return {
        wakeUpCall: `🔥 URGENT FOR CLUB LEADS AT ${displayCollege}!

Colleges across India (IITs, NITs, and top tech chapters) are publishing live hackathons, workshops, and inter-college competitions on Orbix every week.

Our campus has 0 active sessions right now. Don't let ${displayCollege} fall behind on the national student leaderboard!

If you lead a technical society, coding club, or student organization:
👉 Register our official campus club in 2 minutes & publish our events:
${inviteUrl}`,

        official: `Respected Faculty Coordinators & Student Club Presidents at ${displayCollege},

Students of ${displayCollege} are actively seeking verified technical workshops, guest lectures, and hackathons on the Orbix platform.

Orbix provides our campus chapter with:
✅ AISHE-verified institutional listing & automated student attendance verification
✅ Dynamic registration forms with fraud-proof QR check-in passes
✅ Pan-India event reach & national student rankings

Please activate our campus chapter portal here:
${inviteUrl}`,

        panIndiaChallenge: `🇮🇳 Put ${displayCollege} on India's National Tech Map!

We challenge our campus clubs to launch a Pan-India flagship hackathon or workshop on Orbix and compete with universities nationwide.

Bring thousands of student developers to our campus event.
Host your Pan-India or Campus-exclusive event now:
${inviteUrl}`,
    };
}

export const InviteCampusLeadsModal: React.FC<InviteCampusLeadsModalProps> = ({
    isOpen,
    onClose,
    collegeName,
    collegeId,
    initialTab = "wakeUpCall",
}) => {
    const toast = useToast();
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedMessage, setCopiedMessage] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState<"wakeUpCall" | "official" | "panIndiaChallenge">(initialTab);

    const { handleBackdropClick } = useModalDismiss({ isOpen, onClose });

    // Lock body scroll while modal is active
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setActiveTemplate(initialTab);
        }
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    const displayCollege = collegeName || "Your College Campus";
    const inviteUrl = getInviteUrl(collegeName, collegeId);
    const directRegisterHref = `/auth/signup?tab=club&ref=campus-invite${collegeName ? `&college=${encodeURIComponent(collegeName)}` : ""}`;

    const templates = getInviteMessageTemplates(displayCollege, inviteUrl);
    const formattedMessage = templates[activeTemplate];

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopiedLink(true);
            toast.success("Direct club registration link copied!", {
                title: "Link Copied",
            });
            setTimeout(() => setCopiedLink(false), 2200);
        } catch {
            toast.error("Failed to copy link. Please select and copy manually.");
        }
    };

    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(formattedMessage);
            setCopiedMessage(true);
            toast.success("Pre-written invitation message copied! Ready to paste into college WhatsApp or Discord groups.", {
                title: "Message Copied",
            });
            setTimeout(() => setCopiedMessage(false), 2200);
        } catch {
            toast.error("Failed to copy message. Please select and copy manually.");
        }
    };

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMessage)}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        activeTemplate === "panIndiaChallenge"
            ? `Calling all student clubs at ${displayCollege}! Put our campus on India's national tech leaderboard on @OrbixHQ: ${inviteUrl}`
            : `Calling all club presidents and tech chapter leads at ${displayCollege}! Register our campus on @OrbixHQ and host events: ${inviteUrl}`
    )}`;
    const emailSubject = `Invitation: Register your student club chapter on Orbix (${displayCollege})`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(formattedMessage)}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Register your student club/chapter from ${displayCollege} on Orbix!`)}`;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-leads-title"
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-xl bg-[#FAF6EE] border-3 border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b-2 border-black bg-white flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFE566] border border-black text-[11px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Campus Outreach</span>
                        </div>
                        <h2 id="invite-leads-title" className="text-xl sm:text-2xl font-black text-black tracking-tight truncate">
                            Invite Campus Club Leads
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] flex-shrink-0"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 scrollbar-none">
                    {/* Target Campus Card */}
                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-6 h-6 text-black stroke-[2.2]" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Campus Organization Hub
                            </span>
                            <p className="text-xs sm:text-sm font-black text-black truncate">
                                {displayCollege}
                            </p>
                        </div>
                    </div>

                    {/* Quick 1-Click Sharing Channels */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                            Quick 1-Click Broadcast Channels
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* WhatsApp */}
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl bg-[#25D366] text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 hover:brightness-105 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                                <span>WhatsApp</span>
                            </a>

                            {/* Twitter / X */}
                            <a
                                href={twitterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl bg-black text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 hover:bg-neutral-900 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <span className="text-sm font-black leading-none">𝕏</span>
                                <span>Post on X</span>
                            </a>

                            {/* Telegram */}
                            <a
                                href={telegramUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl bg-[#229ED9] text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 hover:brightness-105 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <Send className="w-4 h-4 stroke-[2.5]" />
                                <span>Telegram</span>
                            </a>

                            {/* Email */}
                            <a
                                href={emailUrl}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <Mail className="w-4 h-4 stroke-[2.5]" />
                                <span>Email Leads</span>
                            </a>
                        </div>
                    </div>

                    {/* Direct Registration Link Section */}
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                            Direct Club Registration Link
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={inviteUrl}
                                onFocus={(e) => e.target.select()}
                                className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-black font-mono text-xs text-neutral-800 select-all focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                            >
                                {copiedLink ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Copy Link</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] text-neutral-600 font-medium">
                            Opens the club registration portal directly with {displayCollege} pre-configured.
                        </p>
                    </div>

                    {/* Ready-to-Send Invitation Message Card with Audience Tabs */}
                    <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                Target Message Angle
                            </label>
                            <span className="text-[10px] font-black text-neutral-500 uppercase">
                                Ready to Send in Groups
                            </span>
                        </div>

                        {/* Message Template Switcher Tabs */}
                        <div className="flex items-center gap-1.5 bg-[#FAF6EE] p-1 rounded-xl border-2 border-black">
                            <button
                                type="button"
                                onClick={() => setActiveTemplate("wakeUpCall")}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${
                                    activeTemplate === "wakeUpCall"
                                        ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                        : "text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                🔥 Wake-Up Call (FOMO)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTemplate("official")}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${
                                    activeTemplate === "official"
                                        ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                        : "text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                🏛️ Faculty & Leads
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTemplate("panIndiaChallenge")}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${
                                    activeTemplate === "panIndiaChallenge"
                                        ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                        : "text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                🇮🇳 Pan-India Challenge
                            </button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <pre className="text-xs text-neutral-800 font-sans whitespace-pre-wrap leading-relaxed select-all">
                                {formattedMessage}
                            </pre>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyMessage}
                                    className="flex-1 py-2 px-3 rounded-lg bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    {copiedMessage ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                            <span>Invitation Message Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 stroke-[2.5]" />
                                            <span>Copy Formatted Message</span>
                                        </>
                                    )}
                                </button>
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-2 px-3 rounded-lg bg-[#25D366] hover:brightness-105 text-white border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Send directly on WhatsApp"
                                >
                                    <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                                    <span>Send on WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action: Are you a club lead yourself? */}
                <div className="p-4 sm:p-5 border-t-2 border-black bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-neutral-600" />
                        <span className="text-xs font-bold text-neutral-700">
                            Are you leading a club yourself?
                        </span>
                    </div>

                    <Link
                        to={directRegisterHref}
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <span>Register My Club</span>
                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </Link>
                </div>
            </div>
        </div>,
        document.body
    );
};
