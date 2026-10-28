/**
 * Orbix SMS Gateway Service
 * Mobile verification migrated to Firebase Phone Authentication.
 * Legacy carrier fallback and localized development simulation.
 */

export interface SendSmsOptions {
    to: string; // phone number (e.g. "+919389205207" or "9389205207")
    otp: string;
    clubName?: string | undefined;
}

export interface SendSmsResult {
    success: boolean;
    messageId?: string | undefined;
    simulated?: boolean | undefined;
    devOtp?: string | undefined;
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
    const { to, otp, clubName } = options;
    const phone = normalizePhoneNumber(to);

    if (!phone.isValid) {
        return {
            success: false,
            error: "Please provide a valid 10-digit mobile phone number.",
        };
    }

    const messageText = clubName
        ? `Your Orbix verification code for ${clubName} is: ${otp}. Valid for 10 minutes. Do not share.`
        : `Your Orbix verification code is: ${otp}. Valid for 10 minutes. Do not share.`;

    let lastProviderError: string | undefined;

    // Primary mobile verification is handled via Firebase Phone Authentication on the client SDK.
    // Carrier fallback for auxiliary transactional notifications:
    // Check Twilio Gateway
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioFrom && !twilioSid.includes("your_twilio_sid")) {
        try {
            const authHeader = "Basic " + Buffer.from(`${twilioSid.trim()}:${twilioAuth.trim()}`).toString("base64");
            const bodyParams = new URLSearchParams({
                To: phone.canonical,
                From: twilioFrom.trim(),
                Body: messageText,
            });

            const twilioRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioSid.trim()}/Messages.json`,
                {
                    method: "POST",
                    headers: {
                        Authorization: authHeader,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: bodyParams.toString(),
                }
            );

            const twilioData: any = await twilioRes.json();
            if (twilioRes.ok && twilioData?.sid) {
                console.log(`[Twilio SMS] Verification code dispatched to ${phone.formatted} (SID: ${twilioData.sid})`);
                return {
                    success: true,
                    messageId: twilioData.sid,
                };
            } else {
                console.warn("[Twilio SMS] Error:", twilioData?.message);
                lastProviderError = twilioData?.message || "Twilio dispatch failed";
            }
        } catch (twErr: any) {
            console.error("[Twilio SMS] Dispatch error:", twErr.message);
            lastProviderError = twErr.message;
        }
    }

    // 3. Dev / Test Simulation Fallback
    console.log(`\n======================================================`);
    console.log(`[ORBIX SMS SERVICE] 💬 Verification Code for ${phone.formatted}:`);
    console.log(`>>> SMS OTP: ${otp} <<<`);
    if (lastProviderError) {
        console.log(`⚠️ SMS Provider Notice: ${lastProviderError}`);
    }
    console.log(`======================================================\n`);

    const isDev = process.env.NODE_ENV !== "production";

    return {
        success: true,
        simulated: true,
        devOtp: isDev ? otp : undefined,
        providerError: lastProviderError,
        messageId: `sim_sms_${Date.now()}`,
    };
}
