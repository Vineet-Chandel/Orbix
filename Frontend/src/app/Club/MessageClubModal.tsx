import { useState } from "react";
import { X, Send, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import { Link } from "react-router-dom";
import { NeoSelect } from "../../components/NeoSelect";

interface MessageClubModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    clubName: string;
    clubLogoUrl?: string | null;
}

const INQUIRY_CATEGORIES = [
    "General Inquiry",
    "Event Inquiry",
    "Collaboration",
    "Membership & Recruitment",
    "Sponsorship",
    "Other",
];

export default function MessageClubModal({
    isOpen,
    onClose,
    clubId,
    clubName,
    clubLogoUrl,
}: MessageClubModalProps) {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [subject, setSubject] = useState(INQUIRY_CATEGORIES[0]);
    const [body, setBody] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sentSuccess, setSentSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const cleanBody = body.trim();
        if (cleanBody.length < 5) {
            setErrorMessage("Please enter at least 5 characters for your message.");
            return;
        }
        if (cleanBody.length > 5000) {
            setErrorMessage("Message cannot exceed 5,000 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/club/${clubId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    subject,
                    body: cleanBody,
                }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                if (res.status === 403) {
                    setErrorMessage(data?.message || "Access Restricted: You don't have permission to message this club.");
                    return;
                }
                if (res.status === 429) {
                    setErrorMessage(data?.message || "Rate limit reached. Please try again later.");
                    return;
                }
                throw new Error(data?.message || "Failed to send message to club.");
            }

            setSentSuccess(true);
            toast.success("Message sent to club leadership.");
        } catch (err: any) {
            console.error("Message club error:", err);
            setErrorMessage(err.message || "Failed to send message. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setBody("");
        setErrorMessage(null);
        setSentSuccess(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
            <div className="w-full max-w-lg bg-[#FAF6EE] border-2 border-black rounded-3xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-5 bg-white border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-200 border-2 border-black overflow-hidden flex items-center justify-center font-black text-sm shrink-0 shadow-[2px_2px_0px_#000]">
                            {clubLogoUrl ? (
                                <img src={clubLogoUrl} alt={clubName} className="w-full h-full object-cover" />
                            ) : (
                                clubName.slice(0, 2).toUpperCase()
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-black">Contact {clubName}</span>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Direct Club Inquiry
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1.5 rounded-xl border-2 border-black hover:bg-neutral-100 cursor-pointer"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {!user ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-black mx-auto flex items-center justify-center text-amber-700 shadow-[2px_2px_0px_#000]">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-black text-base text-black">Sign in required</h3>
                                <p className="text-xs font-medium text-neutral-600 max-w-xs mx-auto">
                                    You must be logged into an Orbix account to message verified collegiate clubs.
                                </p>
                            </div>
                            <Link
                                to="/auth/signin"
                                className="inline-block px-5 py-2.5 rounded-xl bg-black text-white font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800"
                            >
                                Sign In to Continue
                            </Link>
                        </div>
                    ) : sentSuccess ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-14 h-14 rounded-3xl bg-emerald-100 border-2 border-black mx-auto flex items-center justify-center text-emerald-600 shadow-[4px_4px_0px_#000]">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-black text-lg text-black">Message Dispatched!</h3>
                                <p className="text-xs font-medium text-neutral-600 max-w-xs mx-auto">
                                    Your message has been delivered to the leadership team of <span className="font-bold text-black">{clubName}</span>.
                                    Replies will arrive in your Orbix notifications.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-5 py-2.5 rounded-xl bg-black text-white font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSend} className="space-y-4">
                            {errorMessage && (
                                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-900 text-xs font-bold flex items-start gap-2 shadow-[2px_2px_0px_#000]">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                    Inquiry Category
                                </label>
                                <NeoSelect
                                    value={subject}
                                    onChange={(val) => setSubject(val)}
                                    options={INQUIRY_CATEGORIES.map((cat) => ({
                                        value: cat,
                                        label: cat,
                                    }))}
                                    className="w-full"
                                    triggerClassName="bg-white text-xs font-bold"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                        Message Body
                                    </label>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        {body.length} / 5,000
                                    </span>
                                </div>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder={`Write your inquiry for ${clubName}... (e.g. details about workshops, sponsorship, or campus collaboration)`}
                                    rows={5}
                                    maxLength={5000}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-medium text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black shadow-[2px_2px_0px_#000] resize-none"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-neutral-100 border border-black/20 text-[10px] font-bold text-neutral-600 flex items-center justify-between">
                                <span>Subject to weekly and monthly fair-use messaging limits.</span>
                                <span className="font-black text-emerald-700">Direct Delivery</span>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || body.trim().length < 5}
                                    className="px-5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Send Message</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
