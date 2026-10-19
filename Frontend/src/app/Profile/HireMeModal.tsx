import React, { useState, useEffect } from "react";
import { Mail, X, Check, Loader2 } from "lucide-react";
import { sendHireMessage } from "../../utils/profileApi";
import { useToast } from "../../context/ToastContext";

interface HireMeModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    firstName?: string;
    displayName?: string;
}

export function HireMeModal({
    isOpen,
    onClose,
    username,
    firstName,
    displayName,
}: HireMeModalProps) {
    const toast = useToast();
    const [senderName, setSenderName] = useState("");
    const [company, setCompany] = useState("");
    const [senderEmail, setSenderEmail] = useState("");
    const [communicationEmail, setCommunicationEmail] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const targetName = (firstName || displayName || username || "Developer").trim();
    const upperName = targetName.toUpperCase();

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSenderName("");
            setCompany("");
            setSenderEmail("");
            setCommunicationEmail("");
            setMessage("");
            setSending(false);
            setSentSuccess(false);
            setErrorMsg(null);
        }
    }, [isOpen]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        // Strict verification: all entries are necessary
        if (!senderName.trim() || senderName.trim().length < 2) {
            setErrorMsg("Please enter your full name (minimum 2 characters).");
            return;
        }
        if (!company.trim() || company.trim().length < 2) {
            setErrorMsg("Please enter your company or organization name.");
            return;
        }
        if (!senderEmail.trim() || !emailRegex.test(senderEmail.trim())) {
            setErrorMsg("Please enter a valid work email.");
            return;
        }
        if (!communicationEmail.trim() || !emailRegex.test(communicationEmail.trim())) {
            setErrorMsg("Please enter a valid communication email where replies should be sent.");
            return;
        }
        if (!message.trim() || message.trim().length < 10) {
            setErrorMsg("Please write a detailed message (minimum 10 characters).");
            return;
        }

        setSending(true);

        try {
            const res = await sendHireMessage({
                username,
                senderName: senderName.trim(),
                company: company.trim(),
                senderEmail: senderEmail.trim(),
                communicationEmail: communicationEmail.trim(),
                message: message.trim(),
            });

            setSentSuccess(true);
            toast.success(res.message || `Message sent to ${targetName}!`, {
                title: "Message Delivered",
            });

            setTimeout(() => {
                onClose();
            }, 1800);
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to deliver message. Please try again.");
            toast.error(err.message || "Could not send message", {
                title: "Delivery Error",
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn"
            onClick={(e) => {
                if (e.target === e.currentTarget && !sending) onClose();
            }}
        >
            <div
                className="relative w-full max-w-lg rounded-2xl bg-[#111622] border border-neutral-800 shadow-2xl p-6 sm:p-7 text-neutral-100 select-none overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight leading-snug">
                            Message {upperName}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                            Your message goes to {upperName} by email. Your email is shared only with them so they can reply.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800/80 cursor-pointer disabled:opacity-50"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {sentSuccess ? (
                    <div className="py-8 text-center flex flex-col items-center justify-center space-y-3 animate-fadeIn">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                            <Check className="w-6 h-6 stroke-[3]" />
                        </div>
                        <h4 className="text-sm font-bold text-white">Message Delivered</h4>
                        <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                            Your message and communication contact have been forwarded to {targetName}.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                                {errorMsg}
                            </div>
                        )}

                        {/* Row 1: Your Name & Company Name (All Mandatory) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                                    Your name <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Sarah Jenkins"
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    disabled={sending}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-neutral-800 text-xs font-medium text-white placeholder-neutral-500 focus:bg-neutral-900 focus:border-blue-500 focus:outline-hidden transition-all disabled:opacity-50"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                                    Company <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Acme Corp"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    disabled={sending}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-neutral-800 text-xs font-medium text-white placeholder-neutral-500 focus:bg-neutral-900 focus:border-blue-500 focus:outline-hidden transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Row 2: Your Work Email & Communication Email (All Mandatory) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                                    Your work email <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={senderEmail}
                                    onChange={(e) => setSenderEmail(e.target.value)}
                                    disabled={sending}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-neutral-800 text-xs font-medium text-white placeholder-neutral-500 focus:bg-neutral-900 focus:border-blue-500 focus:outline-hidden transition-all disabled:opacity-50"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                                    Communication email <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="Direct reply address"
                                    value={communicationEmail}
                                    onChange={(e) => setCommunicationEmail(e.target.value)}
                                    disabled={sending}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-neutral-800 text-xs font-medium text-white placeholder-neutral-500 focus:bg-neutral-900 focus:border-blue-500 focus:outline-hidden transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Message Textarea (Mandatory) */}
                        <div>
                            <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                                Message <span className="text-rose-400">*</span>
                            </label>
                            <textarea
                                rows={5}
                                placeholder={`Hi ${upperName}, we're hiring for...`}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={sending}
                                required
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-neutral-800 text-xs font-medium text-white placeholder-neutral-500 focus:bg-neutral-900 focus:border-blue-500 focus:outline-hidden transition-all resize-none min-h-[125px] disabled:opacity-50"
                            />
                        </div>

                        {/* Send Message Button */}
                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={sending}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-600 active:scale-98 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Sending message...</span>
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-3.5 h-3.5" />
                                        <span>Send message</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

