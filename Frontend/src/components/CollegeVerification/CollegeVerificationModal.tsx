import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    GraduationCap,
    UploadCloud,
        CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ShieldCheck,
    X,
    Sparkles,
    Mail,
    Phone,
    ArrowRight,
    ArrowLeft,
    RotateCcw,
    Check,
    RefreshCw,
    } from "lucide-react";
import { OrbixButton } from "../OrbixButton";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { useToast } from "../../context/ToastContext";
import { ORBIX_COLLEGE_VERIFICATION_UPDATED_EVENT } from "../../utils/collegeVerificationModalEvents";

function phoneMatchesCanonical(input: string, canonical: string | null): boolean {
    if (!input || !canonical) return false;
    const digitsInput = input.replace(/\D/g, "");
    const digitsCanonical = canonical.replace(/\D/g, "");
    if (!digitsInput || !digitsCanonical) return false;
    if (digitsInput === digitsCanonical) return true;
    // Match 10-digit Indian mobile numbers against canonical +91 format
    const tailInput = digitsInput.length > 10 ? digitsInput.slice(-10) : digitsInput;
    const tailCanonical = digitsCanonical.length > 10 ? digitsCanonical.slice(-10) : digitsCanonical;
    return tailInput.length === 10 && tailInput === tailCanonical;
}
import {
    fetchCollegeVerificationStatus,
    previewDocumentOcr,
    submitCollegeVerification,
    sendInstitutionalEmail,
    sendCollegePhoneOtp,
    verifyCollegePhoneOtp,
    type CollegeVerificationRecord,
    type OcrExtractedFields,
} from "../../api/collegeVerificationApi";

export interface CollegeVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCollegeName?: string | null;
    currentCollegeId?: string | null;
    onVerificationSubmitted?: () => void;
}

type WizardStep = "DOCUMENT" | "OCR_REVIEW" | "CONTACT_INFO" | "FINAL_SUBMIT" | "STATUS_VIEW";

