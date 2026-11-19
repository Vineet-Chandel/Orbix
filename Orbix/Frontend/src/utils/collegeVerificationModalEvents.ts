/**
 * College Verification Event Bus
 * Provides unified, single-instance modal orchestration and state synchronization.
 */

export const ORBIX_OPEN_COLLEGE_VERIFICATION_EVENT = "orbix_open_college_verification";
export const ORBIX_COLLEGE_VERIFICATION_UPDATED_EVENT = "orbix_college_verification_updated";

export interface OpenCollegeVerificationDetail {
    collegeName?: string | null;
    collegeId?: string | null;
}

/**
 * Dispatches an event to open the single authoritative College Verification modal instance.
 */
export function openCollegeVerificationModal(detail?: OpenCollegeVerificationDetail): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<OpenCollegeVerificationDetail>(ORBIX_OPEN_COLLEGE_VERIFICATION_EVENT, {
            detail: detail || {},
        })
    );
}

/**
 * Dispatches an event signaling that college verification status has been updated.
 */
export function emitCollegeVerificationUpdated(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(ORBIX_COLLEGE_VERIFICATION_UPDATED_EVENT));
}
