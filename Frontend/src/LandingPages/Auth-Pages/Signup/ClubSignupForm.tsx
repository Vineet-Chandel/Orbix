import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import {
    formatToE164,
    createRecaptchaVerifier,
    clearRecaptchaVerifier,
    sendFirebasePhoneOtp,
    confirmFirebasePhoneOtp,
    isFirebaseConfigured,
} from "../../../services/phoneAuthService";
import {
    Building2,
    UserCheck,
    Globe,
    Lock,
    ShieldCheck,
    MapPin,
    Mail,
    Smartphone,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    RotateCcw,
    AlertCircle,
    LogIn,
    UserPlus,
} from "lucide-react";
import { FormInput } from "../FormInput";
import { UsernameRulesIndicator } from "../UsernameRulesIndicator";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, useAppSelector, setUser } from "../../../store";
import { NeoSelect } from "../../../components/NeoSelect";
import { CollegeAutocomplete } from "../../../components/CollegeAutocomplete";
import type { InstitutionItem } from "../../../utils/profileApi";

interface ClubSignupFormProps {
    onSwitchToPersonal?: () => void;
}

const CATEGORY_OPTIONS = [
    { value: "coding", label: "Coding and Competitive Programming" },
    { value: "technology", label: "Technology & Software Development" },
    { value: "ai_ml", label: "AI / Machine Learning & Data Science" },
    { value: "robotics", label: "Robotics & Hardware Systems" },
    { value: "entrepreneurship", label: "Entrepreneurship & Innovation" },
    { value: "cultural", label: "Cultural" },
    { value: "sports", label: "Sports" },
    { value: "other", label: "Other" },
];

const ROLE_OPTIONS = [
    "President",
    "Vice President",
    "Secretary",
    "Faculty Coordinator",
    "Lead Developer",
    "Core Member",
    "Other",
];

interface OtpSegmentedInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onComplete?: (code: string) => void;
}

function OtpSegmentedInput({ value, onChange, disabled, onComplete }: OtpSegmentedInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = (value + "      ").slice(0, 6).split("");

    const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const char = e.target.value.replace(/\D/g, "").slice(-1);
        const newDigits = [...digits];
        newDigits[index] = char;
        const nextVal = newDigits.join("").trim();
        onChange(nextVal);

        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
        if (nextVal.length === 6 && onComplete) {
            onComplete(nextVal);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (!digits[index].trim() && index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted) {
            onChange(pasted);
            const nextIdx = Math.min(pasted.length, 5);
            inputRefs.current[nextIdx]?.focus();
            if (pasted.length === 6 && onComplete) {
                onComplete(pasted);
            }
        }
    };

    return (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 max-w-sm mx-auto">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
                <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={1}
                    disabled={disabled}
                    value={digits[idx].trim()}
                    onChange={(e) => handleChange(idx, e)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-black rounded-xl bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:shadow-[3px_3px_0px_#000] focus:outline-none transition-all disabled:opacity-50"
                />
            ))}
        </div>
    );
}

