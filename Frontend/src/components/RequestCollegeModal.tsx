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
        >
            <div className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200/90 shadow-2xl p-6 sm:p-7 overflow-hidden text-neutral-900">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 id="request-modal-title" className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
                            Request College Verification
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Submit your institution for verification against official AISHE & UGC registries.
                        </p>
                    </div>
                </div>

                {successMessage ? (
                    <div className="space-y-4 py-2">
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/90 flex items-start gap-3 text-emerald-900">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold text-emerald-800">Request Received</h4>
                                <p className="text-xs leading-relaxed text-emerald-700">
                                    {successMessage}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-neutral-800">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Verification Policy</span>
                            </div>
                            <p className="leading-relaxed">
                                To prevent unverified claims and maintain database integrity, institutions must match a recognized AISHE code or UGC gazette entry before displaying the verified badge.
                            </p>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
                        {errorMessage && (
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 text-xs leading-relaxed animate-in fade-in duration-150">
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                College / University Official Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                placeholder="e.g. National Institute of Technology Calicut"
                                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-900 focus:outline-hidden transition-all ${
                                    errorMessage && name.trim().length < 3
                                        ? "bg-rose-50/50 border border-rose-300 focus:border-rose-500 ring-2 ring-rose-100"
                                        : "bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-neutral-900"
                                }`}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                Official Website <span className="text-neutral-400 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <Globe className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-3" />
                                <input
                                    type="text"
                                    inputMode="url"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="https://www.nitc.ac.in"
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-neutral-700 mb-1">
                                    State / UT
                                </label>
                                <NeoSelect
                                    value={state}
                                    onChange={(val) => setState(val)}
                                    placeholder="Select State"
                                    size="sm"
                                    options={[
                                        { value: "", label: "Select State" },
                                        ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-700 mb-1">
                                    City / District <span className="text-neutral-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={district}
                                    onChange={(e) => setDistrict(e.target.value)}
                                    placeholder="e.g. Kozhikode"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-neutral-700 mb-1">
                                Supporting Link / AISHE Code <span className="text-neutral-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="AISHE code (e.g. C-12345), UGC listing link, or official document..."
                                className="w-full px-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all resize-none"
                            />
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2.5 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 text-xs font-bold transition-colors cursor-pointer"
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
                                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                                    submitting
                                        ? "bg-neutral-400 cursor-wait"
                                        : name.trim().length >= 3
                                        ? "bg-neutral-900 hover:bg-black hover:scale-[1.02] shadow-sm active:scale-[0.98]"
                                        : "bg-neutral-800 hover:bg-neutral-900"
                                }`}
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
