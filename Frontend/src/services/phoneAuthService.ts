import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    type ConfirmationResult,
    type UserCredential,
} from "firebase/auth";
import { auth, firebaseConfig, isFirebaseConfigured } from "../config/firebase";

export interface SendOtpResult {
    success: boolean;
    confirmationResult?: ConfirmationResult;
    message: string;
    formattedPhone: string;
}

export interface ConfirmOtpResult {
    success: boolean;
    idToken?: string;
    phoneNumber?: string | null;
    message: string;
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) for standard 10-digit mobile numbers.
 */
export function formatToE164(raw: string, defaultCountryCode = "91"): {
    isValid: boolean;
    e164: string;
    formatted: string;
    rawDigits: string;
} {
    if (!raw || typeof raw !== "string") {
        return { isValid: false, e164: "", formatted: "", rawDigits: "" };
    }

    const cleaned = raw.trim().replace(/[\s\-().]/g, "");
    let digits = cleaned.replace(/^\+/, "");

    // Strip leading 0 if present (e.g., 09876543210 -> 9876543210)
    if (digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    if (/^[6-9]\d{9}$/.test(digits)) {
        // Standard 10-digit Indian mobile
        const e164 = `+${defaultCountryCode}${digits}`;
        const formatted = `+${defaultCountryCode} ${digits.slice(0, 5)} ${digits.slice(5)}`;
        return { isValid: true, e164, formatted, rawDigits: digits };
    } else if (digits.startsWith("91") && digits.length === 12 && /^[6-9]/.test(digits.slice(2))) {
        // 12-digit Indian number with country code prefix
        const e164 = `+${digits}`;
        const rawDigits = digits.slice(2);
        const formatted = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
        return { isValid: true, e164, formatted, rawDigits };
    } else if (/^\d{10,15}$/.test(digits)) {
        // General international number with country code
        const e164 = `+${digits}`;
        return { isValid: true, e164, formatted: `+${digits}`, rawDigits: digits };
    }

    return { isValid: false, e164: cleaned, formatted: cleaned, rawDigits: digits };
}

/**
 * Ensures an invisible reCAPTCHA container element exists in the DOM.
 * If not already present in the form, it will either attach inside #firebase-recaptcha-wrapper
 * or dynamically mount a hidden container into document.body so that reCAPTCHA rendering
 * NEVER fails with a "container element not found" error.
 */
export function ensureRecaptchaContainer(containerId: string = "firebase-recaptcha-container"): HTMLElement {
    if (typeof document === "undefined") {
        throw new Error("reCAPTCHA requires a browser DOM environment.");
    }

    let container = document.getElementById(containerId);
    if (container) {
        return container;
    }

    // Try finding the dedicated wrapper element inside the form
    const wrapper = document.getElementById("firebase-recaptcha-wrapper");
    if (wrapper) {
        wrapper.innerHTML = `<div id="${containerId}"></div>`;
        container = document.getElementById(containerId);
        if (container) {
            return container;
        }
    }

    // Fallback: Dynamically create and append an invisible container to document.body
    container = document.createElement("div");
    container.id = containerId;
    container.className = "firebase-recaptcha-invisible-root";
    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.right = "0";
    container.style.zIndex = "-1";
    container.style.width = "0px";
    container.style.height = "0px";
    container.style.overflow = "hidden";
    container.style.visibility = "hidden";
    document.body.appendChild(container);

    return container;
}

/**
 * Safely clears an existing RecaptchaVerifier instance, cleans up floating
 * Google reCAPTCHA badge artifacts from document.body, and resets the DOM container
 * to prevent "reCAPTCHA has already been rendered in this element" errors.
 */
export function clearRecaptchaVerifier(
    verifier?: RecaptchaVerifier | null,
    wrapperOrContainerId: string = "firebase-recaptcha-wrapper"
): void {
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
    const targetVerifier = verifier || (win?.__orbix_recaptcha_verifier as RecaptchaVerifier | undefined);

    if (targetVerifier) {
        try {
            targetVerifier.clear();
        } catch {
            // verifier.clear() might throw if already destroyed; safe to ignore
        }
    }

    if (win) {
        win.__orbix_recaptcha_verifier = null;
    }

    if (typeof document !== "undefined") {
        // 1. Remove floating Google reCAPTCHA badges attached to document.body
        try {
            const badges = document.querySelectorAll(".grecaptcha-badge");
            badges.forEach((badge) => {
                try {
                    badge.parentElement?.removeChild(badge);
                } catch {
                    // ignore DOM removal errors
                }
            });
        } catch {
            // ignore selector errors
        }

        // 2. Reset the wrapper element with a pristine child container
        const wrapper = document.getElementById(wrapperOrContainerId);
        if (wrapper) {
            wrapper.innerHTML = '<div id="firebase-recaptcha-container"></div>';
        } else {
            const container = document.getElementById("firebase-recaptcha-container");
            if (container) {
                container.innerHTML = "";
            }
        }
    }
}

/**
 * Retrieves the active RecaptchaVerifier or creates a pristine invisible instance.
 * Automatically guarantees that the target DOM container exists, so it can never throw
 * "reCAPTCHA container element not found".
 */
export function createRecaptchaVerifier(
    containerId: string = "firebase-recaptcha-container",
    onExpired?: () => void,
    forceNew: boolean = false
): RecaptchaVerifier {
    if (!auth) {
        throw new Error("Firebase Auth is not initialized. Please check client environment configuration.");
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
        throw new Error("RecaptchaVerifier can only be created in a browser environment.");
    }

    const win = window as unknown as Record<string, unknown>;
    const existing = win.__orbix_recaptcha_verifier as RecaptchaVerifier | undefined;

    // Reuse existing verifier if active, valid, and not forced to recreate
    if (!forceNew && existing && !(existing as unknown as { destroyed?: boolean }).destroyed) {
        return existing;
    }

    // Clean up previous instance and restore fresh container element
    clearRecaptchaVerifier(existing, "firebase-recaptcha-wrapper");

    // Guarantee that container element exists in DOM (auto-created if missing)
    const container = ensureRecaptchaContainer(containerId);
    container.innerHTML = "";

    const verifier = new RecaptchaVerifier(auth, container, {
        size: "invisible",
        callback: () => {
            // reCAPTCHA solved - allow signInWithPhoneNumber
        },
        "expired-callback": () => {
            if (onExpired) onExpired();
        },
    });

    win.__orbix_recaptcha_verifier = verifier;
    return verifier;
}

/**
 * Dispatches an SMS verification code via Firebase Phone Authentication.
 */
export async function sendFirebasePhoneOtp(
    rawPhone: string,
    recaptchaVerifier?: RecaptchaVerifier
): Promise<SendOtpResult> {
    const parsed = formatToE164(rawPhone);
    if (!parsed.isValid) {
        throw new Error("Please enter a valid 10-digit mobile phone number.");
    }

    if (!auth) {
        throw new Error("Firebase Auth client is not initialized.");
    }

    const verifier = recaptchaVerifier || createRecaptchaVerifier();

    try {
        const confirmationResult = await signInWithPhoneNumber(auth, parsed.e164, verifier);
        return {
            success: true,
            confirmationResult,
            message: `SMS verification code dispatched to ${parsed.formatted}`,
            formattedPhone: parsed.formatted,
        };
    } catch (err: unknown) {
        console.error("[Firebase Phone Auth] Error during SMS dispatch:", err);
        // Safe user-friendly error translations
        let userMessage = "Failed to dispatch SMS verification code.";
        const errorRecord = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : {};
        const errorCode = typeof errorRecord.code === "string" ? errorRecord.code : "";
        const originalMessage = typeof errorRecord.message === "string" ? errorRecord.message : "";

        // If captcha check failed or verifier expired, clear the stored verifier so retry starts fresh
        if (errorCode === "auth/captcha-check-failed") {
            clearRecaptchaVerifier(verifier, "firebase-recaptcha-wrapper");
        }

        const currentProjectId = firebaseConfig.projectId || "your project";

        switch (errorCode) {
            case "auth/operation-not-allowed":
                if (originalMessage && (originalMessage.toLowerCase().includes("region") || originalMessage.toLowerCase().includes("sms unable"))) {
                    userMessage = `SMS delivery to this country is restricted by Firebase SMS Region Policy. Please allow your region (e.g., India +91) in Firebase Console > Authentication > Settings > SMS Regions, or use a configured test phone number.`;
                } else if (originalMessage && originalMessage.includes("BILLING_NOT_ENABLED")) {
                    userMessage = `Firebase project '${currentProjectId}' is on the Spark (free) plan and requires upgrading to the Blaze (Pay as you go) plan in Firebase Console to send real cellular SMS messages via Google Cloud. To test for free without billing, add your phone number to 'Phone numbers for testing' in Firebase Console (Authentication > Sign-in method > Phone) and use a fixed code like 123456.`;
                } else {
                    userMessage = `Phone Authentication is disabled or region-restricted in Firebase Console for project '${currentProjectId}'. Please ensure Phone is enabled and SMS Region Policy allows your region (Firebase Console > Authentication > Settings > SMS Regions), or use a registered test phone number.`;
                }
                break;
            case "auth/unauthorized-domain":
                userMessage = `This domain is not authorized in Firebase Console for project '${currentProjectId}'. Please add your current domain/IP (e.g. localhost) to Firebase Console > Authentication > Settings > Authorized domains.`;
                break;
            case "auth/invalid-phone-number":
                userMessage = "The phone number format is invalid. Please check and try again.";
                break;
            case "auth/too-many-requests":
                userMessage = "Too many SMS requests sent to this number. Please wait before retrying.";
                break;
            case "auth/quota-exceeded":
                userMessage = "SMS verification quota has been reached for this project. Please add test phone numbers in Firebase Console for unlimited testing.";
                break;
            case "auth/captcha-check-failed":
                userMessage = "reCAPTCHA verification failed. Please try again.";
                break;
            case "auth/missing-phone-number":
                userMessage = "Phone number is required.";
                break;
            case "auth/billing-not-enabled":
                userMessage = `Firebase project '${currentProjectId}' requires the Blaze (Pay as you go) plan in Firebase Console to send real SMS messages to cellular carriers. Alternatively, add your phone number to 'Phone numbers for testing' in Firebase Console (Authentication > Sign-in method > Phone) to test instantly with a fixed code (e.g. 123456).`;
                break;
            case "auth/network-request-failed":
                userMessage = "Network error while connecting to Firebase. Please check your internet connection.";
                break;
            default:
                if (originalMessage && originalMessage.includes("BILLING_NOT_ENABLED")) {
                    userMessage = `Firebase project '${currentProjectId}' requires the Blaze (Pay as you go) plan in Firebase Console to send real SMS messages. Alternatively, add your phone number to 'Phone numbers for testing' in Firebase Console (Authentication > Sign-in method > Phone) and test with a fixed code (e.g. 123456).`;
                } else if (originalMessage && !originalMessage.includes("internal-error")) {
                    userMessage = originalMessage;
                }
                break;
        }

        const errorObj = new Error(userMessage);
        (errorObj as unknown as Record<string, unknown>).code = errorCode;
        (errorObj as unknown as Record<string, unknown>).originalError = err;
        throw errorObj;
    }
}

/**
 * Confirms the 6-digit code against Firebase and retrieves a valid Firebase ID token.
 */
export async function confirmFirebasePhoneOtp(
    confirmationResult: ConfirmationResult,
    code: string
): Promise<ConfirmOtpResult> {
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
        throw new Error("Please enter the complete 6-digit numeric verification code.");
    }

    try {
        const userCredential: UserCredential = await confirmationResult.confirm(trimmedCode);
        const user = userCredential.user;
        const idToken = await user.getIdToken(true);

        return {
            success: true,
            idToken,
            phoneNumber: user.phoneNumber,
            message: "Phone number authenticated successfully!",
        };
    } catch (err: unknown) {
        let userMessage = "Failed to verify SMS code.";
        const errorRecord = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : {};
        const errorCode = typeof errorRecord.code === "string" ? errorRecord.code : "";
        const originalMessage = typeof errorRecord.message === "string" ? errorRecord.message : "";

        switch (errorCode) {
            case "auth/invalid-verification-code":
                userMessage = "Invalid verification code. Please check the code and try again.";
                break;
            case "auth/code-expired":
                userMessage = "Verification code has expired. Please request a new code.";
                break;
            case "auth/session-expired":
                userMessage = "Verification session has expired. Please request a new code.";
                break;
            default:
                if (originalMessage) {
                    userMessage = originalMessage;
                }
                break;
        }

        const errorObj = new Error(userMessage);
        (errorObj as unknown as Record<string, unknown>).code = errorCode;
        (errorObj as unknown as Record<string, unknown>).originalError = err;
        throw errorObj;
    }
}

export { isFirebaseConfigured };