export const CollegeVerificationModal: React.FC<CollegeVerificationModalProps> = ({
    isOpen,
    onClose,
    currentCollegeName,
    currentCollegeId,
    onVerificationSubmitted,
}) => {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backFileInputRef = useRef<HTMLInputElement>(null);

    // Flow & loading states
    const [step, setStep] = useState<WizardStep>("DOCUMENT");
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isScanningOcr, setIsScanningOcr] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Existing active/latest application
    const [activeApp, setActiveApp] = useState<CollegeVerificationRecord | null>(null);
    const [latestApp, setLatestApp] = useState<CollegeVerificationRecord | null>(null);
    const [currentVerificationState, setCurrentVerificationState] = useState<string>("NOT_VERIFIED");
    const [serverCollege, setServerCollege] = useState<{ id: string; officialName: string } | null>(null);

    // Document Upload Form
    const [documentType, setDocumentType] = useState<"student_id" | "erp_profile" | "student_id_both_sides">("student_id");
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [frontPreview, setFrontPreview] = useState<string | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [backPreview, setBackPreview] = useState<string | null>(null);

    // OCR extraction details & corrections
    const [ocrConfidence, setOcrConfidence] = useState<number>(0);
    const [rawOcrData, setRawOcrData] = useState<OcrExtractedFields>({
        studentName: null,
        collegeName: null,
        enrollmentNumber: null,
        courseName: null,
        academicYear: null,
        institutionEmail: null,
        phoneNumber: null,
    });

    const [studentName, setStudentName] = useState("");
    const [enrollmentNumber, setEnrollmentNumber] = useState("");
    const [courseName, setCourseName] = useState("");
    const [academicYear, setAcademicYear] = useState("");
    const [collegeNameInput, setCollegeNameInput] = useState("");

    const effectiveCollegeId = currentCollegeId || serverCollege?.id || activeApp?.college_id || null;
    const effectiveCollegeName = currentCollegeName || serverCollege?.officialName || collegeNameInput || "";

    // Contact verification channels
    const [institutionEmail, setInstitutionEmail] = useState("");
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [emailCooldown, setEmailCooldown] = useState(0);
    const [emailDomainMatched, setEmailDomainMatched] = useState<boolean | null>(null);
    const [serverVerifiedEmail, setServerVerifiedEmail] = useState<string | null>(null);
    const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);

    const [phoneNumber, setPhoneNumber] = useState("");
    const [isPhoneSending, setIsPhoneSending] = useState(false);
    const [phoneCooldown, setPhoneCooldown] = useState(0);
    const [phoneOtp, setPhoneOtp] = useState("");
    const [localPhoneVerified, setLocalPhoneVerified] = useState(false);
    const [serverVerifiedPhone, setServerVerifiedPhone] = useState<string | null>(null);
    const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

    // Authoritative verified status derived strictly from server confirmation matching current input values
    const isEmailVerified = Boolean(
        serverVerifiedEmail &&
            institutionEmail.trim().length > 0 &&
            institutionEmail.trim().toLowerCase() === serverVerifiedEmail.trim().toLowerCase()
    );
    const isPhoneVerified = Boolean(
        (localPhoneVerified && phoneMatchesCanonical(phoneNumber, serverVerifiedPhone || phoneNumber)) ||
            (serverVerifiedPhone && phoneMatchesCanonical(phoneNumber, serverVerifiedPhone))
    );

    // Background scroll lock
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Clean up temporary image object URLs on unmount or close
    useEffect(() => {
        if (!isOpen) {
            if (frontPreview) {
                try { URL.revokeObjectURL(frontPreview); } catch {}
                setFrontPreview(null);
            }
            if (backPreview) {
                try { URL.revokeObjectURL(backPreview); } catch {}
                setBackPreview(null);
            }
            setFrontFile(null);
            setBackFile(null);
            setPhoneOtp("");
            setLocalPhoneVerified(false);
            setServerVerifiedPhone(null);
            setServerVerifiedEmail(null);
            setIsEmailSent(false);
        }
    }, [isOpen]);

    // Cooldown countdown timers
    useEffect(() => {
        let interval: any;
        if (emailCooldown > 0) {
            interval = setInterval(() => setEmailCooldown((c) => Math.max(0, c - 1)), 1000);
        }
        return () => clearInterval(interval);
    }, [emailCooldown]);

    useEffect(() => {
        let interval: any;
        if (phoneCooldown > 0) {
            interval = setInterval(() => setPhoneCooldown((c) => Math.max(0, c - 1)), 1000);
        }
        return () => clearInterval(interval);
    }, [phoneCooldown]);

    // Sync verification status and pre-submission verified channels from server
    const loadVerificationStatus = async (options?: { updateStep?: boolean; silent?: boolean }) => {
        const updateStep = options?.updateStep !== false;
        const silent = options?.silent === true;
        if (!silent) {
            setIsLoadingStatus(true);
        } else {
            setIsRefreshingChannels(true);
        }
        try {
            const data = await fetchCollegeVerificationStatus();
            setCurrentVerificationState(data.status);
            setActiveApp(data.activeApplication);
            setLatestApp(data.latestApplication);
            if (data.currentCollege) {
                setServerCollege({
                    id: data.currentCollege.id,
                    officialName: data.currentCollege.officialName,
                });
                if (!collegeNameInput) {
                    setCollegeNameInput(data.currentCollege.officialName);
                }
            }

            if (data.verifiedChannels?.email && data.verifiedChannels?.emailVerifiedAt) {
                setServerVerifiedEmail(data.verifiedChannels.email);
                setInstitutionEmail((prev) => (prev.trim() ? prev : data.verifiedChannels!.email || ""));
            } else {
                setServerVerifiedEmail(null);
            }

            if (data.verifiedChannels?.phone && data.verifiedChannels?.phoneVerifiedAt) {
                setServerVerifiedPhone(data.verifiedChannels.phone);
                setPhoneNumber((prev) => (prev.trim() ? prev : data.verifiedChannels!.phone || ""));
                setLocalPhoneVerified(true);
            } else if (!localPhoneVerified) {
                setServerVerifiedPhone(null);
            }

            if (updateStep) {
                if (data.status === "PENDING" || data.status === "PROCESSING" || data.status === "APPROVED" || data.status === "REJECTED" || data.status === "INVALIDATED") {
                    setStep("STATUS_VIEW");
                } else {
                    setStep("DOCUMENT");
                }
            }
        } catch (err: any) {
            console.error("Failed to load verification status:", err);
        } finally {
            if (!silent) {
                setIsLoadingStatus(false);
            } else {
                setIsRefreshingChannels(false);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadVerificationStatus({ updateStep: true });
            if (currentCollegeName) {
                setCollegeNameInput(currentCollegeName);
            }
        }
    }, [isOpen, currentCollegeName]);

    // Synchronize verified email/phone state across tabs (e.g. clicking email link in another tab)
    useEffect(() => {
        if (!isOpen) return;

        const handleSync = () => {
            if (step === "CONTACT_INFO" || step === "FINAL_SUBMIT") {
                loadVerificationStatus({ updateStep: false, silent: true });
            }
        };

        window.addEventListener("focus", handleSync);
        window.addEventListener(ORBIX_COLLEGE_VERIFICATION_UPDATED_EVENT, handleSync);

        let channel: BroadcastChannel | null = null;
        try {
            if (typeof BroadcastChannel !== "undefined") {
                channel = new BroadcastChannel("orbix_college_verification");
                channel.onmessage = () => handleSync();
            }
        } catch {}

        return () => {
            window.removeEventListener("focus", handleSync);
            window.removeEventListener(ORBIX_COLLEGE_VERIFICATION_UPDATED_EVENT, handleSync);
            if (channel) {
                try { channel.close(); } catch {}
            }
        };
    }, [isOpen, step]);

    // Handle modal backdrop dismissal
    const { handleBackdropClick } = useModalDismiss({
        isOpen,
        onClose: () => {
            if (!isScanningOcr && !isSubmitting) onClose();
        },
        disableEscape: isScanningOcr || isSubmitting,
        disableBackdrop: isScanningOcr || isSubmitting,
    });

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    // File handlers
    const handleFrontFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Document exceeds 10MB limit. Please upload a smaller JPG, PNG, or WebP image.", {
                title: "File Too Large",
            });
            return;
        }

        setFrontFile(file);
        setFrontPreview(URL.createObjectURL(file));
    };

    const handleBackFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Document exceeds 10MB limit. Please upload a smaller image.", {
                title: "File Too Large",
            });
            return;
        }

        setBackFile(file);
        setBackPreview(URL.createObjectURL(file));
    };

    // Run OCR Scanning
    const handleRunOcr = async () => {
        if (!frontFile) {
            toast.error("Please choose a document image first.", { title: "Document Missing" });
            return;
        }

        if (documentType === "student_id_both_sides" && !backFile) {
            toast.error("Please upload the back side of your student ID card as well.", { title: "Back Side Missing" });
            return;
        }

        setIsScanningOcr(true);
        try {
            const ocrResult = await previewDocumentOcr(frontFile, effectiveCollegeName);

            setOcrConfidence(ocrResult.confidence);
            setRawOcrData(ocrResult.extractedFields);

            // Populate form inputs with extracted data or existing values
            if (ocrResult.extractedFields.studentName) {
                setStudentName(ocrResult.extractedFields.studentName);
            }
            if (ocrResult.extractedFields.enrollmentNumber) {
                setEnrollmentNumber(ocrResult.extractedFields.enrollmentNumber);
            }
            if (ocrResult.extractedFields.courseName) {
                setCourseName(ocrResult.extractedFields.courseName);
            }
            if (ocrResult.extractedFields.academicYear) {
                setAcademicYear(ocrResult.extractedFields.academicYear);
            }
            if (ocrResult.extractedFields.institutionEmail) {
                setInstitutionEmail(ocrResult.extractedFields.institutionEmail);
            }
            if (ocrResult.extractedFields.phoneNumber) {
                setPhoneNumber(ocrResult.extractedFields.phoneNumber);
            }
            if (ocrResult.extractedFields.collegeName && !currentCollegeName) {
                setCollegeNameInput(ocrResult.extractedFields.collegeName);
            }

            toast.success("Document analyzed! Review and verify the extracted details.", {
                title: `OCR Complete (${ocrResult.confidence}% confidence)`,
            });
            setStep("OCR_REVIEW");
        } catch (err: any) {
            console.error("OCR preview error:", err);
            toast.warning(
                "Automated text extraction was unable to cleanly parse this document. You can still proceed by filling in the details manually for founder review.",
                { title: "Manual Review Fallback" }
            );
            // Move to review anyway with empty fields so student isn't blocked!
            setStep("OCR_REVIEW");
        } finally {
            setIsScanningOcr(false);
        }
    };

    // Send institutional email verification
    const handleSendEmailLink = async () => {
        if (!institutionEmail.trim() || !institutionEmail.includes("@")) {
            toast.error("Please enter a valid institutional email address.", { title: "Invalid Email" });
            return;
        }

        if (!effectiveCollegeId) {
            toast.error("Please save your college in Profile before requesting institutional email verification.", {
                title: "College Affiliation Required",
            });
            return;
        }

        setIsEmailSending(true);
        try {
            const res = await sendInstitutionalEmail(institutionEmail.trim(), effectiveCollegeId);
            setIsEmailSent(true);
            setEmailCooldown(res.cooldownSeconds || 60);
            setEmailDomainMatched(res.domainMatched);

            toast.success(res.message, { title: "Verification Link Sent" });
        } catch (err: any) {
            toast.error(err.message || "Failed to send verification email.", { title: "Email Delivery Error" });
        } finally {
            setIsEmailSending(false);
        }
    };

    // Send Phone OTP
    const handleSendPhoneOtp = async () => {
        if (!phoneNumber.trim()) {
            toast.error("Please enter a valid 10-digit mobile number.", { title: "Invalid Phone" });
            return;
        }

        setIsPhoneSending(true);
        try {
            const res = await sendCollegePhoneOtp(phoneNumber.trim());
            setPhoneCooldown(res.cooldownSeconds || 60);
            toast.success(res.message, { title: "SMS Code Sent" });
        } catch (err: any) {
            toast.error(err.message || "Failed to send SMS code.", { title: "SMS Error" });
        } finally {
            setIsPhoneSending(false);
        }
    };

    // Verify Phone OTP
    const handleVerifyPhoneOtp = async () => {
        if (phoneOtp.trim().length !== 6) {
            toast.error("Please enter all 6 digits of the SMS verification code.", { title: "Invalid Code" });
            return;
        }

        setIsVerifyingPhone(true);
        try {
            const res = await verifyCollegePhoneOtp(phoneNumber.trim(), phoneOtp.trim());
            setServerVerifiedPhone(res.canonical || phoneNumber.trim());
            setLocalPhoneVerified(true);
            toast.success(res.message, { title: "Phone Verified" });
        } catch (err: any) {
            toast.error(err.message || "Failed to verify phone code.", { title: "Verification Error" });
        } finally {
            setIsVerifyingPhone(false);
        }
    };

    // Final Application Submit
    const handleSubmitApplication = async () => {
        if (!effectiveCollegeId) {
            toast.error("No verified institution selected in profile.", { title: "Institution Missing" });
            return;
        }

        if (!frontFile) {
            toast.error("Document image is required.", { title: "Document Missing" });
            return;
        }

        if (!isEmailVerified) {
            toast.error("Institutional email verification is required before submitting your application.", {
                title: "Email Verification Required",
            });
            setStep("CONTACT_INFO");
            return;
        }

        if (!isPhoneVerified) {
            toast.error("Mobile phone OTP verification is required before submitting your application.", {
                title: "Phone Verification Required",
            });
            setStep("CONTACT_INFO");
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("collegeId", effectiveCollegeId);
            formData.append("documentType", documentType);
            formData.append("documents", frontFile);
            if (backFile && documentType === "student_id_both_sides") {
                formData.append("documents", backFile);
            }

            formData.append("studentName", studentName.trim());
            formData.append("enrollmentNumber", enrollmentNumber.trim());
            formData.append("courseName", courseName.trim());
            formData.append("academicYear", academicYear.trim());
            formData.append("institutionEmail", institutionEmail.trim());
            formData.append("phoneNumber", phoneNumber.trim());
            formData.append("ocrConfidence", String(ocrConfidence));
            formData.append("extractedData", JSON.stringify(rawOcrData));

            const res = await submitCollegeVerification(formData);

            toast.success(res.message, { title: "Application Submitted" });
            setActiveApp(res.application);
            setCurrentVerificationState("PENDING");
            setStep("STATUS_VIEW");

            if (onVerificationSubmitted) {
                onVerificationSubmitted();
            }
        } catch (err: any) {
            console.error("Submission failed:", err);
            toast.error(err.message || "Failed to submit verification application.", { title: "Submission Failed" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Resubmit reset handler
    const handleStartResubmission = () => {
        setFrontFile(null);
        setFrontPreview(null);
        setBackFile(null);
        setBackPreview(null);
        setPhoneOtp("");
        setPhoneCooldown(0);
        setLocalPhoneVerified(false);
        setServerVerifiedPhone(null);
        setIsEmailSent(false);
        setEmailCooldown(0);
        setServerVerifiedEmail(null);
        setStep("DOCUMENT");
        loadVerificationStatus({ updateStep: false, silent: true });
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="collegeVerificationModalTitle"
            onClick={handleBackdropClick}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
        >
            <div
                className="w-full max-w-2xl bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 shrink-0 pb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <GraduationCap className="w-6 h-6 text-black stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <h3
                                id="collegeVerificationModalTitle"
                                className="text-base sm:text-lg font-black tracking-tight text-black truncate"
                            >
                                College Enrollment Verification
                            </h3>
                            <p className="text-xs text-neutral-600 font-bold truncate">
                                {effectiveCollegeName ? effectiveCollegeName : "Verify authentic institutional enrollment"}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isScanningOcr || isSubmitting}
                        className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Wizard Body (Scrollable) */}
                <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                    {isLoadingStatus ? (
                        <div className="py-16 text-center space-y-3">
                            <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                Checking verification records...
                            </p>
                        </div>
                    ) : step === "STATUS_VIEW" ? (
                        /* ========================================================================= */
                        /* STEP: STATUS VIEW (Existing active, approved, or rejected application) */
                        /* ========================================================================= */
                        <div className="space-y-4">
                            {currentVerificationState === "APPROVED" ? (
                                <div className="p-4 sm:p-5 rounded-xl bg-emerald-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                            <CheckCircle2 className="w-6 h-6 text-black stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                                                Official Status
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-black">
                                                College Affiliation Verified
                                            </h4>
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed">
                                        Your enrollment at <strong className="text-black font-black">{currentCollegeName}</strong> has been officially verified by Orbix founders. The <span className="font-black">College Verified badge</span> is active on your public profile and seasonal leaderboards.
                                    </p>
                                    {activeApp?.reviewed_at && (
                                        <p className="text-[11px] text-neutral-500 font-bold">
                                            Verified on: {new Date(activeApp.reviewed_at).toLocaleDateString(undefined, { dateStyle: "long" })}
                                        </p>
                                    )}
                                </div>
                            ) : currentVerificationState === "PENDING" || currentVerificationState === "PROCESSING" ? (
                                <div className="p-4 sm:p-5 rounded-xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                            <Clock className="w-6 h-6 text-black stroke-[2.5] animate-pulse" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 block">
                                                Under Review
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-black">
                                                Verification Application in Queue
                                            </h4>
                                        </div>
                                    </div>

                                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed">
                                        Your student document and enrollment details for <strong className="text-black font-black">{currentCollegeName}</strong> have been securely submitted. Orbix founders manually review every college verification application to preserve platform integrity.
                                    </p>

                                    {/* Timeline progress indicator */}
                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2.5">
                                        <div className="flex items-center gap-2 text-xs font-black text-black">
                                            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                            <span>Document Upload & OCR Extraction Complete</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-black text-black">
                                            <Clock className="w-4 h-4 text-amber-600 stroke-[3] animate-spin" />
                                            <span>Founder Document Inspection (Typical: 24–48 hours)</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-400">
                                            <ShieldCheck className="w-4 h-4 stroke-[2]" />
                                            <span>College Verified Badge Activated</span>
                                        </div>
                                    </div>

                                    {activeApp?.created_at && (
                                        <p className="text-[11px] text-neutral-500 font-bold">
                                            Submitted on: {new Date(activeApp.created_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ) : currentVerificationState === "REJECTED" ? (
                                <div className="p-4 sm:p-5 rounded-xl bg-rose-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                            <XCircle className="w-6 h-6 text-black stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                                                Decision Notice
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-black">
                                                Application Not Approved
                                            </h4>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                            Founder Reviewer Reason
                                        </span>
                                        <p className="text-xs font-bold text-rose-950 leading-relaxed">
                                            {latestApp?.rejection_reason || "The submitted document could not be authenticated as matching your selected institution."}
                                        </p>
                                    </div>

                                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed">
                                        You may upload a clearer photo of your physical student ID card or an official ERP profile screenshot to resubmit your verification.
                                    </p>

                                    <OrbixButton
                                        onClick={handleStartResubmission}
                                        className="w-full bg-[#FFE566] text-black font-black uppercase text-xs"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Resubmit Verification Application
                                    </OrbixButton>
                                </div>
                            ) : currentVerificationState === "INVALIDATED" ? (
                                <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                            <AlertTriangle className="w-6 h-6 text-black stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                                                Affiliation Changed
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-black">
                                                Re-Verification Required
                                            </h4>
                                        </div>
                                    </div>

                                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed">
                                        Your college affiliation was recently updated. In accordance with Orbix fair-play rules, any verification under your previous college has been invalidated. Please submit a new verification application matching your current institution.
                                    </p>

                                    <OrbixButton
                                        onClick={handleStartResubmission}
                                        className="w-full bg-[#FFE566] text-black font-black uppercase text-xs"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Start New College Verification
                                    </OrbixButton>
                                </div>
                            ) : null}
                        </div>
                    ) : step === "DOCUMENT" ? (
                        /* ========================================================================= */
                        /* STEP 1: DOCUMENT UPLOAD */
                        /* ========================================================================= */
                        <div className="space-y-4">
                            {/* Current College Banner */}
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Verifying Affiliation For
                                    </span>
                                    <h4 className="text-xs sm:text-sm font-black text-black truncate">
                                        {currentCollegeName || "No college chosen in profile"}
                                    </h4>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000] shrink-0">
                                    Unverified
                                </span>
                            </div>

                            {/* Document Type Selector */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Document Type
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[
                                        { id: "student_id", label: "Student ID (Front)" },
                                        { id: "student_id_both_sides", label: "Student ID (Both Sides)" },
                                        { id: "erp_profile", label: "Official ERP Profile" },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setDocumentType(t.id as any)}
                                            className={`px-3 py-2.5 rounded-xl border-2 border-black text-xs font-black text-left transition-all cursor-pointer ${
                                                documentType === t.id
                                                    ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                                    : "bg-white hover:bg-neutral-50 shadow-[1.5px_1.5px_0px_#000]"
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Front Document Upload Box */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    {documentType === "erp_profile" ? "ERP Profile Screenshot" : "Front Side of Student ID Card"}
                                </label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFrontFileSelected}
                                    className="hidden"
                                />

                                {frontPreview ? (
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img
                                                src={frontPreview}
                                                alt="Front document preview"
                                                className="w-14 h-14 object-cover rounded-lg border-2 border-black shadow-[1px_1px_0px_#000] shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-black truncate">
                                                    {frontFile?.name}
                                                </p>
                                                <p className="text-[11px] text-neutral-600 font-semibold">
                                                    {frontFile ? `${Math.round(frontFile.size / 1024)} KB` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFrontFile(null);
                                                setFrontPreview(null);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-black text-xs font-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-6 rounded-xl border-2 border-dashed border-black bg-[#FAF6EE]/50 hover:bg-[#FAF6EE] text-center cursor-pointer transition-colors space-y-2"
                                    >
                                        <UploadCloud className="w-8 h-8 text-black mx-auto stroke-[2]" />
                                        <p className="text-xs font-black text-black">
                                            Click to browse or drop document image here
                                        </p>
                                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">
                                            Supports JPG, PNG, WebP up to 10MB
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Back Document Upload Box (if two-sided) */}
                            {documentType === "student_id_both_sides" && (
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                                        Back Side of Student ID Card
                                    </label>
                                    <input
                                        type="file"
                                        ref={backFileInputRef}
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleBackFileSelected}
                                        className="hidden"
                                    />

                                    {backPreview ? (
                                        <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={backPreview}
                                                    alt="Back document preview"
                                                    className="w-14 h-14 object-cover rounded-lg border-2 border-black shadow-[1px_1px_0px_#000] shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-black truncate">
                                                        {backFile?.name}
                                                    </p>
                                                    <p className="text-[11px] text-neutral-600 font-semibold">
                                                        {backFile ? `${Math.round(backFile.size / 1024)} KB` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBackFile(null);
                                                    setBackPreview(null);
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-black text-xs font-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => backFileInputRef.current?.click()}
                                            className="p-6 rounded-xl border-2 border-dashed border-black bg-[#FAF6EE]/50 hover:bg-[#FAF6EE] text-center cursor-pointer transition-colors space-y-2"
                                        >
                                            <UploadCloud className="w-8 h-8 text-black mx-auto stroke-[2]" />
                                            <p className="text-xs font-black text-black">
                                                Click to upload back side of student card
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Privacy Notice */}
                            <div className="p-3 rounded-xl bg-neutral-50 border border-black/20 text-[11px] text-neutral-600 font-semibold leading-relaxed flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-black shrink-0 mt-0.5" />
                                <span>
                                    Orbix uses private document storage and automated OCR extraction to assist reading your credentials. No Aadhaar numbers or biometric faces are scanned or retained.
                                </span>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2">
                                <OrbixButton
                                    onClick={handleRunOcr}
                                    disabled={!frontFile || isScanningOcr}
                                    className="w-full bg-[#FFE566] text-black font-black uppercase text-xs"
                                >
                                    {isScanningOcr ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                                            Extracting Information via OCR...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Scan & Extract Document Details
                                        </>
                                    )}
                                </OrbixButton>
                            </div>
                        </div>
                    ) : step === "OCR_REVIEW" ? (
                        /* ========================================================================= */
                        /* STEP 2: REVIEW & CORRECT OCR EXTRACTIONS */
                        /* ========================================================================= */
                        <div className="space-y-4">
                            {/* Confidence Banner */}
                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <Sparkles className="w-5 h-5 text-amber-500 stroke-[2.5]" />
                                    <div>
                                        <h4 className="text-xs font-black text-black">
                                            OCR Document Extraction
                                        </h4>
                                        <p className="text-[11px] text-neutral-600 font-semibold">
                                            Review and correct any details before submitting
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                    {ocrConfidence}% Confidence
                                </span>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Student Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Enrollment / Roll / Registration Number
                                    </label>
                                    <input
                                        type="text"
                                        value={enrollmentNumber}
                                        onChange={(e) => setEnrollmentNumber(e.target.value)}
                                        placeholder="e.g. 21BCSE045 or 20210045"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Course / Department
                                        </label>
                                        <input
                                            type="text"
                                            value={courseName}
                                            onChange={(e) => setCourseName(e.target.value)}
                                            placeholder="e.g. B.Tech Computer Science"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Academic Year / Validity
                                        </label>
                                        <input
                                            type="text"
                                            value={academicYear}
                                            onChange={(e) => setAcademicYear(e.target.value)}
                                            placeholder="e.g. 2022-2026 or Valid 2026"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep("DOCUMENT")}
                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5 inline" />
                                    Back
                                </button>
                                <OrbixButton
                                    onClick={() => setStep("CONTACT_INFO")}
                                    className="bg-[#FFE566] text-black font-black uppercase text-xs"
                                >
                                    Continue to Contact Verification
                                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                                </OrbixButton>
                            </div>
                        </div>
                    ) : step === "CONTACT_INFO" ? (
                        /* ========================================================================= */
                        /* STEP 3: CONTACT CHANNELS (Mandatory Institutional Email & Phone OTP) */
                        /* ========================================================================= */
                        <div className="space-y-4">
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                <p className="text-xs font-black text-black">
                                    Mandatory Institutional Email & Phone Verification
                                </p>
                                <p className="text-[11px] text-neutral-600 font-semibold leading-relaxed">
                                    You must verify BOTH your institutional email link and your mobile phone OTP before submitting your application. Ownership of email and phone alongside official document review is required for founder approval.
                                </p>
                            </div>

                            {/* Institutional Email Card */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                                        <label className="text-xs font-black uppercase tracking-wider text-black">
                                            Institutional Email <span className="text-rose-600">*</span>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {emailDomainMatched && (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-black text-[10px] font-black text-emerald-900 uppercase">
                                                Domain Matched
                                            </span>
                                        )}
                                        {isEmailVerified ? (
                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[10px] font-black text-emerald-900 uppercase inline-flex items-center gap-1">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                                Email Verified
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-black text-[10px] font-black text-amber-950 uppercase">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={institutionEmail}
                                        onChange={(e) => {
                                            setInstitutionEmail(e.target.value);
                                            if (serverVerifiedEmail && e.target.value.trim().toLowerCase() !== serverVerifiedEmail.trim().toLowerCase()) {
                                                setIsEmailSent(false);
                                            }
                                        }}
                                        disabled={isEmailVerified}
                                        placeholder="e.g. yourname@institution.edu"
                                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] disabled:opacity-75"
                                    />
                                    {!isEmailVerified ? (
                                        <button
                                            type="button"
                                            onClick={handleSendEmailLink}
                                            disabled={isEmailSending || emailCooldown > 0 || !institutionEmail.trim()}
                                            className="px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                        >
                                            {isEmailSending ? "Sending..." : emailCooldown > 0 ? `Resend (${emailCooldown}s)` : "Send Link"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setServerVerifiedEmail(null);
                                                setIsEmailSent(false);
                                                setEmailCooldown(0);
                                            }}
                                            className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>

                                {!isEmailVerified && isEmailSent && (
                                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 flex-wrap">
                                        <p className="text-[11px] text-amber-950 font-bold">
                                            Verification link dispatched! Click the confirmation link in your email, then verify status here.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => loadVerificationStatus({ updateStep: false, silent: true })}
                                            disabled={isRefreshingChannels}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFE566] hover:bg-[#ffe043] text-black text-[11px] font-black uppercase border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-3 h-3 stroke-[2.5] ${isRefreshingChannels ? "animate-spin" : ""}`} />
                                            {isRefreshingChannels ? "Checking..." : "Check Status"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Phone Verification Card */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-black stroke-[2.5]" />
                                        <label className="text-xs font-black uppercase tracking-wider text-black">
                                            Mobile Phone OTP <span className="text-rose-600">*</span>
                                        </label>
                                    </div>
                                    {isPhoneVerified ? (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[10px] font-black text-emerald-900 uppercase inline-flex items-center gap-1">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                            Phone Verified
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-black text-[10px] font-black text-amber-950 uppercase">
                                            Required
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        disabled={isPhoneVerified}
                                        placeholder="10-digit mobile number"
                                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] disabled:opacity-75"
                                    />
                                    {!isPhoneVerified ? (
                                        <button
                                            type="button"
                                            onClick={handleSendPhoneOtp}
                                            disabled={isPhoneSending || phoneCooldown > 0 || !phoneNumber.trim()}
                                            className="px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                        >
                                            {isPhoneSending ? "Sending..." : phoneCooldown > 0 ? `Resend (${phoneCooldown}s)` : "Send OTP"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLocalPhoneVerified(false);
                                                setServerVerifiedPhone(null);
                                                setPhoneOtp("");
                                                setPhoneCooldown(0);
                                            }}
                                            className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>

                                {!isPhoneVerified && phoneCooldown > 0 && (
                                    <div className="flex gap-2 pt-1">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={phoneOtp}
                                            onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                                            placeholder="Enter 6-digit OTP"
                                            className="w-36 px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-black tracking-widest text-center shadow-[2px_2px_0px_#000]"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleVerifyPhoneOtp}
                                            disabled={isVerifyingPhone || phoneOtp.length !== 6}
                                            className="px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                        >
                                            {isVerifyingPhone ? "Verifying..." : "Verify"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Explicit Checklist of Incomplete Requirements */}
                            {(!isEmailVerified || !isPhoneVerified) && (
                                <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs font-bold space-y-1">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-900">
                                        Complete Both Verification Steps to Continue:
                                    </p>
                                    {!isEmailVerified && (
                                        <p className="text-[11px] flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                            Incomplete: Institutional email verification link must be clicked and confirmed.
                                        </p>
                                    )}
                                    {!isPhoneVerified && (
                                        <p className="text-[11px] flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                            Incomplete: 6-digit mobile phone SMS OTP must be verified.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep("OCR_REVIEW")}
                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5 inline" />
                                    Back
                                </button>
                                <OrbixButton
                                    onClick={() => {
                                        if (!isEmailVerified) {
                                            toast.error("Please complete institutional email verification first.", {
                                                title: "Email Verification Incomplete",
                                            });
                                            return;
                                        }
                                        if (!isPhoneVerified) {
                                            toast.error("Please verify your mobile phone OTP first.", {
                                                title: "Phone Verification Incomplete",
                                            });
                                            return;
                                        }
                                        setStep("FINAL_SUBMIT");
                                    }}
                                    disabled={!isEmailVerified || !isPhoneVerified}
                                    className="bg-[#FFE566] text-black font-black uppercase text-xs disabled:opacity-50"
                                >
                                    Review Application Summary
                                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 inline" />
                                </OrbixButton>
                            </div>
                        </div>
                    ) : step === "FINAL_SUBMIT" ? (
                        /* ========================================================================= */
                        /* STEP 4: FINAL SUMMARY & SUBMISSION */
                        /* ========================================================================= */
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Application Summary
                                </h4>

                                <div className="space-y-2 text-xs divide-y divide-black/10">
                                    <div className="flex justify-between py-1">
                                        <span className="text-neutral-600 font-bold">College / Institution</span>
                                        <span className="font-black text-black text-right">{effectiveCollegeName || currentCollegeName}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-neutral-600 font-bold">Student Name</span>
                                        <span className="font-black text-black">{studentName || "Not specified"}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-neutral-600 font-bold">Enrollment / Roll No</span>
                                        <span className="font-black text-black">{enrollmentNumber || "Not specified"}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-neutral-600 font-bold">Course / Department</span>
                                        <span className="font-black text-black">{courseName || "Not specified"}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-neutral-600 font-bold">Academic Year</span>
                                        <span className="font-black text-black">{academicYear || "Not specified"}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 gap-2">
                                        <span className="text-neutral-600 font-bold">Institutional Email</span>
                                        <span className="font-black text-black flex items-center gap-1.5">
                                            {institutionEmail}
                                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[9px] font-black text-emerald-900 uppercase">
                                                Verified
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 gap-2">
                                        <span className="text-neutral-600 font-bold">Phone Number</span>
                                        <span className="font-black text-black flex items-center gap-1.5">
                                            {phoneNumber}
                                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[9px] font-black text-emerald-900 uppercase">
                                                Verified
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <span>
                                    Submitting official documents creates an immutable verification audit record. Applications are reviewed manually by Orbix founders to safeguard inter-university contest integrity.
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep("CONTACT_INFO")}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5 inline" />
                                    Back
                                </button>
                                <OrbixButton
                                    onClick={handleSubmitApplication}
                                    disabled={isSubmitting}
                                    className="bg-[#FFE566] text-black font-black uppercase text-xs"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                                            Submitting Application...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Submit for Founder Review
                                        </>
                                    )}
                                </OrbixButton>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body
    );
};
