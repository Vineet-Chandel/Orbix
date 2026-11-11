// Frontend/src/app/Club/TeamWorkspace/Recognition/ReverseAwardModal.tsx
import React, { useState } from "react";
import { AlertTriangle, RotateCcw, X, AlertCircle } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { WorkspaceRecognitionLedgerEntry } from "../../../../types/workspace";

interface ReverseAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    award: WorkspaceRecognitionLedgerEntry | null;
    onReversalSuccess: (reversalResult: any) => void;
}

export const ReverseAwardModal: React.FC<ReverseAwardModalProps> = ({
    isOpen,
    onClose,
    clubId,
    award,
    onReversalSuccess,
}) => {
    const [reversalReason, setReversalReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!isOpen || !award) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (reversalReason.trim().length < 10) {
            setErrorMsg("Reversal reason must be at least 10 characters explaining the error.");
            return;
        }

        setSubmitting(true);
        try {
            const idempotencyKey = `rev_${award.id}_${Date.now()}`;
            const res = await workspaceApi.reverseAward(
                award.id,
                {
                    reversalReason: reversalReason.trim(),
                    idempotencyKey,
                },
                clubId
            );

            if (res.success) {
                onReversalSuccess(res);
                onClose();
            } else {
                setErrorMsg(res.message || "Failed to reverse award.");
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message || err.message || "An error occurred while reversing award.";
            setErrorMsg(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const recipientDisplayName =
        award.recipient?.name ||
        (award.recipient?.firstName
            ? `${award.recipient.firstName} ${award.recipient.lastName || ""}`.trim()
            : award.recipient?.username || "Recipient");

    const categoryDisplayName =
        award.category?.name || (award as any).categoryName || "Appreciation";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 bg-red-100 border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-black">Reverse Recognition Award</h2>
                            <p className="text-xs font-bold text-neutral-600">
                                Issue an audited compensating reversal entry
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {errorMsg && (
                        <div className="p-3 bg-red-50 border-2 border-black rounded-xl flex items-start gap-2 shadow-[2px_2px_0px_#000]">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-red-900">{errorMsg}</p>
                        </div>
                    )}

                    {/* Original Award Context */}
                    <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                            <span className="text-neutral-600">Recipient:</span>
                            <span className="text-black">{recipientDisplayName}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span className="text-neutral-600">Points to Deduct:</span>
                            <span className="text-red-700 font-black">-{award.pointsDelta} Orbits</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span className="text-neutral-600">Original Category:</span>
                            <span className="text-black">{categoryDisplayName}</span>
                        </div>
                        <div className="pt-1 text-[11px] text-neutral-600 italic truncate">
                            "{award.appreciationReason}"
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-[11px] font-medium text-amber-900 leading-relaxed">
                        Compensating reversals append a permanent negative delta record (`-{award.pointsDelta}` Orbits)
                        to the immutable ledger and refund the issuer's monthly budget if within the current month.
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Reversal Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reversalReason}
                            onChange={(e) => setReversalReason(e.target.value)}
                            rows={3}
                            placeholder="State clearly why this award is being reversed (min 10 characters)..."
                            className="w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-medium focus:outline-none shadow-[2px_2px_0px_#000] resize-none"
                            autoFocus
                        />
                    </div>

                    <div className="pt-2 border-t-2 border-black flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1.5"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{submitting ? "Reversing..." : "Confirm Reversal"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
