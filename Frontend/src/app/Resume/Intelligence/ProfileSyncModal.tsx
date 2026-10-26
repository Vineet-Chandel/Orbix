import React, { useState } from "react";
import {
    X,
    Check,
    Sparkles,
    ShieldCheck,
    AlertCircle,
    ArrowRight,
    Loader2
} from "lucide-react";
import {
    applyProfileSyncApi,
    type ProfileSyncProposal,
    type ProposedSyncField
} from "../../../utils/resumeIntelligenceApi";
import { useAppDispatch, updateUserProfile } from "../../../store";

interface ProfileSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposal: ProfileSyncProposal | null;
    onSyncSuccess?: (updatedFields: string[]) => void;
}

export const ProfileSyncModal: React.FC<ProfileSyncModalProps> = ({
    isOpen,
    onClose,
    proposal,
    onSyncSuccess
}) => {
    const dispatch = useAppDispatch();
    const [selectedFields, setSelectedFields] = useState<string[]>(() => {
        return proposal?.proposedFields?.map(f => f.fieldKey) || [];
    });
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    if (!isOpen || !proposal || proposal.proposedFields.length === 0) {
        return null;
    }

    const toggleField = (key: string) => {
        setSelectedFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const selectAll = () => {
        setSelectedFields(proposal.proposedFields.map(f => f.fieldKey));
    };

    const deselectAll = () => {
        setSelectedFields([]);
    };

    const handleApply = async () => {
        if (selectedFields.length === 0) {
            setError("Please select at least one field to sync.");
            return;
        }

        try {
            setIsApplying(true);
            setError(null);
            const res = await applyProfileSyncApi(selectedFields);
            setSuccessMessage(res.message);

            if (res.user) {
                dispatch(updateUserProfile(res.user));
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("orbix_profile_updated", { detail: res.user }));
            }

            if (onSyncSuccess) {
                onSyncSuccess(res.updatedFields);
            }
            setTimeout(() => {
                onClose();
            }, 1800);
        } catch (err: any) {
            setError(err?.message || "Failed to apply profile sync");
        } finally {
            setIsApplying(false);
        }
    };

    const renderFieldValue = (field: ProposedSyncField) => {
        if (Array.isArray(field.proposedValue)) {
            return (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {field.proposedValue.slice(0, 8).map((val, idx) => (
                        <span
                            key={idx}
                            className="px-2 py-0.5 text-xs font-bold rounded-md bg-[#FFE566] text-black border border-black"
                        >
                            {val}
                        </span>
                    ))}
                    {field.proposedValue.length > 8 && (
                        <span className="text-xs text-neutral-500 font-bold self-center">
                            +{field.proposedValue.length - 8} more
                        </span>
                    )}
                </div>
            );
        }
        return (
            <p className="text-xs sm:text-sm font-bold text-black mt-1 break-words">
                {String(field.proposedValue)}
            </p>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6 bg-[#FFE566] border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-black">
                                Sync Resume to Orbix Profile
                            </h2>
                            <p className="text-xs text-neutral-800 font-medium">
                                Only empty profile fields are eligible. Review and approve changes below.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 transition shadow-[2px_2px_0px_#000]"
                    >
                        <X className="w-5 h-5 text-black" />
                    </button>
                </div>

                {/* Sub-header Toolbar */}
                <div className="px-6 py-3 bg-neutral-50 border-b border-black/10 flex items-center justify-between text-xs font-bold text-neutral-600">
                    <div>
                        {selectedFields.length} of {proposal.proposedFields.length} fields selected
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={selectAll}
                            className="text-black underline hover:text-neutral-700"
                        >
                            Select All
                        </button>
                        <span>•</span>
                        <button
                            type="button"
                            onClick={deselectAll}
                            className="text-neutral-500 underline hover:text-black"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-600 flex items-start gap-2.5 text-xs text-rose-800 font-medium">
                            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-600 flex items-start gap-2.5 text-xs text-emerald-800 font-medium">
                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        {proposal.proposedFields.map(field => {
                            const isSelected = selectedFields.includes(field.fieldKey);
                            return (
                                <div
                                    key={field.fieldKey}
                                    onClick={() => toggleField(field.fieldKey)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition select-none ${
                                        isSelected
                                            ? "border-black bg-amber-50/60 shadow-[3px_3px_0px_#000]"
                                            : "border-neutral-300 bg-white hover:border-black opacity-80"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`w-5 h-5 rounded border-2 border-black flex items-center justify-center mt-0.5 ${
                                                isSelected ? "bg-[#FFE566]" : "bg-white"
                                            }`}
                                        >
                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-black">
                                                    {field.label}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-900 border border-emerald-400">
                                                        Missing in Profile
                                                    </span>
                                                    <span className="text-[10px] font-mono text-neutral-500">
                                                        {field.confidence}% confidence
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-2 p-2.5 rounded-lg bg-white border border-black/10">
                                                <div className="text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                                                    <span>Extracted from Resume</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </div>
                                                {renderFieldValue(field)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-neutral-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Existing profile values will never be overwritten.</span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-bold text-xs text-black transition shadow-[2px_2px_0px_#000]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isApplying || selectedFields.length === 0}
                            onClick={handleApply}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] disabled:opacity-50 font-black text-xs text-black transition shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2"
                        >
                            {isApplying ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                                    <span>Syncing...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                    <span>Sync {selectedFields.length} Field{selectedFields.length !== 1 ? "s" : ""}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
