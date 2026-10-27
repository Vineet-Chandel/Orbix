import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Building2,
    UserCheck,
    Globe,
    Lock,
    ShieldCheck,
} from "lucide-react";
import { FormInput } from "../FormInput";
import { PasswordStrengthIndicator } from "../PasswordStrengthIndicator";
import { UsernameRulesIndicator } from "../UsernameRulesIndicator";
import { evaluatePassword } from "../passwordValidator";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, setUser } from "../../../store";
import { NeoSelect } from "../../../components/NeoSelect";

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

export default function ClubSignupForm({ onSwitchToPersonal: _onSwitchToPersonal }: ClubSignupFormProps = {}) {
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState({
        // Club info
        clubName: "",
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

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [usernameFocused, setUsernameFocused] = useState(false);

    const passwordStrength = evaluatePassword(formData.password);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        // Club info validation
        const clubNameTrim = formData.clubName.trim();
        if (!clubNameTrim) {
            newErrors.clubName = "Club name is required";
        } else if (clubNameTrim.length < 2 || clubNameTrim.length > 120) {
            newErrors.clubName = "Must be between 2 and 120 characters";
        }

        const collegeNameTrim = formData.collegeName.trim();
        if (!collegeNameTrim) {
            newErrors.collegeName = "College / University name is required";
        } else if (collegeNameTrim.length < 2 || collegeNameTrim.length > 200) {
            newErrors.collegeName = "Must be between 2 and 200 characters";
        }

        if (!formData.collegeCity.trim()) {
            newErrors.collegeCity = "City is required";
        }
        if (!formData.collegeState.trim()) {
            newErrors.collegeState = "State / region is required";
        }
        if (!formData.collegeCountry.trim()) {
            newErrors.collegeCountry = "Country is required";
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

        // Password validation
        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (!passwordStrength.isValid) {
            newErrors.password = "Please satisfy all password conditions below";
        }

        // Password confirmation validation
        if (formData.password !== formData.passwordConfirm) {
            newErrors.passwordConfirm = "Passwords do not match";
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);

        const payload = {
            clubName: formData.clubName.trim(),
            collegeName: formData.collegeName.trim(),
            collegeCity: formData.collegeCity.trim(),
            collegeState: formData.collegeState.trim(),
            collegeCountry: formData.collegeCountry.trim(),
            clubCategory: formData.clubCategory,
            clubDescription: formData.clubDescription.trim() || undefined,

            contactPersonName: formData.contactPersonName.trim(),
            contactPersonRole: formData.contactPersonRole.trim(),
            contactEmail: formData.contactEmail.trim().toLowerCase(),
            collegeOfficialEmail: formData.collegeOfficialEmail.trim().toLowerCase() || undefined,
            contactPhone: formData.contactPhone.trim() || undefined,

            collegeWebsiteUrl: formData.collegeWebsiteUrl.trim() || undefined,
            clubWebsiteUrl: formData.clubWebsiteUrl.trim() || undefined,
            clubSocialUrl: formData.clubSocialUrl.trim() || undefined,

            username: formData.username.trim().toLowerCase(),
            password: formData.password,

            termsAccepted: formData.termsAccepted,
            privacyPolicyAccepted: formData.privacyPolicyAccepted,
        };

        try {
            const endpoints = ["http://localhost:3000/api/club/register", "/api/club/register"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
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

            toast.success("Club application submitted for verification successfully!", {
                title: "Application Received",
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
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* SECTION A: CLUB INFORMATION */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                    <Building2 className="w-4 h-4 text-black" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-black">
                        1. Club & Institution Information
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                    <FormInput
                        name="collegeName"
                        type="text"
                        placeholder="College / University Name (Full Official Name)"
                        hideLabel
                        value={formData.collegeName}
                        onChange={(e) => {
                            setFormData({ ...formData, collegeName: e.target.value });
                            if (errors.collegeName) setErrors({ ...errors, collegeName: "" });
                        }}
                        error={errors.collegeName}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <FormInput
                        name="collegeCity"
                        type="text"
                        placeholder="City"
                        hideLabel
                        value={formData.collegeCity}
                        onChange={(e) => {
                            setFormData({ ...formData, collegeCity: e.target.value });
                            if (errors.collegeCity) setErrors({ ...errors, collegeCity: "" });
                        }}
                        error={errors.collegeCity}
                    />

                    <FormInput
                        name="collegeState"
                        type="text"
                        placeholder="State / Region"
                        hideLabel
                        value={formData.collegeState}
                        onChange={(e) => {
                            setFormData({ ...formData, collegeState: e.target.value });
                            if (errors.collegeState) setErrors({ ...errors, collegeState: "" });
                        }}
                        error={errors.collegeState}
                    />

                    <FormInput
                        name="collegeCountry"
                        type="text"
                        placeholder="Country (Default: India)"
                        hideLabel
                        value={formData.collegeCountry}
                        onChange={(e) => {
                            setFormData({ ...formData, collegeCountry: e.target.value });
                            if (errors.collegeCountry) setErrors({ ...errors, collegeCountry: "" });
                        }}
                        error={errors.collegeCountry}
                    />
                </div>

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

            {/* SECTION B: REPRESENTATIVE INFORMATION */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2.5 mb-1">
                    <UserCheck className="w-4 h-4 text-black" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-black">
                        2. Representative Details
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                    <div>
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

                {/* Account Email (Primary authentication login address) */}
                <FormInput
                    name="contactEmail"
                    type="email"
                    placeholder="Primary Contact & Account Email"
                    hideLabel
                    value={formData.contactEmail}
                    onChange={(e) => {
                        setFormData({ ...formData, contactEmail: e.target.value });
                        if (errors.contactEmail) setErrors({ ...errors, contactEmail: "" });
                    }}
                    error={errors.contactEmail}
                    autoComplete="email"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                    <FormInput
                        name="contactPhone"
                        type="tel"
                        placeholder="Phone Number (optional)"
                        hideLabel
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        error={errors.contactPhone}
                        autoComplete="tel"
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

                {/* Username Input with live rules indicator */}
                <div>
                    <FormInput
                        name="username"
                        type="text"
                        placeholder="Representative Username"
                        hideLabel
                        value={formData.username}
                        onChange={(e) => {
                            setFormData({ ...formData, username: e.target.value.toLowerCase() });
                            if (errors.username) setErrors({ ...errors, username: "" });
                        }}
                        onFocus={() => setUsernameFocused(true)}
                        onBlur={() => setUsernameFocused(false)}
                        error={errors.username}
                        autoComplete="username"
                    />

                    <UsernameRulesIndicator
                        username={formData.username}
                        hasInput={formData.username.length > 0}
                        isFocused={usernameFocused}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
                    {/* Password Input */}
                    <div>
                        <FormInput
                            name="password"
                            isPassword
                            placeholder="Password"
                            hideLabel
                            value={formData.password}
                            onChange={(e) => {
                                setFormData({ ...formData, password: e.target.value });
                                if (errors.password) setErrors({ ...errors, password: "" });
                            }}
                            error={errors.password}
                            autoComplete="new-password"
                        />

                        {/* Interactive Password Strength Indicator */}
                        <PasswordStrengthIndicator
                            result={passwordStrength}
                            hasInput={formData.password.length > 0}
                        />
                    </div>

                    {/* Password Confirmation */}
                    <div>
                        <FormInput
                            name="passwordConfirm"
                            isPassword
                            placeholder="Confirm Password"
                            hideLabel
                            value={formData.passwordConfirm}
                            onChange={(e) => {
                                setFormData({ ...formData, passwordConfirm: e.target.value });
                                if (errors.passwordConfirm) setErrors({ ...errors, passwordConfirm: "" });
                            }}
                            error={errors.passwordConfirm}
                            autoComplete="new-password"
                        />
                    </div>
                </div>
            </div>

            {/* SECTION E: LEGAL ACCEPTANCE */}
            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Submission Actions */}
            <div className="pt-2 space-y-3">
                <button
                    type="submit"
                    disabled={loading || !formData.termsAccepted || !formData.privacyPolicyAccepted}
                    className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Submitting Club Application...</span>
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <span>Submit Club for Verification</span>
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
}
