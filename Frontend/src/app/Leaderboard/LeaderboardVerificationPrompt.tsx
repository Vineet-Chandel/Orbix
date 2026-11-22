import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppDispatch, fetchUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { OwnershipVerificationModal } from "../../components/verification/OwnershipVerificationModal";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { getPortalIcon } from "../../utils/portalIcons";
import { PORTALS } from "../../utils/portalParser";
import { isPlatformVerificationSupported } from "../../utils/platformVerificationSupport";

import { getVerificationConnections, type VerificationConnection as Connection } from "./verificationConnections";

export function LeaderboardVerificationPrompt({ onVerified }: { onVerified: () => Promise<void> }) {
    const dispatch = useAppDispatch();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [active, setActive] = useState<Connection | null>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const onVerifiedRef = useRef(onVerified);
    onVerifiedRef.current = onVerified;
    const initialReturn = useRef(params.get("portal") === "github" ? {
        status: params.get("status"), action: params.get("action"), error: params.get("error"),
    } : null);

    const loadConnections = async () => {
        const profile = await dispatch(fetchUserProfile({ force: true })).unwrap();
        const next = getVerificationConnections(profile.platforms);
        setConnections(next);
        setLoaded(true);
        setError(false);
        return next;
    };

    useEffect(() => {
        let cancelled = false;
        const result = initialReturn.current;
        if (result?.status) {
            const clean = new URLSearchParams(params);
            for (const key of ["status", "portal", "action", "username", "error"]) clean.delete(key);
            setParams(clean, { replace: true });
        }
        void loadConnections().then(async (next) => {
            if (cancelled) return;
            setOpen(Boolean(result?.status));
            if (result?.status === "success" && result.action === "linked" && next.some((p) => p.portal === "github" && p.verified)) {
                toast.success("GitHub ownership verified. Updating your ranking.");
                await onVerifiedRef.current();
            } else if (result?.status === "error" || result?.status === "cancelled") {
                toast.error(result.error || "GitHub verification was cancelled. You can try again.");
            }
        }).catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
        // Check once on entering the leaderboard; subsequent verification refreshes explicitly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pending = connections.filter((p) => !p.verified);
    const visible = open && !active;
    const close = () => setOpen(false);
    const { handleBackdropClick } = useModalDismiss({ isOpen: visible, onClose: close });
    useEffect(() => {
        if (!visible) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [visible]);

    return <>
        {(pending.length > 0 || error) && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#FFF8D6] border-2 border-black shadow-[3px_3px_0px_#000]">
            <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-6 h-6 shrink-0" />
                <p className="text-sm font-bold">{error ? "Could not check your platform verification." : `Public platform activity can count toward your ranking with or without ownership verification.`}</p>
            </div>
            <button type="button" className="shrink-0 rounded-lg border-2 border-black px-4 py-2 bg-[#FFE566] text-sm font-black" onClick={() => {
                if (error) void loadConnections().then(() => setOpen(true)).catch(() => setError(true));
                else setOpen(true);
            }}>{error ? "Retry" : "Verify ownership"}</button>
        </div>}
        {visible && loaded && createPortal(<div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-3 sm:p-5" onClick={handleBackdropClick}>
            <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leaderboardVerificationTitle" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border-2 border-black bg-white p-5 sm:p-6 shadow-[6px_6px_0px_#000] text-black outline-none" onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
                if (!elements?.length) return;
                const first = elements[0], last = elements[elements.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
            }}>
                <div className="flex items-start justify-between gap-4">
                    <div><h2 id="leaderboardVerificationTitle" className="text-xl sm:text-2xl font-black">{pending.length ? "Verify platform ownership" : connections.length ? "Your accounts are verified" : "Connect an account to get ranked"}</h2>
                        <p className="mt-2 text-sm text-neutral-600 font-medium">Ownership verification is optional. Both verified and unverified public platform connections can contribute to your Orbix Score.</p></div>
                    <button type="button" onClick={close} aria-label="Close verification list" className="p-1.5 shrink-0 border-2 border-black rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="my-5 space-y-3">
                    {pending.map((connection) => <div key={connection.portal} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border-2 border-black bg-[#FAF6EE]">
                        <span className="w-9 h-9 p-1.5 shrink-0 flex items-center justify-center">{getPortalIcon(connection.portal, "w-full h-full object-contain")}</span>
                        <div className="flex-1 min-w-0"><p className="font-black text-sm">{PORTALS[connection.portal]?.name || connection.portal}</p><p className="text-xs font-mono text-neutral-600 break-all">@{connection.username}</p></div>
                        {isPlatformVerificationSupported(connection.portal) ? <button type="button" onClick={() => setActive(connection)} className="flex items-center justify-center gap-2 shrink-0 rounded-lg border-2 border-black bg-[#FFE566] px-4 py-2 text-sm font-black whitespace-nowrap"><ShieldCheck className="w-4 h-4 shrink-0" />Verify</button> : <span className="text-xs font-bold text-neutral-500">Verification unavailable</span>}
                    </div>)}
                    {!pending.length && connections.length > 0 && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#a2ff86] p-4 text-sm font-bold"><Check className="w-5 h-5 shrink-0" />Ownership is verified for your connected platforms.</p>}
                    {!connections.length && <p className="text-sm text-neutral-600">Connect a coding profile and keep the connection public to include its activity.</p>}
                    {pending.some((p) => !isPlatformVerificationSupported(p.portal)) && <p className="text-xs text-neutral-500">Public connections can count even when ownership verification is unavailable.</p>}
                </div>
                <div className="flex flex-wrap justify-between items-center gap-3 border-t-2 border-black/10 pt-4">
                    <Link to="/onboarding" className="text-sm font-bold underline underline-offset-4">Manage connections</Link>
                    <button type="button" onClick={close} className="rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-black">View leaderboard</button>
                </div>
            </div>
        </div>, document.body)}
        {active && <OwnershipVerificationModal key={`${active.portal}:${active.username}`} isOpen portalId={active.portal} username={active.username} onClose={() => setActive(null)} onVerifiedSuccess={() => {
            void loadConnections().then(() => onVerifiedRef.current()).catch(() => {
                setError(true);
                toast.error("Account verified. Refresh to update your connections and ranking.");
            });
        }} />}
    </>;
}
