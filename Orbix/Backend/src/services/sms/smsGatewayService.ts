/**
 * Orbix SMS Gateway Service
 * Mobile verification migrated to Firebase Phone Authentication.
 * Legacy carrier fallback and localized development simulation.
 */

export interface SendSmsOptions {
    to: string; // phone number (e.g. "+919389205207" or "9389205207")
    otp: string;
    clubName?: string | undefined;
    fetchImpl?: typeof fetch | undefined;
}

const SMS_PLACEHOLDER_PATTERNS = [
    "your_twilio_",
    "your_account_sid",
    "your_auth_token",
    "your_phone_number",
    "+10000000000",
    "placeholder",
    "example",
];

function isPlaceholderCredential(val: string | undefined): boolean {
    if (!val || !val.trim()) return true;
    const lower = val.trim().toLowerCase();
    return SMS_PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

function resolveTwilioConfig():
    | { configured: true; accountSid: string; authToken: string; fromPhone: string }
    | { configured: false; missing: string[] } {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();

    const missing: string[] = [];
    if (isPlaceholderCredential(accountSid)) missing.push("TWILIO_ACCOUNT_SID");
    if (isPlaceholderCredential(authToken)) missing.push("TWILIO_AUTH_TOKEN");
    if (isPlaceholderCredential(fromPhone)) missing.push("TWILIO_PHONE_NUMBER");

    if (missing.length > 0) {
        return { configured: false, missing };
    }

    return {
        configured: true,
        accountSid: accountSid!,
        authToken: authToken!,
        fromPhone: fromPhone!,
    };
}

function sanitizeSmsError(rawMsg: unknown, otp: string): string {
    const base = typeof rawMsg === "string" && rawMsg.trim() ? rawMsg.trim() : "SMS provider dispatch failed";
    return otp ? base.split(otp).join("[REDACTED]") : base;
}

export interface SendSmsResult {
    success: boolean;
    messageId?: string | undefined;
    simulated?: boolean | undefined;
    providerError?: string | undefined;
    error?: string | undefined;
}

export interface NormalizedPhone {
    isValid: boolean;
    canonical: string; // "+919389205207"
    rawDigits: string; // "9389205207"
    formatted: string; // "+91 93892 05207"
    countryCode: string; // "91"
}

/**
 * Normalizes phone numbers with special support for standard Indian mobile numbers.
 */
export function normalizePhoneNumber(raw: string): NormalizedPhone {
    if (!raw || typeof raw !== "string") {
        return { isValid: false, canonical: "", rawDigits: "", formatted: "", countryCode: "" };
    }

    // Remove all whitespace, dashes, parens, dots
    const cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");

    let digits = cleaned.replace(/^\+/, "");

    // If starts with leading zero (e.g. 09389205207), remove it
    if (digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    let canonical = "";
    let rawDigits = "";
    let formatted = "";
    let countryCode = "91";

    if (/^[6-9]\d{9}$/.test(digits)) {
        // Standard 10-digit Indian mobile number
        rawDigits = digits;
        canonical = `+91${digits}`;
        formatted = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    } else if (digits.startsWith("91") && digits.length === 12 && /^[6-9]/.test(digits.slice(2))) {
        // Indian number with 91 prefix
        rawDigits = digits.slice(2);
        canonical = `+${digits}`;
        formatted = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
    } else if (/^\d{10,15}$/.test(digits)) {
        // International number
        canonical = `+${digits}`;
        rawDigits = digits;
        formatted = `+${digits}`;
        countryCode = digits.slice(0, 2);
    } else {
        return { isValid: false, canonical: cleaned, rawDigits: digits, formatted: cleaned, countryCode: "" };
    }

    return {
        isValid: true,
        canonical,
        rawDigits,
        formatted,
        countryCode,
    };
}

/**
 * Dispatches an SMS verification code via configured carrier or simulated fallback.
 */
export async function sendVerificationSms(options: SendSmsOptions): Promise<SendSmsResult> {
    const { to, otp, clubName, fetchImpl } = options;
    const phone = normalizePhoneNumber(to);
    const isProduction = process.env.NODE_ENV === "production";

    if (!phone.isValid) {
        return {
            success: false,
            simulated: false,
            error: "Please provide a valid 10-digit mobile phone number.",
        };
    }

    const messageText = clubName
        ? `Your Orbix verification code for ${clubName} is: ${otp}. Valid for 10 minutes. Do not share.`
        : `Your Orbix verification code is: ${otp}. Valid for 10 minutes. Do not share.`;

    const twilioConfig = resolveTwilioConfig();

    // 1. Configured Twilio Gateway (fail closed on ANY provider/network/response failure)
    if (twilioConfig.configured) {
        const activeFetch = fetchImpl || globalThis.fetch;
        try {
            const authHeader =
                "Basic " + Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString("base64");
            const bodyParams = new URLSearchParams({
                To: phone.canonical,
                From: twilioConfig.fromPhone,
                Body: messageText,
            });

            const twilioRes = await activeFetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`,
                {
                    method: "POST",
                    headers: {
                        Authorization: authHeader,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: bodyParams.toString(),
                }
            );

            let twilioData: any = null;
            try {
                twilioData = await twilioRes.json();
            } catch {
                twilioData = null;
            }

            if (twilioRes.ok && typeof twilioData?.sid === "string" && twilioData.sid.trim().length > 0) {
                console.log(`[Twilio SMS] Verification code dispatched to ${phone.formatted} (SID: ${twilioData.sid})`);
                return {
                    success: true,
                    simulated: false,
                    messageId: twilioData.sid,
                };
            }

            const safeProviderError = sanitizeSmsError(
                twilioData?.message || `Twilio rejected SMS request with HTTP ${twilioRes.status}`,
                otp
            );
            console.error("[Twilio SMS] Delivery failed:", {
                status: twilioRes.status,
                error: safeProviderError,
            });
            return {
                success: false,
                simulated: false,
                providerError: safeProviderError,
                error: safeProviderError,
            };
        } catch (twErr: any) {
            const safeProviderError = sanitizeSmsError(twErr?.message || "Network error contacting SMS provider", otp);
            console.error("[Twilio SMS] Dispatch error:", safeProviderError);
            return {
                success: false,
                simulated: false,
                providerError: safeProviderError,
                error: safeProviderError,
            };
        }
    }

    // 2. Production MUST fail closed when SMS provider credentials are absent
    if (isProduction) {
        const missingList = twilioConfig.missing.join(", ");
        console.error(`[Twilio SMS] Production SMS delivery failed: missing required credentials (${missingList}).`);
        return {
            success: false,
            simulated: false,
            error: "SMS verification delivery service is not configured for production.",
        };
    }

    // 3. Explicit non-production simulation fallback (NEVER logs raw OTP)
    console.log(
        `[ORBIX SMS SERVICE] Non-production simulated SMS dispatch for ${phone.formatted} (OTP redacted from logs).`
    );

    return {
        success: true,
        simulated: true,
        messageId: `sim_sms_${Date.now()}`,
    };
}
