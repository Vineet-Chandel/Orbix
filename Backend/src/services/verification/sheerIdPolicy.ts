import { createHmac, timingSafeEqual } from 'node:crypto';

export function validSheerIdSignature(body: Buffer, signature: string, secret: string): boolean {
    if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, 'hex'), createHmac('sha256', secret).update(body).digest());
}

export interface SheerIdDetails {
    programId?: string;
    updated?: number;
    lastResponse?: { verificationId?: string; currentStep?: string; segment?: string; errorIds?: string[]; rejectionReasons?: string[] };
    personInfo?: { firstName?: string; lastName?: string; email?: string; organization?: { id?: string | number } };
    confirmedSegments?: Array<{ segment?: string; active?: boolean; organization?: { id?: string | number }; endDate?: number }>;
}
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function resolveSheerIdResult(details: SheerIdDetails, expected: {
    sessionId: string; programId: string; institutionId: string; email: string; name: string;
}, now = Date.now()) {
    const response = details.lastResponse;
    if (details.programId !== expected.programId || response?.verificationId !== expected.sessionId) {
        throw new Error('Provider session binding mismatch');
    }
    const step = response.currentStep || 'unknown';
    let status = step === 'pending' ? 'PROCESSING' : step === 'error' ? 'REJECTED' : 'PENDING';
    let reason: string | null = null;
    let expiresAt: Date | null = null;
    if (step === 'success') {
        const person = details.personInfo;
        // Customer PII permission is required: missing evidence fails closed.
        if ((response.errorIds?.length || 0) > 0 || response.segment !== 'student' || String(person?.organization?.id) !== expected.institutionId ||
            normalize(person?.email || '') !== normalize(expected.email) ||
            normalize(`${person?.firstName || ''} ${person?.lastName || ''}`) !== normalize(expected.name)) {
            status = 'REJECTED';
            reason = 'The verified name, email or institution does not match this application. Contact support before trying again.';
        } else {
            const affiliations = (details.confirmedSegments || []).filter(s => s.segment === 'student' && String(s.organization?.id) === expected.institutionId);
            if (affiliations.length && !affiliations.some(s => s.active === true)) {
                return { status: 'REJECTED', step, reason: 'Current enrollment could not be confirmed. Contact support for a review.', expiresAt: null };
            }
            const annual = now + 365 * 24 * 60 * 60 * 1000;
            const ends = (details.confirmedSegments || []).filter(s => s.segment === 'student' &&
                String(s.organization?.id) === expected.institutionId && s.active === true &&
                typeof s.endDate === 'number' && s.endDate > 0).map(s => s.endDate!);
            expiresAt = new Date(Math.min(annual, ...ends));
            status = expiresAt.getTime() > now ? 'APPROVED' : 'INVALIDATED';
            if (status === 'INVALIDATED') reason = 'Enrollment has ended. Please verify current enrollment again.';
        }
    } else if (step === 'smsLoop') {
        status = 'REJECTED';
        reason = 'Phone verification is unavailable. Contact support to use the email verification route.';
    } else if (step === 'docUpload') {
        const reasons = response.rejectionReasons || [];
        reason = reasons.includes('DOCUMENT_UNREADABLE') ? 'Upload a clearer document with all text visible.' :
            reasons.includes('DOCUMENT_EXPIRED') ? 'Upload a current enrollment document with a visible date.' :
            reasons.some(r => r.startsWith('MISMATCH')) ? 'Use a document matching your confirmed name and selected college.' :
            'Provide one document showing your name, college and current enrollment date.';
    } else if (step === 'error') {
        reason = 'Verification could not be completed. Contact support for a review before starting again.';
    }
    return { status, step, reason, expiresAt };
}
