import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, AlertCircle, Building2, Globe, Loader2, ShieldCheck } from "lucide-react";
import { submitInstitutionVerificationRequest } from "../utils/profileApi";
import { useToast } from "../context/ToastContext";
import { NeoSelect } from "./NeoSelect";

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

interface RequestCollegeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery?: string;
    onSubmitted?: () => void;
}

export function RequestCollegeModal({
    isOpen,
    onClose,
    initialQuery = "",
    onSubmitted,
}: RequestCollegeModalProps) {
    const toast = useToast();
    const nameInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(initialQuery);
    const [website, setWebsite] = useState("");
    const [state, setState] = useState("");
    const [district, setDistrict] = useState("");
    const [reference, setReference] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialQuery);
            setWebsite("");
            setState("");
            setDistrict("");
            setReference("");
            setSuccessMessage(null);
            setErrorMessage(null);
            // Auto focus the name input on open
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen, initialQuery]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !submitting) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, submitting, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const cleanName = name.trim();
        if (cleanName.length < 3) {
            setErrorMessage("Please enter the official college or university name (minimum 3 characters).");
            nameInputRef.current?.focus();
            return;
        }

        // Clean & format website if entered
        let cleanWebsite = website.trim();
        if (cleanWebsite && !cleanWebsite.startsWith("http://") && !cleanWebsite.startsWith("https://")) {
            cleanWebsite = `https://${cleanWebsite}`;
        }

        setSubmitting(true);
        try {
            const combinedReference = [
                state ? `State: ${state}` : null,
                district ? `City/District: ${district}` : null,
                reference.trim() ? `Notes: ${reference.trim()}` : null,
            ]
                .filter(Boolean)
                .join(" | ");

            const res = await submitInstitutionVerificationRequest({
                institutionName: cleanName,
                institutionWebsite: cleanWebsite || undefined,
                supportingReference: combinedReference || undefined,
            });

            setSuccessMessage(res.message || "Your verification request has been queued for review.");
            toast.success("Verification request submitted successfully!", { title: "Request Queued" });
            if (onSubmitted) onSubmitted();
        } catch (err: any) {
            const msg = err.message || "Failed to submit verification request. Please try again.";
            setErrorMessage(msg);
            toast.error(msg, { title: "Submission Notice" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) {
                    onClose();
                }
            }}
        >
            <div className="relative w-full max-w-lg rounded-2xl bg-white border-2 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 overflow-hidden text-black animate-scaleUp">
                {/* Neo-Brutalist Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="absolute top-5 right-5 p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    aria-label="Close modal"
                >
                    <X className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Header */}
                <div className="flex items-start gap-3.5 mb-5 pr-8">
                    <div className="w-11 h-11 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center flex-shrink-0 text-black shadow-[2px_2px_0px_#000]">
                        <Building2 className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 id="request-modal-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Request College Verification
                        </h2>
                        <p className="text-xs text-neutral-600 font-bold mt-0.5">
                            Submit your institution for verification against official AISHE & UGC registries.
                        </p>
                    </div>
                </div>

                {successMessage ? (
                    <div className="space-y-4 py-2">
                        <div className="p-4 rounded-xl bg-[#a2ff86]/25 border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3 text-black">
                            <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0 mt-0.5 stroke-[2.5]" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Request Received & Queued
                                </h4>
                                <p className="text-xs font-medium leading-relaxed text-neutral-800">
                                    {successMessage}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-xs text-neutral-800 space-y-2">
                            <div className="flex items-center gap-2 font-black text-black uppercase tracking-wider text-[11px]">
                                <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                                <span>Verification Policy</span>
                            </div>
                            <p className="leading-relaxed font-medium">
                                To prevent unverified claims and maintain leaderboard authenticity, institutions must match a recognized AISHE code or UGC gazette entry before displaying the verified badge.
                            </p>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border-2 border-black bg-black text-[#a2ff86] hover:bg-neutral-900 text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
                        {errorMessage && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5 text-rose-950 text-xs font-bold leading-relaxed animate-in fade-in duration-150">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-800 mb-1.5">
                                College / University Official Name <span className="text-rose-600">*</span>
                            </label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                placeholder="e.g. Delhi Technological University"
                                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none transition-all ${
                                    errorMessage && name.trim().length < 3
                                        ? "bg-rose-50 border-rose-600 ring-2 ring-rose-200"
                                        : ""
                                }`}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-800 mb-1.5">
                                Official Website <span className="text-neutral-500 font-bold capitalize text-[10px]">(optional)</span>
                            </label>
                            <div className="relative">
                                <Globe className="w-4 h-4 text-neutral-600 absolute left-3.5 top-3 stroke-[2.5]" />
                                <input
                                    type="text"
                                    inputMode="url"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="https://www.dtu.ac.in"
                                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-800 mb-1.5">
                                    State / UT
                                </label>
                                <NeoSelect
                                    value={state}
                                    onChange={(val) => setState(val)}
                                    placeholder="Select State"
                                    size="sm"
                                    triggerClassName="bg-[#FAF6EE] border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:bg-white"
                                    options={[
                                        { value: "", label: "Select State" },
                                        ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-800 mb-1.5">
                                    City / District <span className="text-neutral-500 font-bold capitalize text-[10px]">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={district}
                                    onChange={(e) => setDistrict(e.target.value)}
                                    placeholder="e.g. New Delhi"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-800 mb-1.5">
                                Supporting Link / AISHE Code <span className="text-neutral-500 font-bold capitalize text-[10px]">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="AISHE code (e.g. C-12345), UGC listing link, or official document..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none transition-all resize-none"
                            />
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2.5 rounded-xl border-2 border-black bg-white text-black font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                onClick={(e) => {
                                    if (name.trim().length < 3) {
                                        e.preventDefault();
                                        setErrorMessage("Please enter the official college or university name (minimum 3 characters).");
                                        nameInputRef.current?.focus();
                                    }
                                }}
                                className="px-5 py-2.5 rounded-xl border-2 border-black bg-black text-[#a2ff86] hover:bg-neutral-900 font-black text-xs shadow-[3px_3px_0px_#000] cursor-pointer flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <span>Submit Request</span>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
export default RequestCollegeModal;
