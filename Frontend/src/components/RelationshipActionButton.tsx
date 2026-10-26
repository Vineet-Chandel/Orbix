// Frontend/src/components/RelationshipActionButton.tsx
import React, { useState } from "react";
import {
    UserPlus,
    UserCheck,
    Clock,
    Check,
    X,
    Loader2,
    ShieldAlert,
    UserMinus,
} from "lucide-react";
import { useRelationship } from "../hooks/useRelationship";
import { ConfirmationModal } from "./ConfirmationModal";
import type { RelationshipState } from "../api/relationshipApi";

interface RelationshipActionButtonProps {
    targetUserId: string | null | undefined;
    targetUsername?: string;
    targetDisplayName?: string;
    initialState?: RelationshipState;
    initialPayload?: any;
    size?: "sm" | "md";
    className?: string;
    onStateChange?: (state: RelationshipState) => void;
}

export const RelationshipActionButton: React.FC<RelationshipActionButtonProps> = ({
    targetUserId,
    targetUsername,
    targetDisplayName,
    initialState,
    initialPayload,
    size = "md",
    className = "",
    onStateChange,
}) => {
    const {
        state,
        loading,
        mutating,
        request,
        accept,
        decline,
        cancel,
        remove,
        unblock,
    } = useRelationship(targetUserId, initialState, initialPayload);

    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    const displayName = targetDisplayName || targetUsername || "User";

    const handleActionComplete = (newState: RelationshipState) => {
        if (onStateChange) onStateChange(newState);
    };

    const isSmall = size === "sm";
    const baseBtnClasses = isSmall
        ? "px-3 py-1.5 text-xs font-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center justify-center gap-1.5 select-none"
        : "px-4 py-2 text-xs font-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center justify-center gap-1.5 select-none";

    if (loading) {
        return (
            <div className={`${baseBtnClasses} bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed ${className}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
            </div>
        );
    }

    if (state === "unavailable") {
        return null;
    }

    // STATE: NONE -> Connect
    if (state === "none") {
        return (
            <button
                type="button"
                onClick={async () => {
                    const ok = await request();
                    if (ok) handleActionComplete("outgoing_pending");
                }}
                disabled={mutating}
                className={`${baseBtnClasses} bg-[#FFE566] hover:bg-[#ffe043] text-black ${className}`}
                title={`Send connection request to ${displayName}`}
            >
                {mutating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Connect</span>
            </button>
        );
    }

    // STATE: OUTGOING_PENDING -> Request Sent (Click to cancel)
    if (state === "outgoing_pending") {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    disabled={mutating}
                    className={`${baseBtnClasses} bg-amber-100 hover:bg-rose-100 text-amber-900 hover:text-rose-700 hover:border-rose-700 transition-colors ${className}`}
                    title="Connection request sent. Click to cancel."
                >
                    {mutating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>Request Sent</span>
                </button>

                <ConfirmationModal
                    isOpen={isCancelModalOpen}
                    title="Cancel Connection Request"
                    message={`Are you sure you want to withdraw your connection request to @${targetUsername || displayName}?`}
                    confirmLabel="Withdraw Request"
                    variant="danger"
                    onConfirm={async () => {
                        setIsCancelModalOpen(false);
                        const ok = await cancel();
                        if (ok) handleActionComplete("none");
                    }}
                    onCancel={() => setIsCancelModalOpen(false)}
                />
            </>
        );
    }

    // STATE: INCOMING_PENDING -> Accept & Decline Buttons
    if (state === "incoming_pending") {
        return (
            <div className={`inline-flex items-center gap-1.5 ${className}`}>
                <button
                    type="button"
                    onClick={async () => {
                        const ok = await accept();
                        if (ok) handleActionComplete("connected");
                    }}
                    disabled={mutating}
                    className={`${baseBtnClasses} bg-[#a2ff86] hover:bg-[#8ee875] text-black`}
                    title={`Accept connection request from ${displayName}`}
                >
                    {mutating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                    <span>Accept</span>
                </button>

                <button
                    type="button"
                    onClick={async () => {
                        const ok = await decline();
                        if (ok) handleActionComplete("none");
                    }}
                    disabled={mutating}
                    className={`${baseBtnClasses} bg-white hover:bg-rose-50 text-neutral-700 hover:text-rose-600`}
                    title={`Decline connection request from ${displayName}`}
                >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Decline</span>
                </button>
            </div>
        );
    }

    // STATE: CONNECTED -> Connected (Click to remove)
    if (state === "connected") {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsRemoveModalOpen(true)}
                    disabled={mutating}
                    className={`${baseBtnClasses} bg-[#a2ff86] hover:bg-rose-100 text-black hover:text-rose-700 group ${className}`}
                    title="Connected. Click to remove connection."
                >
                    {mutating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <>
                            <UserCheck className="w-3.5 h-3.5 stroke-[2.5] group-hover:hidden" />
                            <UserMinus className="w-3.5 h-3.5 stroke-[2.5] hidden group-hover:inline-block" />
                        </>
                    )}
                    <span className="group-hover:hidden">Connected</span>
                    <span className="hidden group-hover:inline">Remove</span>
                </button>

                <ConfirmationModal
                    isOpen={isRemoveModalOpen}
                    title="Remove Connection"
                    message={`Are you sure you want to remove your connection with ${displayName}? You will no longer see updates from each other in your direct network.`}
                    confirmLabel="Remove Connection"
                    variant="danger"
                    onConfirm={async () => {
                        setIsRemoveModalOpen(false);
                        const ok = await remove();
                        if (ok) handleActionComplete("none");
                    }}
                    onCancel={() => setIsRemoveModalOpen(false)}
                />
            </>
        );
    }

    // STATE: BLOCKED_BY_ME -> Unblock
    if (state === "blocked_by_me") {
        return (
            <button
                type="button"
                onClick={async () => {
                    const ok = await unblock();
                    if (ok) handleActionComplete("none");
                }}
                disabled={mutating}
                className={`${baseBtnClasses} bg-neutral-200 hover:bg-neutral-300 text-black ${className}`}
                title="You blocked this user. Click to unblock."
            >
                {mutating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Unblock</span>
            </button>
        );
    }

    // STATE: BLOCKED_BY_THEM -> Unavailable
    if (state === "blocked_by_them") {
        return (
            <button
                type="button"
                disabled
                className={`${baseBtnClasses} bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed ${className}`}
            >
                <span>Unavailable</span>
            </button>
        );
    }

    // STATE: COOLDOWN_ACTIVE
    if (state === "cooldown_active") {
        return (
            <button
                type="button"
                disabled
                className={`${baseBtnClasses} bg-neutral-100 text-neutral-500 border-neutral-300 cursor-not-allowed ${className}`}
                title="Connection request declined recently. Cooldown active."
            >
                <Clock className="w-3.5 h-3.5 stroke-[2]" />
                <span>Cooldown Active</span>
            </button>
        );
    }

    return null;
};