export default function ClubSignupForm({ onSwitchToPersonal: _onSwitchToPersonal }: ClubSignupFormProps = {}) {
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();
    const { user: authUser, isAuthenticated } = useAppSelector((state) => state.user);

    const [formStep, setFormStep] = useState<"details" | "verification">("details");

    const [selectedCollege, setSelectedCollege] = useState<InstitutionItem | null>(null);

    const [formData, setFormData] = useState({
        // Club info
        clubName: "",
        collegeId: "",
        collegeName: "",
        collegeCity: "",
        collegeState: "",
        collegeCountry: "India",
        clubCategory: "coding",
        clubDescription: "",

        // Representative info
        contactPersonName: "",
        contactPersonRole: "President",
        contactEmail: "",
        collegeOfficialEmail: "",
        contactPhone: "",

        // References
        collegeWebsiteUrl: "",
        clubWebsiteUrl: "",
        clubSocialUrl: "",

        // Credentials
        username: "",
        password: "",
        passwordConfirm: "",

        // Legal
        termsAccepted: true,
        privacyPolicyAccepted: true,
    });

    // Auto-populate logged-in user details if user is authenticated with their email account
    useEffect(() => {
        if (isAuthenticated && authUser) {
            const fullName = [authUser.firstName, authUser.lastName].filter(Boolean).join(" ");
            setFormData((prev) => ({
                ...prev,
                contactEmail: prev.contactEmail || authUser.gmail || "",
                contactPersonName: prev.contactPersonName || fullName || "",
                username: prev.username || authUser.username || "",
            }));

            if (authUser.isEmailVerified && authUser.gmail) {
                setEmailVerified(true);
                setVerifiedEmailAddress(authUser.gmail.toLowerCase());
            }
        }
    }, [isAuthenticated, authUser]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [usernameFocused, setUsernameFocused] = useState(false);

    // Verification state
    const [emailOtp, setEmailOtp] = useState("");
    const [phoneOtp, setPhoneOtp] = useState("");
    const [emailVerified, setEmailVerified] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [verifiedEmailAddress, setVerifiedEmailAddress] = useState<string | null>(null);
    const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState<string | null>(null);
    const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);
    const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);

    const [emailCooldown, setEmailCooldown] = useState(0);
    const [phoneCooldown, setPhoneCooldown] = useState(0);

    const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
    const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [verifyingPhone, setVerifyingPhone] = useState(false);

    // Firebase Phone Auth confirmation result and RecaptchaVerifier
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const sendingPhoneOtpRef = useRef(false);
    const [firebaseNotice, setFirebaseNotice] = useState<string | null>(null);

    // Synchronized verification state tied directly to the currently entered email & phone
    const normalizedCurrentEmail = formData.contactEmail.trim().toLowerCase();
    const parsedCurrentPhone = formatToE164(formData.contactPhone.trim());
    const canonicalCurrentPhone = parsedCurrentPhone.isValid ? parsedCurrentPhone.e164 : formData.contactPhone.trim();

    const isCurrentEmailVerified = Boolean(
        emailVerified &&
        emailVerificationToken &&
        verifiedEmailAddress &&
        verifiedEmailAddress === normalizedCurrentEmail
    );

    const isCurrentPhoneVerified = Boolean(
        phoneVerified &&
        phoneVerificationToken &&
        verifiedPhoneNumber &&
        verifiedPhoneNumber === canonicalCurrentPhone
    );

    const isConfiguredTestNumber =
        canonicalCurrentPhone === "+919389205207" ||
        formData.contactPhone.replace(/\D/g, "") === "9389205207";

    // Clean up RecaptchaVerifier instance when component unmounts
    useEffect(() => {
        return () => {
            clearRecaptchaVerifier(recaptchaVerifierRef.current, "firebase-recaptcha-wrapper");
            recaptchaVerifierRef.current = null;
        };
    }, []);

    // Cooldown countdown timers
    useEffect(() => {
        if (emailCooldown <= 0) return;
        const interval = setInterval(() => {
            setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [emailCooldown]);

    useEffect(() => {
        if (phoneCooldown <= 0) return;
        const interval = setInterval(() => {
            setPhoneCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [phoneCooldown]);

    const handleCollegeSelect = (college: InstitutionItem | null) => {
        setSelectedCollege(college);
        if (college) {
            setFormData((prev) => ({
                ...prev,
                collegeId: college.id,
                collegeName: college.officialName,
                collegeCity: college.city || college.district || "",
                collegeState: college.state || "",
                collegeCountry: "India",
                collegeWebsiteUrl: college.website || prev.collegeWebsiteUrl || "",
            }));
            setErrors((prev) => {
                const updated = { ...prev };
                delete updated.collegeName;
                delete updated.collegeId;
                delete updated.collegeCity;
                delete updated.collegeState;
                delete updated.collegeCountry;
                return updated;
            });
        } else {
            setFormData((prev) => ({
                ...prev,
                collegeId: "",
                collegeName: "",
                collegeCity: "",
                collegeState: "",
                collegeCountry: "India",
            }));
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        // Club info validation
        const clubNameTrim = formData.clubName.trim();
        if (!clubNameTrim) {
            newErrors.clubName = "Club name is required";
        } else if (clubNameTrim.length < 2 || clubNameTrim.length > 120) {
            newErrors.clubName = "Must be between 2 and 120 characters";
        }

        if (!selectedCollege || !formData.collegeId) {
            newErrors.collegeName = "Please search and select your institution from the verified directory";
        }

        // Representative info validation
        const contactNameTrim = formData.contactPersonName.trim();
        if (!contactNameTrim) {
            newErrors.contactPersonName = "Representative full name is required";
        } else if (contactNameTrim.length < 2) {
            newErrors.contactPersonName = "Must be at least 2 characters";
        }

        if (!formData.contactPersonRole.trim()) {
            newErrors.contactPersonRole = "Position in club is required";
        }

        const normalizedEmail = formData.contactEmail.trim().toLowerCase();
        if (!normalizedEmail) {
            newErrors.contactEmail = "Account email address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            newErrors.contactEmail = "Please enter a valid email address";
        }

        const rawPhone = formData.contactPhone.trim();
        if (!rawPhone) {
            newErrors.contactPhone = "Primary contact mobile phone number is required";
        } else {
            const digits = rawPhone.replace(/\D/g, "");
            if (digits.length < 10 || digits.length > 15) {
                newErrors.contactPhone = "Please enter a valid 10-digit mobile phone number";
            }
        }

        if (formData.collegeOfficialEmail.trim()) {
            const normalizedOfficial = formData.collegeOfficialEmail.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedOfficial)) {
                newErrors.collegeOfficialEmail = "Please enter a valid official college email";
            }
        }

        // URL format validation
        const urlRegex = /^https?:\/\/.+/i;
        if (formData.collegeWebsiteUrl.trim() && !urlRegex.test(formData.collegeWebsiteUrl.trim())) {
            newErrors.collegeWebsiteUrl = "URL must start with http:// or https://";
        }
        if (formData.clubWebsiteUrl.trim() && !urlRegex.test(formData.clubWebsiteUrl.trim())) {
            newErrors.clubWebsiteUrl = "URL must start with http:// or https://";
        }
        if (formData.clubSocialUrl.trim() && !urlRegex.test(formData.clubSocialUrl.trim())) {
            newErrors.clubSocialUrl = "URL must start with http:// or https://";
        }

        // Username validation
        const normalizedUsername = formData.username.trim().toLowerCase();
        if (!normalizedUsername) {
            newErrors.username = "Username is required";
        } else if (!/^[a-z0-9._-]{3,20}$/.test(normalizedUsername)) {
            newErrors.username = "Must be 3-20 chars: lowercase, numbers, dot, _, or -";
        }

        // Legal acceptance validation
        if (!formData.termsAccepted) {
            newErrors.termsAccepted = "You must accept the Terms of Service";
        }
        if (!formData.privacyPolicyAccepted) {
            newErrors.privacyPolicyAccepted = "You must accept the Privacy Policy";
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        if (!isValid) {
            const firstMsg = Object.values(newErrors)[0];
            if (firstMsg) {
                toast.error(firstMsg, { title: "Validation Error" });
            }
        }
        return isValid;
    };

    // Live Unique Username, Email, and Phone Checker
    const checkAvailability = async (field: "username" | "email" | "phone", value: string): Promise<boolean> => {
        const clean = value.trim();
        if (!clean) return true;
        try {
            let url = `/api/club/check-availability?${field}=${encodeURIComponent(clean)}`;
            if (field === "username" && formData.contactEmail.trim()) {
                url += `&email=${encodeURIComponent(formData.contactEmail.trim().toLowerCase())}`;
            } else if (field === "email" && formData.username.trim()) {
                url += `&username=${encodeURIComponent(formData.username.trim().toLowerCase())}`;
            }
            const res = await fetch(url, {
                credentials: "include",
            });
            const data = await res.json().catch(() => null);
            const errorKey = field === "username" ? "username" : field === "email" ? "contactEmail" : "contactPhone";
            if (data?.success && !data.available) {
                setErrors((prev) => ({
                    ...prev,
                    [errorKey]: data.message,
                }));
                return false;
            } else {
                setErrors((prev) => {
                    const updated = { ...prev };
                    delete updated[errorKey];
                    return updated;
                });
                return true;
            }
        } catch {
            return true;
        }
    };

    // Dispatch Email OTP
    const handleSendEmailOtp = async () => {
        const email = formData.contactEmail.trim().toLowerCase();
        if (!email) return;

        setSendingEmailOtp(true);
        try {
            // Pre-check uniqueness before sending email OTP
            const isAvail = await checkAvailability("email", email);
            if (!isAvail) {
                return;
            }

            const res = await fetch("/api/club/verify/send-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email,
                    name: formData.contactPersonName.trim(),
                    username: formData.username.trim().toLowerCase(),
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to dispatch email verification code.");
            }

            setEmailCooldown(data?.cooldownSeconds || 60);
            toast.success(`Verification code sent to ${email}`, { title: "Email Code Sent" });
        } catch (err: any) {
            toast.error(err.message || "Failed to send email verification code");
        } finally {
            setSendingEmailOtp(false);
        }
    };

    // Dispatch Phone OTP via Firebase Phone Authentication
    const handleSendPhoneOtp = async (isResend = false) => {
        if (sendingPhoneOtpRef.current) return;

        const phone = formData.contactPhone.trim();
        if (!phone) return;

        const parsed = formatToE164(phone);
        if (!parsed.isValid) {
            toast.error("Please enter a valid 10-digit mobile phone number.", { title: "Invalid Phone" });
            return;
        }

        sendingPhoneOtpRef.current = true;
        setSendingPhoneOtp(true);
        try {
            // Pre-check phone uniqueness BEFORE invoking Firebase SMS or sending OTP
            const isAvail = await checkAvailability("phone", parsed.e164);
            if (!isAvail) {
                return;
            }

            if (isFirebaseConfigured()) {
                // For resend, cleanly purge previous verifier and prepare fresh container
                if (isResend) {
                    clearRecaptchaVerifier(recaptchaVerifierRef.current, "firebase-recaptcha-wrapper");
                    recaptchaVerifierRef.current = null;
                }

                recaptchaVerifierRef.current = createRecaptchaVerifier(
                    "firebase-recaptcha-container",
                    () => {
                        toast.error("reCAPTCHA session expired. Please request SMS code again.");
                    },
                    isResend
                );

                const result = await sendFirebasePhoneOtp(parsed.e164, recaptchaVerifierRef.current);
                setConfirmationResult(result.confirmationResult || null);
                setFirebaseNotice(null);
                setPhoneCooldown(60);
                toast.success(result.message, { title: "SMS Code Sent" });
            } else {
                // Dev simulation mode when Firebase env credentials are not configured locally
                const res = await fetch("/api/club/verify/send-phone-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        phone: parsed.e164,
                        clubName: formData.clubName.trim(),
                    }),
                });

                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(data?.message || "Failed to dispatch SMS verification code.");
                }

                setPhoneCooldown(data?.cooldownSeconds || 60);
                toast.success(`SMS verification code dispatched to ${data?.phone || parsed.formatted}`, { title: "SMS Code Sent" });
            }
        } catch (err: any) {
            // Clean up verifier on error so subsequent requests can re-initialize cleanly
            clearRecaptchaVerifier(recaptchaVerifierRef.current, "firebase-recaptcha-wrapper");
            recaptchaVerifierRef.current = null;
            if (
                err?.code === "auth/operation-not-allowed" ||
                err?.code === "auth/billing-not-enabled" ||
                err?.message?.includes("Firebase") ||
                err?.message?.includes("Blaze") ||
                err?.message?.includes("Billing")
            ) {
                setFirebaseNotice(err.message);
            }
            toast.error(err.message || "Failed to send SMS verification code");
        } finally {
            sendingPhoneOtpRef.current = false;
            setSendingPhoneOtp(false);
        }
    };

    // Simulated Dev OTP fallback handler when real carrier SMS cannot be received
    const handleSendSimulatedPhoneOtp = async () => {
        const phone = formData.contactPhone.trim();
        if (!phone) return;

        const parsed = formatToE164(phone);
        if (!parsed.isValid) {
            toast.error("Please enter a valid 10-digit mobile phone number.", { title: "Invalid Phone" });
            return;
        }

        setSendingPhoneOtp(true);
        try {
            const res = await fetch("/api/club/verify/send-phone-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: parsed.e164,
                    clubName: formData.clubName.trim(),
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to dispatch SMS verification code.");
            }

            // Clear Firebase confirmationResult so handleVerifyPhone directly sends OTP code to backend
            setConfirmationResult(null);
            setPhoneCooldown(data?.cooldownSeconds || 60);

            if (data?.devOtp) {
                setPhoneOtp(data.devOtp);
                toast.success(`Simulated OTP code generated: ${data.devOtp}`, { title: "Dev OTP Ready" });
            } else {
                toast.success(`Verification code dispatched to ${data?.phone || parsed.formatted}`, { title: "Code Dispatched" });
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to send simulated verification code");
        } finally {
            setSendingPhoneOtp(false);
        }
    };

    // Transition from details form to verification step
    const handleProceedToVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sendingPhoneOtpRef.current || sendingEmailOtp || formStep === "verification") return;
        if (!validate()) return;

        // Check if current values match verified values
        const emailNorm = formData.contactEmail.trim().toLowerCase();
        const phoneParsed = formatToE164(formData.contactPhone.trim());
        const phoneCanonical = phoneParsed.isValid ? phoneParsed.e164 : formData.contactPhone.trim();

        const isEmailMatch = Boolean(
            emailVerified &&
            (emailVerificationToken || (isAuthenticated && authUser?.isEmailVerified && authUser.gmail?.toLowerCase() === emailNorm)) &&
            verifiedEmailAddress &&
            verifiedEmailAddress === emailNorm
        );

        const isPhoneMatch = Boolean(
            phoneVerified &&
            phoneVerificationToken &&
            verifiedPhoneNumber &&
            verifiedPhoneNumber === phoneCanonical
        );

        setLoading(true);
        try {
            const checks: Promise<boolean>[] = [];
            checks.push(checkAvailability("username", formData.username.trim().toLowerCase()));
            if (!isEmailMatch) {
                checks.push(checkAvailability("email", emailNorm));
            }
            if (!isPhoneMatch) {
                checks.push(checkAvailability("phone", phoneCanonical));
            }

            const results = await Promise.all(checks);
            if (results.some((avail) => avail === false)) {
                toast.error("Please resolve registration conflicts before proceeding.", { title: "Pre-check Failed" });
                return;
            }
        } finally {
            setLoading(false);
        }

        // If email was modified, invalidate previous email verification
        if (!isEmailMatch) {
            setEmailVerified(false);
            setEmailVerificationToken(null);
            setVerifiedEmailAddress(null);
            setEmailOtp("");
        }

        // If phone was modified, invalidate previous phone verification
        if (!isPhoneMatch) {
            setPhoneVerified(false);
            setPhoneVerificationToken(null);
            setVerifiedPhoneNumber(null);
            setPhoneOtp("");
            setConfirmationResult(null);
        }

        setFormStep("verification");
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Trigger OTPs only for the ones that need verification
        if (!isEmailMatch) {
            handleSendEmailOtp();
        }
        if (!isPhoneMatch) {
            handleSendPhoneOtp(false);
        }
    };

    // Verify Email OTP
    const handleVerifyEmail = async (codeToVerify?: string) => {
        const code = (codeToVerify || emailOtp).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit email verification code.");
            return;
        }

        setVerifyingEmail(true);
        try {
            const res = await fetch("/api/club/verify/verify-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.contactEmail.trim().toLowerCase(),
                    otp: code,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Invalid email verification code.");
            }

            setEmailVerified(true);
            setEmailVerificationToken(data.token);
            setVerifiedEmailAddress(formData.contactEmail.trim().toLowerCase());
            toast.success("Primary email verified successfully!", { title: "Email Verified ✓" });
        } catch (err: any) {
            toast.error(err.message || "Email verification failed");
        } finally {
            setVerifyingEmail(false);
        }
    };

    // Verify Phone OTP via Firebase and exchange for server continuation proof token
    const handleVerifyPhone = async (codeToVerify?: string) => {
        const code = (codeToVerify || phoneOtp).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit phone verification code.");
            return;
        }

        const parsed = formatToE164(formData.contactPhone.trim());
        if (!parsed.isValid) {
            toast.error("Invalid phone number format.");
            return;
        }

        setVerifyingPhone(true);
        try {
            let idToken: string | undefined;

            if (confirmationResult) {
                // Confirm 6-digit code with Firebase Web Phone Auth
                const confirmRes = await confirmFirebasePhoneOtp(confirmationResult, code);
                idToken = confirmRes.idToken;
            }

            // Securely transmit to backend for server-side verification and continuation token generation
            const payload: any = { phone: parsed.e164 };
            if (idToken) {
                payload.idToken = idToken;
            } else {
                payload.otp = code;
            }

            const res = await fetch("/api/club/verify/verify-phone-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Invalid SMS verification code.");
            }

            setPhoneVerified(true);
            setPhoneVerificationToken(data.token);
            setVerifiedPhoneNumber(parsed.e164);
            clearRecaptchaVerifier(recaptchaVerifierRef.current, "firebase-recaptcha-wrapper");
            recaptchaVerifierRef.current = null;
            toast.success("Primary phone number verified successfully!", { title: "Phone Verified ✓" });
        } catch (err: any) {
            toast.error(err.message || "Phone verification failed");
        } finally {
            setVerifyingPhone(false);
        }
    };

    // Final Submission after both Email & Phone are verified
    const executeFinalSubmission = async () => {
        if (!isCurrentEmailVerified || !isCurrentPhoneVerified) {
            toast.error("Please verify both your primary email and phone number before submitting.");
            return;
        }

        setLoading(true);

        const payload = {
            clubName: formData.clubName.trim(),
            collegeId: selectedCollege?.id || undefined,
            collegeName: (selectedCollege?.officialName || formData.collegeName).trim(),
            collegeCity: (selectedCollege?.city || selectedCollege?.district || formData.collegeCity).trim(),
            collegeState: (selectedCollege?.state || formData.collegeState).trim(),
            collegeCountry: "India",
            clubCategory: formData.clubCategory,
            clubDescription: formData.clubDescription.trim() || undefined,

            contactPersonName: formData.contactPersonName.trim(),
            contactPersonRole: formData.contactPersonRole.trim(),
            contactEmail: formData.contactEmail.trim().toLowerCase(),
            collegeOfficialEmail: formData.collegeOfficialEmail.trim().toLowerCase() || undefined,
            contactPhone: formData.contactPhone.trim(),

            collegeWebsiteUrl: formData.collegeWebsiteUrl.trim() || undefined,
            clubWebsiteUrl: formData.clubWebsiteUrl.trim() || undefined,
            clubSocialUrl: formData.clubSocialUrl.trim() || undefined,

            username: formData.username.trim().toLowerCase(),

            emailVerificationToken: emailVerificationToken || undefined,
            phoneVerificationToken: phoneVerificationToken || undefined,

            termsAccepted: formData.termsAccepted,
            privacyPolicyAccepted: formData.privacyPolicyAccepted,
        };

        try {
            const endpoints = ["http://localhost:3000/api/club/register", "/api/club/register"];
            let response: Response | null = null;
            let resultData: any = null;

            const token = localStorage.getItem("orbix_token");
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers,
                        credentials: "include",
                        body: JSON.stringify(payload),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response) {
                throw new Error("Unable to connect to the authentication server. Please check backend status.");
            }

            if (!response.ok) {
                await toast.handleError(response, resultData?.message || "Registration failed. Please check your information.");
                return;
            }

            if (resultData?.token) {
                try {
                    localStorage.setItem("orbix_token", resultData.token);
                } catch {
                    // ignore quota errors
                }
            }

            const clubUser = resultData?.user || {
                username: payload.username,
                firstName: payload.contactPersonName,
                lastName: "Representative",
                gmail: payload.contactEmail,
                accountType: "club",
            };

            dispatch(setUser(clubUser));

            toast.success("Contact verified & club application received successfully!", {
                title: "Application Received ✓",
            });

            // Redirect immediately to standalone club application-status page
            navigate("/club/status");
        } catch (err: any) {
            console.error("Club signup error:", err);
            await toast.handleError(err, "An unexpected error occurred during registration.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={formStep === "details" ? handleProceedToVerification : (e) => { e.preventDefault(); executeFinalSubmission(); }} className="space-y-6" noValidate>
            {formStep === "details" ? (
                <>
                    {/* Signed-in user account & club status banner */}
                    {isAuthenticated && authUser && (
                        <div className="mb-2">
                            {authUser.verifiedClub ? (
                                <div className="p-4 sm:p-5 rounded-3xl bg-[#E8F5E9] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="w-7 h-7 text-emerald-700 shrink-0" />
                                        <div>
                                            <h4 className="font-black text-black text-sm">You Hold a Verified Club</h4>
                                            <p className="text-xs font-semibold text-neutral-700">
                                                You are the verified administrator for <strong>{authUser.verifiedClub.name}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/club/dashboard")}
                                        className="px-4 py-2 font-black text-xs uppercase tracking-wider bg-black text-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-all cursor-pointer whitespace-nowrap"
                                    >
                                        Go to Dashboard →
                                    </button>
                                </div>
                            ) : authUser.application || (authUser.clubStatus && authUser.clubStatus !== "none" && authUser.clubStatus !== "rejected") ? (
                                <div className="p-4 sm:p-5 rounded-3xl bg-[#FFF8E1] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="w-7 h-7 text-amber-700 shrink-0" />
                                        <div>
                                            <h4 className="font-black text-black text-sm">Active Club Application Pending</h4>
                                            <p className="text-xs font-semibold text-neutral-700">
                                                Application for <strong>"{authUser.clubName || authUser.application?.clubName || 'Your Club'}"</strong> is currently <strong>{authUser.clubStatus || authUser.application?.status || 'under review'}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/club/status")}
                                        className="px-4 py-2 font-black text-xs uppercase tracking-wider bg-[#FFAE96] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FF9B80] transition-all cursor-pointer whitespace-nowrap"
                                    >
                                        Track Progress →
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 sm:p-5 rounded-3xl bg-[#FEF08A] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden bg-white shrink-0">
                                            <img
                                                src={authUser.avatarUrl || "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png"}
                                                alt="Avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase text-black flex items-center gap-1.5 flex-wrap">
                                                <span>Submitting as: {authUser.firstName} {authUser.lastName}</span>
                                                <span className="bg-black text-[#FEF08A] text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                                                    @{authUser.username}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-semibold text-neutral-800 mt-0.5">
                                                Verified Personal Account (<span className="font-mono">{authUser.gmail}</span>) • Linked as initial Club Registrar
                                            </p>
                                        </div>
                                    </div>
                                    <div className="self-start sm:self-center px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl border border-black shrink-0 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-[#FEF08A]" />
                                        Personal Link Active
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isAuthenticated && (
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#FEF08A] border-2 border-black shadow-[5px_5px_0px_#000] space-y-3.5 mb-2">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-black text-[#FEF08A] flex items-center justify-center shrink-0 border-2 border-black">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black uppercase text-black">
                                        Personal Account Required to Register a Club
                                    </h3>
                                    <p className="text-xs font-semibold text-neutral-800 mt-1 leading-relaxed">
                                        Orbix uses real personal accounts to verify club registrar leadership. Please sign in to your personal account or register one first. Your personal account will automatically become the initial Club Registrar.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => navigate("/auth/signin?redirect=/auth/signup?tab=club")}
                                    className="flex-1 py-2.5 px-4 bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <LogIn className="w-4 h-4" />
                                    Sign In to Personal Account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (_onSwitchToPersonal) {
                                            _onSwitchToPersonal();
                                        } else {
                                            navigate("/auth/signup?tab=personal");
                                        }
                                    }}
                                    className="flex-1 py-2.5 px-4 bg-white text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE] transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Create Personal Account
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECTION A: CLUB INFORMATION */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                            <Building2 className="w-4 h-4 text-black" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                1. Club & Institution Information
                            </h3>
                        </div>

                        {/* Club Name */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Club Name *
                            </label>
                            <FormInput
                                name="clubName"
                                type="text"
                                placeholder="Club Name (e.g. Google Developer Student Club)"
                                hideLabel
                                value={formData.clubName}
                                onChange={(e) => {
                                    setFormData({ ...formData, clubName: e.target.value });
                                    if (errors.clubName) setErrors({ ...errors, clubName: "" });
                                }}
                                error={errors.clubName}
                            />
                        </div>

                        {/* Verified College / University Selector */}
                        <div className="pb-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                College / University (Verified Directory) *
                            </label>
                            <CollegeAutocomplete
                                value={selectedCollege?.id}
                                selectedCollege={selectedCollege}
                                onChange={handleCollegeSelect}
                                canChangeCollege={true}
                                showChangeWarningModal={false}
                                placeholder="Search verified Indian colleges, IITs, NITs, universities..."
                            />
                            {errors.collegeName && (
                                <p className="text-[11px] font-bold text-rose-600 mt-1">{errors.collegeName}</p>
                            )}
                        </div>

                        {/* Auto-filled Verified Location Badges (Locked & Authoritative) */}
                        {selectedCollege && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5 animate-in fade-in duration-200">
                                <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1 mb-0.5">
                                        <MapPin className="w-3 h-3 text-neutral-700" />
                                        City (Auto-filled)
                                    </span>
                                    <p className="text-xs font-black text-black truncate">
                                        {formData.collegeCity || "N/A"}
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1 mb-0.5">
                                        <MapPin className="w-3 h-3 text-neutral-700" />
                                        State / UT (Auto-filled)
                                    </span>
                                    <p className="text-xs font-black text-black truncate">
                                        {formData.collegeState || "N/A"}
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1 mb-0.5">
                                        <Lock className="w-3 h-3 text-neutral-700" />
                                        Country
                                    </span>
                                    <p className="text-xs font-black text-black truncate">
                                        {formData.collegeCountry || "India"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Club Category Dropdown */}
                        <NeoSelect
                            label="Club Category"
                            value={formData.clubCategory}
                            onChange={(val) => setFormData({ ...formData, clubCategory: val })}
                            options={CATEGORY_OPTIONS}
                        />

                        {/* Club Description */}
                        <div>
                            <textarea
                                rows={2}
                                placeholder="Short description of your club's purpose and activities (optional)"
                                value={formData.clubDescription}
                                onChange={(e) => setFormData({ ...formData, clubDescription: e.target.value })}
                                className="w-full p-3 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black placeholder:text-neutral-500 shadow-[2px_2px_0px_#000] focus:outline-none focus:bg-white resize-none"
                            />
                        </div>
                    </div>

                    {/* SECTION B: REPRESENTATIVE DETAILS */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                            <UserCheck className="w-4 h-4 text-black" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                2. Representative Details
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Representative Full Name *
                                </label>
                                <FormInput
                                    name="contactPersonName"
                                    type="text"
                                    placeholder="Representative's Full Name"
                                    hideLabel
                                    value={formData.contactPersonName}
                                    onChange={(e) => {
                                        setFormData({ ...formData, contactPersonName: e.target.value });
                                        if (errors.contactPersonName) setErrors({ ...errors, contactPersonName: "" });
                                    }}
                                    error={errors.contactPersonName}
                                    autoComplete="name"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Position / Role in Club *
                                </label>
                                <NeoSelect
                                    value={formData.contactPersonRole}
                                    onChange={(val) => setFormData({ ...formData, contactPersonRole: val })}
                                    options={ROLE_OPTIONS.map((r) => ({
                                        value: r,
                                        label: `Role: ${r}`,
                                    }))}
                                />
                            </div>
                        </div>

                        {/* Primary Account Email */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Primary Contact & Account Email *
                                </label>
                                {isCurrentEmailVerified ? (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-black flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                        <span>Verified</span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-black">
                                        Primary Verification Target
                                    </span>
                                )}
                            </div>
                            <FormInput
                                name="contactEmail"
                                type="email"
                                placeholder="e.g. leader@college.edu or name@gmail.com"
                                hideLabel
                                value={formData.contactEmail}
                                onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setFormData((prev) => ({ ...prev, contactEmail: nextVal }));
                                    if (errors.contactEmail) setErrors((prev) => ({ ...prev, contactEmail: "" }));
                                    // Invalidate verified email state if user changes the address
                                    if (verifiedEmailAddress && nextVal.trim().toLowerCase() !== verifiedEmailAddress) {
                                        setEmailVerified(false);
                                        setEmailVerificationToken(null);
                                        setVerifiedEmailAddress(null);
                                        setEmailOtp("");
                                    }
                                }}
                                onBlur={() => {
                                    if (formData.contactEmail.trim()) {
                                        checkAvailability("email", formData.contactEmail);
                                        if (formData.username.trim() && errors.username) {
                                            checkAvailability("username", formData.username);
                                        }
                                    }
                                }}
                                error={errors.contactEmail}
                                autoComplete="email"
                            />
                            <p className="text-[10px] text-neutral-500 font-semibold mt-1">
                                A 6-digit one-time code will be dispatched to verify ownership.
                            </p>
                        </div>

                        {/* Primary Contact Phone */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Primary Contact Mobile Phone Number *
                                </label>
                                {isCurrentPhoneVerified ? (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-black flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                        <span>Verified</span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-black">
                                        Primary Verification Target
                                    </span>
                                )}
                            </div>
                            <FormInput
                                name="contactPhone"
                                type="tel"
                                placeholder="e.g. 9389205207 or +91 93892 05207"
                                hideLabel
                                value={formData.contactPhone}
                                onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setFormData((prev) => ({ ...prev, contactPhone: nextVal }));
                                    if (errors.contactPhone) setErrors((prev) => ({ ...prev, contactPhone: "" }));
                                    // Invalidate verified phone state if user changes the phone number
                                    const parsed = formatToE164(nextVal.trim());
                                    const canonical = parsed.isValid ? parsed.e164 : nextVal.trim();
                                    if (verifiedPhoneNumber && canonical !== verifiedPhoneNumber) {
                                        setPhoneVerified(false);
                                        setPhoneVerificationToken(null);
                                        setVerifiedPhoneNumber(null);
                                        setPhoneOtp("");
                                        setConfirmationResult(null);
                                    }
                                }}
                                onBlur={() => {
                                    if (formData.contactPhone.trim()) {
                                        const parsed = formatToE164(formData.contactPhone.trim());
                                        const canonical = parsed.isValid ? parsed.e164 : formData.contactPhone.trim();
                                        checkAvailability("phone", canonical);
                                    }
                                }}
                                error={errors.contactPhone}
                                autoComplete="tel"
                            />
                            <p className="text-[10px] text-neutral-500 font-semibold mt-1">
                                A 6-digit one-time SMS code will be dispatched to verify this phone number.
                            </p>
                        </div>

                        {/* Official College Email (Optional) */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Official College Email (Optional)
                            </label>
                            <FormInput
                                name="collegeOfficialEmail"
                                type="email"
                                placeholder="Official College Email (optional)"
                                hideLabel
                                value={formData.collegeOfficialEmail}
                                onChange={(e) => {
                                    setFormData({ ...formData, collegeOfficialEmail: e.target.value });
                                    if (errors.collegeOfficialEmail) setErrors({ ...errors, collegeOfficialEmail: "" });
                                }}
                                error={errors.collegeOfficialEmail}
                            />
                        </div>
                    </div>

                    {/* SECTION C: VERIFICATION REFERENCES */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                            <Globe className="w-4 h-4 text-black" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                3. Verification References (Optional)
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <FormInput
                                name="collegeWebsiteUrl"
                                type="url"
                                placeholder="College Website (e.g. https://college.edu.in)"
                                hideLabel
                                value={formData.collegeWebsiteUrl}
                                onChange={(e) => {
                                    setFormData({ ...formData, collegeWebsiteUrl: e.target.value });
                                    if (errors.collegeWebsiteUrl) setErrors({ ...errors, collegeWebsiteUrl: "" });
                                }}
                                error={errors.collegeWebsiteUrl}
                            />

                            <FormInput
                                name="clubWebsiteUrl"
                                type="url"
                                placeholder="Club Website (e.g. https://gdsc-college.dev)"
                                hideLabel
                                value={formData.clubWebsiteUrl}
                                onChange={(e) => {
                                    setFormData({ ...formData, clubWebsiteUrl: e.target.value });
                                    if (errors.clubWebsiteUrl) setErrors({ ...errors, clubWebsiteUrl: "" });
                                }}
                                error={errors.clubWebsiteUrl}
                            />
                        </div>

                        <FormInput
                            name="clubSocialUrl"
                            type="url"
                            placeholder="Official Social Profile or Directory Listing URL"
                            hideLabel
                            value={formData.clubSocialUrl}
                            onChange={(e) => {
                                setFormData({ ...formData, clubSocialUrl: e.target.value });
                                if (errors.clubSocialUrl) setErrors({ ...errors, clubSocialUrl: "" });
                            }}
                            error={errors.clubSocialUrl}
                        />
                    </div>

                    {/* SECTION D: ACCOUNT CREDENTIALS */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                            <Lock className="w-4 h-4 text-black" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                4. Account Credentials
                            </h3>
                        </div>

                        {/* Username Input with live rules indicator and public URL preview */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Club Username *
                                </label>
                                <span className="text-[10px] font-mono font-bold text-neutral-600 bg-[#FAF6EE] px-2 py-0.5 rounded-full border border-black/40">
                                    /clubs/{formData.username || "<club-username>"}
                                </span>
                            </div>
                            <FormInput
                                name="username"
                                type="text"
                                placeholder="Unique Club Username (e.g. gdsc_cu)"
                                hideLabel
                                value={formData.username}
                                onChange={(e) => {
                                    setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, "_") });
                                    if (errors.username) setErrors({ ...errors, username: "" });
                                }}
                                onFocus={() => setUsernameFocused(true)}
                                onBlur={() => {
                                    setUsernameFocused(false);
                                    if (formData.username.trim()) {
                                        checkAvailability("username", formData.username);
                                    }
                                }}
                                error={errors.username}
                                autoComplete="username"
                            />

                            <p className="text-[10px] text-neutral-500 font-semibold mt-1">
                                Your unique club handle powers your public profile URL: <span className="font-mono font-bold text-black">/clubs/{formData.username || "<club-username>"}</span>
                            </p>

                            <UsernameRulesIndicator
                                username={formData.username}
                                hasInput={formData.username.length > 0}
                                isFocused={usernameFocused}
                            />
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black/20 flex items-center gap-3">
                            <Lock className="w-5 h-5 text-neutral-600 shrink-0" />
                            <p className="text-xs font-semibold text-neutral-700">
                                {isAuthenticated ? (
                                    <>Linked to your personal Orbix account (<span className="font-bold text-black">{authUser?.gmail}</span>). As a security best practice, clubs never maintain separate personal login passwords.</>
                                ) : (
                                    <>Club registration links directly to your personal Orbix account. You will log in using your personal account credentials.</>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* SECTION E: LEGAL CONSENT */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2.5">
                        <div className="space-y-2 pt-1">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={formData.termsAccepted}
                                    onChange={(e) => {
                                        setFormData({ ...formData, termsAccepted: e.target.checked });
                                        if (errors.termsAccepted) setErrors({ ...errors, termsAccepted: "" });
                                    }}
                                    className="mt-0.5 h-4 w-4 rounded border-2 border-black text-black cursor-pointer accent-black shadow-[1px_1px_0px_#000] focus:ring-0"
                                />
                                <span className="leading-snug font-medium">
                                    I accept the{" "}
                                    <a href="#terms" className="font-bold text-black underline underline-offset-2 hover:text-emerald-700">
                                        Terms of Service
                                    </a>
                                    .
                                </span>
                            </label>

                            <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={formData.privacyPolicyAccepted}
                                    onChange={(e) => {
                                        setFormData({ ...formData, privacyPolicyAccepted: e.target.checked });
                                        if (errors.privacyPolicyAccepted) setErrors({ ...errors, privacyPolicyAccepted: "" });
                                    }}
                                    className="mt-0.5 h-4 w-4 rounded border-2 border-black text-black cursor-pointer accent-black shadow-[1px_1px_0px_#000] focus:ring-0"
                                />
                                <span className="leading-snug font-medium">
                                    I accept the{" "}
                                    <a href="#privacy" className="font-bold text-black underline underline-offset-2 hover:text-emerald-700">
                                        Privacy Policy
                                    </a>
                                    .
                                </span>
                            </label>
                        </div>
                        {errors.termsAccepted && (
                            <p className="text-xs font-bold text-rose-600 px-1">{errors.termsAccepted}</p>
                        )}
                        {errors.privacyPolicyAccepted && (
                            <p className="text-xs font-bold text-rose-600 px-1">{errors.privacyPolicyAccepted}</p>
                        )}
                    </div>

                    {/* Proceed Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!formData.termsAccepted || !formData.privacyPolicyAccepted}
                            className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <span className="inline-flex items-center gap-2">
                                <span>Continue to Contact Verification</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </span>
                        </button>
                    </div>
                </>
            ) : (
                /* STEP 2: EMAIL & PHONE VERIFICATION VIEW (ON SAME PAGE) */
                <div className="space-y-5 animate-in fade-in slide-in-from-right duration-250">
                    {/* Stepper Navigation */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-black">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span className="hidden sm:inline">1. Application Details</span>
                                <span className="sm:hidden">1. Details</span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span className="hidden sm:inline">2. Contact Verification</span>
                                <span className="sm:hidden">2. Verify</span>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setFormStep("details")}
                            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Edit Details</span>
                        </button>
                    </div>

                    {/* Two-Factor Guidance Banner */}
                    <div className="p-4 rounded-2xl bg-[#FFE566]/25 border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Mandatory Two-Factor Contact Verification
                            </h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-semibold leading-relaxed">
                            To ensure authentic student community leadership, verify both your primary email address and your primary mobile number. Both codes must be verified to complete submission.
                        </p>
                    </div>

                    {/* CARD 1: PRIMARY EMAIL VERIFICATION */}
                    <div className={`p-4 sm:p-5 rounded-3xl border-2 border-black shadow-[4px_4px_0px_#000] transition-all space-y-3.5 ${
                        isCurrentEmailVerified ? "bg-[#a2ff86]/15 border-black" : "bg-white"
                    }`}>
                        <div className="flex items-center justify-between pb-2.5 border-b-2 border-black/10 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[1px_1px_0px_#000] flex-shrink-0">
                                    <Mail className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Primary Email Verification
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-black truncate block">
                                        {formData.contactEmail}
                                    </span>
                                </div>
                            </div>

                            {isCurrentEmailVerified ? (
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Email Verified</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFormStep("details")}
                                        className="text-[11px] font-black text-neutral-600 hover:text-black underline underline-offset-2 cursor-pointer"
                                    >
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-black text-[10px] font-black text-amber-900">
                                    <span>Awaiting Code</span>
                                </span>
                            )}
                        </div>

                        {!isCurrentEmailVerified ? (
                            <div className="space-y-3 pt-1">
                                <p className="text-xs text-neutral-600 font-semibold text-center">
                                    Enter the 6-digit verification code sent to <strong className="text-black">{formData.contactEmail}</strong>
                                </p>

                                <OtpSegmentedInput
                                    value={emailOtp}
                                    onChange={(val) => setEmailOtp(val)}
                                    disabled={verifyingEmail}
                                    onComplete={(code) => handleVerifyEmail(code)}
                                />

                                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={emailCooldown > 0 || sendingEmailOtp}
                                        onClick={handleSendEmailOtp}
                                        className="text-xs font-black text-black underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                                    >
                                        <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${sendingEmailOtp ? "animate-spin" : ""}`} />
                                        <span>{emailCooldown > 0 ? `Resend email code (${emailCooldown}s)` : "Resend Email Code"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={emailOtp.length !== 6 || verifyingEmail}
                                        onClick={() => handleVerifyEmail(emailOtp)}
                                        className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                                    >
                                        {verifyingEmail ? "Verifying..." : "Verify Email"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-bold text-emerald-900">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 stroke-[2.5]" />
                                <span>Primary email address authenticated cryptographically.</span>
                            </div>
                        )}
                    </div>

                    {/* CARD 2: PRIMARY MOBILE PHONE VERIFICATION */}
                    <div className={`p-4 sm:p-5 rounded-3xl border-2 border-black shadow-[4px_4px_0px_#000] transition-all space-y-3.5 ${
                        isCurrentPhoneVerified ? "bg-[#a2ff86]/15 border-black" : "bg-white"
                    }`}>
                        <div className="flex items-center justify-between pb-2.5 border-b-2 border-black/10 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[1px_1px_0px_#000] flex-shrink-0">
                                    <Smartphone className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Primary Mobile Phone Verification
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-black truncate block">
                                        {formData.contactPhone}
                                    </span>
                                </div>
                            </div>

                            {isCurrentPhoneVerified ? (
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Phone Verified</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFormStep("details")}
                                        className="text-[11px] font-black text-neutral-600 hover:text-black underline underline-offset-2 cursor-pointer"
                                    >
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-black text-[10px] font-black text-amber-900">
                                    <span>Awaiting SMS Code</span>
                                </span>
                            )}
                        </div>

                        {!isCurrentPhoneVerified ? (
                            <div className="space-y-3 pt-1">
                                <p className="text-xs text-neutral-600 font-semibold text-center">
                                    Enter the 6-digit SMS code dispatched to <strong className="text-black">{formData.contactPhone}</strong>
                                </p>

                                {isConfiguredTestNumber && (
                                    <div className="p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-500 text-left space-y-2 shadow-[2px_2px_0px_#0284c7]">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 text-xs font-black text-sky-950">
                                                <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                                                <span>Firebase Test Number Active (+91 93892 05207)</span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={sendingPhoneOtp || verifyingPhone}
                                                onClick={() => {
                                                    setPhoneOtp("123456");
                                                    handleVerifyPhone("123456");
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black shadow-[1px_1px_0px_#000] cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Fill 123456 & Verify
                                            </button>
                                        </div>
                                        <p className="text-[11px] font-medium text-sky-900 leading-relaxed">
                                            By Firebase security design, numbers configured in <em>&quot;Phone numbers for testing&quot;</em> <strong>never receive carrier SMS messages</strong> on their physical SIM. Enter preconfigured code <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-300 text-sky-950">123456</code> to verify instantly.
                                        </p>
                                    </div>
                                )}

                                {firebaseNotice && (
                                    <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-500 text-left space-y-2 shadow-[2px_2px_0px_#d97706]">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                            <span>Firebase SMS Dispatch Notice</span>
                                        </div>
                                        <p className="text-[11px] font-medium text-amber-900 leading-relaxed">
                                            {firebaseNotice}
                                        </p>
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={handleSendSimulatedPhoneOtp}
                                                className="px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-amber-300 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-all"
                                            >
                                                Switch to Simulated Dev OTP (Bypasses Carrier SMS)
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <OtpSegmentedInput
                                    value={phoneOtp}
                                    onChange={(val) => setPhoneOtp(val)}
                                    disabled={verifyingPhone}
                                    onComplete={(code) => handleVerifyPhone(code)}
                                />

                                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                        <button
                                            type="button"
                                            disabled={phoneCooldown > 0 || sendingPhoneOtp}
                                            onClick={() => handleSendPhoneOtp(true)}
                                            className="text-xs font-black text-black underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                                        >
                                            <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${sendingPhoneOtp ? "animate-spin" : ""}`} />
                                            <span>{phoneCooldown > 0 ? `Resend SMS (${phoneCooldown}s)` : "Resend SMS"}</span>
                                        </button>

                                        <span className="text-neutral-300 hidden sm:inline">|</span>

                                        <button
                                            type="button"
                                            disabled={sendingPhoneOtp}
                                            onClick={handleSendSimulatedPhoneOtp}
                                            className="text-xs font-bold text-neutral-600 hover:text-black underline underline-offset-2 cursor-pointer"
                                        >
                                            Use Simulated Dev OTP
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={phoneOtp.length !== 6 || verifyingPhone}
                                        onClick={() => handleVerifyPhone(phoneOtp)}
                                        className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                                    >
                                        {verifyingPhone ? "Verifying..." : "Verify Phone"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-bold text-emerald-900">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 stroke-[2.5]" />
                                <span>Mobile phone number authenticated cryptographically via SMS OTP.</span>
                            </div>
                        )}
                    </div>

                    {/* Final Submission Button */}
                    <div className="pt-2 space-y-3">
                        <button
                            type="button"
                            disabled={!isCurrentEmailVerified || !isCurrentPhoneVerified || loading}
                            onClick={executeFinalSubmission}
                            className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span>Submitting Verified Club Application...</span>
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    <span>
                                        {isCurrentEmailVerified && isCurrentPhoneVerified
                                            ? "Submit Verified Club Application"
                                            : `Verify both email & phone to submit (${(isCurrentEmailVerified ? 1 : 0) + (isCurrentPhoneVerified ? 1 : 0)}/2 verified)`}
                                    </span>
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Persistent container wrapper for Firebase Phone Auth reCAPTCHA */}
            <div id="firebase-recaptcha-wrapper" className="flex justify-center my-1">
                <div id="firebase-recaptcha-container"></div>
            </div>
        </form>
    );
}
