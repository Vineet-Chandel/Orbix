import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, ShieldCheck, X, ExternalLink, CheckCircle2, Clock, RefreshCw, Mail } from 'lucide-react';
import { OrbixButton } from '../OrbixButton';
import { CollegeAutocomplete } from '../CollegeAutocomplete';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useAppDispatch, useAppSelector, updateUserProfile } from '../../store';
import { updateProfile, type InstitutionItem } from '../../utils/profileApi';
import { fetchCollegeVerificationStatus, refreshEnrollmentVerification, startEnrollmentVerification, type VerificationStatusResponse } from '../../api/collegeVerificationApi';

export interface CollegeVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCollegeName?: string | null;
    currentCollegeId?: string | null;
    onVerificationSubmitted?: () => void;
}

export function CollegeVerificationModal({ isOpen, onClose, currentCollegeName, currentCollegeId, onVerificationSubmitted }: CollegeVerificationModalProps) {
    const { user } = useAppSelector(state => state.user);
    const dispatch = useAppDispatch();
    const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
    const [selected, setSelected] = useState<InstitutionItem | null>(null);
    const [changing, setChanging] = useState(false);
    const [name, setName] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const currentRequest = useRef(0);
    const changedRef = useRef(onVerificationSubmitted);
    const stateRef = useRef('');
    const polling = useRef(false);
    changedRef.current = onVerificationSubmitted;
    const { handleBackdropClick } = useModalDismiss({ isOpen, onClose });
    const apply = useCallback((result: VerificationStatusResponse) => {
        setStatus(result);
        const version = `${result.status}:${result.latestApplication?.updated_at || ''}`;
        if (stateRef.current && stateRef.current !== version) changedRef.current?.();
        stateRef.current = version;
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const generation = ++currentRequest.current;
        setLoading(true); setBusy(false); setError(''); setStatus(null); setConsent(false); setChanging(false); setSelected(null);
        setName([user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' '));
        stateRef.current = '';
        void fetchCollegeVerificationStatus().then(result => { if (generation === currentRequest.current) apply(result); })
            .catch(err => { if (generation === currentRequest.current) setError(err.message); })
            .finally(() => { if (generation === currentRequest.current) setLoading(false); });
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        return () => { currentRequest.current++; document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
    }, [isOpen, user?.id, user?.firstName, user?.middleName, user?.lastName, apply]);

    const refresh = useCallback(async (silent = false) => {
        if (polling.current) return;
        polling.current = true;
        const generation = currentRequest.current;
        if (!silent) { setBusy(true); setError(''); }
        try {
            const result = await refreshEnrollmentVerification();
            if (generation === currentRequest.current) apply(result);
        } catch (err) {
            if (generation === currentRequest.current) setError(err instanceof Error ? err.message : 'Could not check verification.');
        } finally { polling.current = false; if (generation === currentRequest.current && !silent) setBusy(false); }
    }, [apply]);

    const pending = status?.status === 'PENDING' || status?.status === 'PROCESSING';
    useEffect(() => {
        if (!isOpen || !pending) return;
        const check = () => { if (document.visibilityState === 'visible') void refresh(true); };
        const timer = window.setInterval(check, 20000);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        return () => { clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
    }, [isOpen, pending, refresh]);

    const saveCollege = async () => {
        if (!selected) return;
        const generation = currentRequest.current;
        setBusy(true); setError('');
        try {
            const result = await updateProfile({ collegeId: selected.id });
            if (generation !== currentRequest.current) return;
            dispatch(updateUserProfile(result));
            apply(await fetchCollegeVerificationStatus()); setChanging(false); setConsent(false);
            changedRef.current?.();
        } catch (err) { setError(err instanceof Error ? err.message : 'Could not save college.'); }
        finally { if (generation === currentRequest.current) setBusy(false); }
    };
    const start = async () => {
        const collegeId = status?.currentCollege?.id;
        if (!collegeId) return;
        const generation = currentRequest.current;
        setBusy(true); setError('');
        try {
            const result = await startEnrollmentVerification({ collegeId, studentName: name.trim(), consent });
            if (generation !== currentRequest.current) return;
            // Navigate only to the known hosted provider. Returning never grants a badge.
            if (result.resumeUrl) {
                const url = new URL(result.resumeUrl);
                if (url.origin !== 'https://services.sheerid.com') throw new Error('Invalid verification destination.');
                window.open(url.href, '_blank', 'noopener,noreferrer');
            }
            apply(await fetchCollegeVerificationStatus());
        } catch (err) { setError(err instanceof Error ? err.message : 'Could not start verification.'); }
        finally { if (generation === currentRequest.current) setBusy(false); }
    };
    const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return;
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]');
        const first = elements?.[0], last = elements?.[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    if (!isOpen) return null;
    const verified = status?.isCollegeVerified;
    const application = status?.activeApplication || status?.latestApplication;
    const collegeName = status?.currentCollege?.officialName || currentCollegeName;
    const hasCollege = Boolean(status?.currentCollege?.id || currentCollegeId);
    const resumeUrl = status?.provider?.resumeUrl;
    const reviewing = status?.status === 'PROCESSING';
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={handleBackdropClick}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="college-verification-title" tabIndex={-1} onKeyDown={trapFocus}
                className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0_0_#000] outline-none sm:p-7">
                <header className="flex items-start gap-3 border-b-2 border-black/10 pb-5">
                    <div className="rounded-2xl border-2 border-black bg-[#FFE34A] p-3"><GraduationCap size={26} /></div>
                    <div className="min-w-0 flex-1"><h2 id="college-verification-title" className="text-xl font-black sm:text-2xl">Verify your college</h2><p className="mt-1 text-sm font-medium text-neutral-600">Confirm your current student enrollment.</p></div>
                    <button aria-label="Close verification" onClick={onClose} className="rounded-xl border-2 border-black p-2 hover:bg-neutral-100"><X size={20} /></button>
                </header>
                {loading ? <p className="py-10 text-center font-bold" role="status">Loading verification…</p> : <div className="space-y-5 pt-5">
                    <section className="rounded-2xl border-2 border-black bg-[#FAF8F0] p-4">
                        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Your institution</p><p className="mt-1 font-bold">{collegeName || 'Select your college'}</p></div>
                            {!pending && !verified && <button onClick={() => setChanging(!changing)} className="text-sm font-bold underline">{changing ? 'Cancel' : 'Change'}</button>}</div>
                        {(changing || !hasCollege) && <div className="mt-4 space-y-3"><CollegeAutocomplete selectedCollege={selected} onChange={setSelected} disabled={busy} /><OrbixButton onClick={() => void saveCollege()} loading={busy} disabled={!selected} size="sm">Confirm college</OrbixButton></div>}
                    </section>
                    {verified ? <section className="rounded-2xl border-2 border-black bg-lime-100 p-5" role="status"><CheckCircle2 className="mb-2" /><h3 className="text-xl font-black">You’re verified</h3><p className="mt-2 text-sm">Your college badge has been saved automatically.</p>{application?.expires_at && <p className="mt-2 text-sm">Renew by {new Date(application.expires_at).toLocaleDateString()}.</p>}</section> : pending ? <section className="space-y-4" aria-live="polite">
                        <div className="flex items-center gap-2 font-black">{reviewing ? <Clock size={22} /> : <ShieldCheck size={22} />}<h3>{reviewing ? 'Under review' : 'Action needed'}</h3></div>
                        <p className="text-sm leading-relaxed text-neutral-700">{reviewing ? 'Your enrollment is being reviewed. You can close this window; your result will be saved automatically.' : application?.rejection_reason || 'Continue your secure verification to finish the required checks.'}</p>
                        {resumeUrl && <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#FFE34A] p-3 font-bold shadow-[3px_3px_0_0_#000]">Continue verification <ExternalLink size={17} /></a>}
                        <OrbixButton variant="white" fullWidth loading={busy} onClick={() => void refresh()} icon={RefreshCw}>Check status</OrbixButton>
                    </section> : <>
                        {application?.rejection_reason && <p className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm" role="status">{application.rejection_reason}</p>}
                        <div className="space-y-3 text-sm leading-relaxed"><p>We use SheerID to check current enrollment. Continue securely to complete your institution’s available checks.</p><p className="text-neutral-600">Only if needed, provide one document showing your name, college and current enrollment date. A dated student ID, current ERP enrollment page, fee receipt or timetable may be used when accepted by the verification provider.</p></div>
                        <label className="block text-sm font-bold">Full name as shown on your student records<input value={name} onChange={e => setName(e.target.value)} maxLength={255} autoComplete="name" className="mt-2 w-full rounded-xl border-2 border-black p-3 font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400" /></label>
                        <p className="flex items-start gap-2 text-sm text-neutral-600"><Mail size={18} className="mt-0.5 shrink-0" /><span>Use your verified Orbix email ({user?.gmail}) in the hosted flow. Gmail is supported. No phone OTP is required.</span></p>
                        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" /><span>I confirm my name and college, and consent to sharing the details needed for SheerID to verify my enrollment. <a href="https://www.sheerid.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="font-bold underline">Privacy policy</a></span></label>
                        {status && !status.provider?.available && <p className="rounded-xl bg-amber-50 p-3 text-sm">Enrollment verification is not available for this college yet. Please contact support or try again later.</p>}
                        <OrbixButton fullWidth loading={busy} loadingLabel="Starting verification…" disabled={!status?.provider?.available || !hasCollege || changing || !consent || name.trim().length < 2} onClick={() => void start()} iconRight={ExternalLink}>Continue with SheerID</OrbixButton>
                    </>}
                    {!status && !loading && <OrbixButton variant="white" fullWidth loading={busy} onClick={() => void refresh()}>Try again</OrbixButton>}
                    {error && <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                    <footer className="border-t-2 border-black/10 pt-4 text-xs leading-relaxed text-neutral-500"><p className="flex items-start gap-2"><ShieldCheck size={17} className="shrink-0" />Documents are submitted directly to SheerID. Orbix stores the verification result and renewal date. Results save automatically.</p><a href="https://support.sheerid.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-black underline">Need help or want to appeal?</a></footer>
                </div>}
            </div>
        </div>, document.body);
}
