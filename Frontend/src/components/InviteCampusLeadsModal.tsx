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

interface InviteCampusLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    collegeName: string;
    collegeId?: string | null;
}

export const InviteCampusLeadsModal: React.FC<InviteCampusLeadsModalProps> = ({
    isOpen,
    onClose,
    collegeName,
    collegeId,
}) => {
    const toast = useToast();
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedMessage, setCopiedMessage] = useState(false);

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

    if (!isOpen) return null;

    const displayCollege = collegeName || "Your College Campus";
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
    const inviteUrl = `${origin}/auth/signup?${params.toString()}`;
    const directRegisterHref = `/auth/signup?${params.toString()}`;

    const formattedMessage =
`👋 Hey Club Presidents & Tech Chapter Leads at ${displayCollege}!

We're inviting all student societies, developer chapters, and clubs from ${displayCollege} to register our official campus presence on Orbix.

✨ Why join Orbix?
• Verified campus chapter listing & badge
• Centralized member auditions & recruitment
• Multi-platform contest radar & hackathon promotions
• Showcase team achievements to students across colleges

👉 Register your club chapter in 2 minutes:
${inviteUrl}`;

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
                            Quick 1-Click Sharing
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* WhatsApp */}
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2.5 rounded-xl bg-[#25D366] text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 hover:brightness-105 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                                <span>WhatsApp</span>
                            </a>

                            {/* Email */}
                            <a
                                href={emailUrl}
                                className="px-3 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <Mail className="w-4 h-4 stroke-[2.5]" />
                                <span>Email Leads</span>
                            </a>

                            {/* Telegram */}
                            <a
                                href={telegramUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2.5 rounded-xl bg-[#229ED9] text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 hover:brightness-105 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <Send className="w-4 h-4 stroke-[2.5]" />
                                <span>Telegram</span>
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

                    {/* Ready-to-Send Invitation Message Card */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                Pre-Formatted Message (For WhatsApp/Discord Groups)
                            </label>
                            <span className="text-[10px] font-black text-neutral-500 uppercase">
                                Ready to Send
                            </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <pre className="text-xs text-neutral-800 font-sans whitespace-pre-wrap leading-relaxed select-all">
                                {formattedMessage}
                            </pre>
                            <button
                                type="button"
                                onClick={handleCopyMessage}
                                className="w-full py-2 px-3 rounded-lg bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                {copiedMessage ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                        <span>Invitation Message Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 stroke-[2.5]" />
                                        <span>Copy Full Message</span>
                                    </>
                                )}
                            </button>
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
