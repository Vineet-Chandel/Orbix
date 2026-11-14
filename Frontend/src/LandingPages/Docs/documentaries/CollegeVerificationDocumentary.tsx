import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    GraduationCap,
    UploadCloud,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ShieldCheck,
    Lock,
    Mail,
    Phone,
    ExternalLink,
    Sparkles,
    FileText,
    Check,
    RotateCcw,
    FileCheck,
    Eye,
    Building2,
    AlertCircle,
    Fingerprint,
    Users,
    Sliders,
    ShieldAlert,
} from "lucide-react";
import { VerifiedBadge } from "../../../components/VerifiedBadge";
import { NeoSelect } from "../../../components/NeoSelect";
import { openCollegeVerificationModal } from "../../../utils/collegeVerificationModalEvents";

// Sample verified institution for interactive demonstration
interface SampleStudentVerification {
    studentName: string;
    enrollmentNo: string;
    collegeName: string;
    collegeCity: string;
    collegeState: string;
    aisheCode: string;
    degreeCourse: string;
    academicYear: string;
    institutionEmail: string;
    institutionPhone: string;
    documentType: "student_id" | "erp_profile";
    ocrConfidence: number;
    rawExtractedData: {
        studentName: string;
        enrollmentNo: string;
        collegeName: string;
        degree: string;
        year: string;
    };
}

const DEMO_STUDENT: SampleStudentVerification = {
    studentName: "Aarav Sharma",
    enrollmentNo: "2023CSB1042",
    collegeName: "Pranveer Singh Institute of Technology (PSIT)",
    collegeCity: "Kanpur",
    collegeState: "Uttar Pradesh",
    aisheCode: "C-46124",
    degreeCourse: "B.Tech Computer Science & Engineering",
    academicYear: "3rd Year (2023 - 2027)",
    institutionEmail: "aarav.sharma@psit.edu.in",
    institutionPhone: "+91 98390 12345",
    documentType: "student_id",
    ocrConfidence: 96.4,
    rawExtractedData: {
        studentName: "AARAV SHARMA",
        enrollmentNo: "2023CSB1042",
        collegeName: "PRANVEER SINGH INSTITUTE OF TECH",
        degree: "B.TECH (CSE)",
        year: "YEAR 3 / SEM 5",
    },
};

export const CollegeVerificationDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Verification Workbench State
    // -------------------------------------------------------------------------
    const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<
        "DOCUMENT" | "OCR_REVIEW" | "CONTACT_INFO" | "AUDIT_REVIEW" | "VERIFIED_BADGE"
    >("DOCUMENT");

    // Document Upload Simulation
    const [selectedDocType, setSelectedDocType] = useState<"student_id" | "erp_profile">("student_id");
    const [hasSimulatedUpload] = useState<boolean>(true);

    // OCR Review Simulation
    const [editableStudentName, setEditableStudentName] = useState<string>(DEMO_STUDENT.studentName);
    const [editableEnrollmentNo, setEditableEnrollmentNo] = useState<string>(DEMO_STUDENT.enrollmentNo);
    const [editableDegree, setEditableDegree] = useState<string>(DEMO_STUDENT.degreeCourse);
    const [editableYear, setEditableYear] = useState<string>(DEMO_STUDENT.academicYear);

    // Contact OTP Simulation
    const [emailOtpVerified, setEmailOtpVerified] = useState<boolean>(true);
    const [phoneOtpVerified, setPhoneOtpVerified] = useState<boolean>(true);
    const [simulatedEmailCode, setSimulatedEmailCode] = useState<string>("849201");
    const [simulatedPhoneCode, setSimulatedPhoneCode] = useState<string>("512890");

    // Reviewer Decision Simulation
    const [reviewerDecision, setReviewerDecision] = useState<"APPROVED" | "PENDING" | "PROCESSING" | "REJECTED">("APPROVED");

    const handleLaunchLiveVerification = () => {
        try {
            openCollegeVerificationModal();
        } catch {
            // fallback
        }
    };

    return (
        <article className="space-y-16 sm:space-y-24">
            {/* ========================================================================= */}
            {/* DOCUMENTARY HERO HEADER                                                   */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#70D6FF] text-black text-xs font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000]">
                            <GraduationCap className="w-4 h-4 stroke-[2.5]" />
                            <span>Orbix Institutional Identity Standard</span>
                        </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-neutral-500">
                        11 min read • Published for Public Transparency
                    </span>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-[1.08]">
                        Orbix College Verification: Establishing Trust in Student Identity and Institutional Affiliation
                    </h1>
                    <p className="text-base sm:text-lg font-bold text-neutral-700 leading-relaxed max-w-4xl">
                        An authoritative specification of Orbix&apos;s institutional identity verification process. Explores academic document evidence, OCR-assisted attribute extraction, independent institutional email and phone OTP confirmation, authorized manual review, and the complete verification lifecycle.
                    </p>
                </div>

                {/* Hero Architectural Pipeline Visual Card */}
                <div className="p-6 sm:p-8 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-black">
                                End-to-End Institutional Verification Pipeline
                            </h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-neutral-600 bg-white px-2.5 py-1 rounded-md border border-black">
                            Multi-Step Gated Verification
                        </span>
                    </div>

                    {/* Step-by-Step Flow Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                            <span className="px-2 py-0.5 rounded bg-[#FFE566] text-black font-mono font-black text-[11px] border border-black">
                                STAGE 01
                            </span>
                            <h4 className="text-xs font-black text-black">Academic Document Submission</h4>
                            <p className="text-[11px] font-medium text-neutral-600 leading-relaxed">
                                Upload official Student ID or authenticated College ERP profile screenshot.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                            <span className="px-2 py-0.5 rounded bg-[#70D6FF] text-black font-mono font-black text-[11px] border border-black">
                                STAGE 02
                            </span>
                            <h4 className="text-xs font-black text-black">OCR Assistance Extraction</h4>
                            <p className="text-[11px] font-medium text-neutral-600 leading-relaxed">
                                Intelligent attribute extraction parses name, enrollment number, college, and degree.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                            <span className="px-2 py-0.5 rounded bg-[#FF70A6] text-black font-mono font-black text-[11px] border border-black">
                                STAGE 03
                            </span>
                            <h4 className="text-xs font-black text-black">Dual Contact OTP Verification</h4>
                            <p className="text-[11px] font-medium text-neutral-600 leading-relaxed">
                                Independent 6-digit OTP verification for both college email and campus-associated mobile phone.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                            <span className="px-2 py-0.5 rounded bg-[#a2ff86] text-black font-mono font-black text-[11px] border border-black">
                                STAGE 04
                            </span>
                            <h4 className="text-xs font-black text-black">Reviewer Audit & Badge Activation</h4>
                            <p className="text-[11px] font-medium text-neutral-600 leading-relaxed">
                                Authorized reviewer verification checks authenticity, unlocking the College Verified badge.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Preserves strict separation from account authentication and personal credentials</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleLaunchLiveVerification}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-all cursor-pointer"
                        >
                            <span>Open College Verification</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: WHY COLLEGE VERIFICATION MATTERS                               */}
            {/* ========================================================================= */}
            <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Why College Verification Matters
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    A verified college affiliation helps establish credibility within the Orbix ecosystem. It allows students to demonstrate their authentic institutional association and helps build greater trust across college communities, campus clubs, hackathons, and student-facing experiences.
                </p>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    In competitive student ecosystems, unverified claims lead to brand squatting, fraudulent campus leaderboard inflation, and misrepresentation during club recruitment or inter-college hackathons. College Verification creates a tamper-resistant trust foundation by pairing documented evidence with two-factor institutional contact verification.
                </p>

                {/* Account Isolation Notice Box */}
                <div className="p-6 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-sm sm:text-base font-black text-black">
                            Sovereignty Principle: Independent Verification Subsystem
                        </h3>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed">
                        College Verification is an independent institutional process. <strong>It does not replace, overwrite, or modify the standard email, phone, or account security verification associated with your primary Orbix user account.</strong> You can sign in with your personal credentials while maintaining verified institutional standing with your college.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: ELIGIBILITY & REQUIREMENTS                                     */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Eligibility and Requirements
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    College Verification is intended specifically for individual student accounts. Before initiating the verification workflow in the Account Center, ensure you have active access to the following 4 prerequisites:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-black stroke-[2.5]" />
                            <h4 className="text-sm font-black text-black">Valid Academic Document</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            A valid physical Student Identification Card issued by your university, or an official, readable screenshot of your active student profile from your college ERP / SIS portal.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-black stroke-[2.5]" />
                            <h4 className="text-sm font-black text-black">Institutional Email Access</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Active inbox access to your college-assigned email address (e.g. <code>@college.edu</code> or official college domain) capable of receiving a 6-digit verification OTP.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Phone className="w-5 h-5 text-black stroke-[2.5]" />
                            <h4 className="text-sm font-black text-black">Institutional Phone Number</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Access to your mobile phone number registered on institutional records to receive and verify an independent SMS one-time password.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-black stroke-[2.5]" />
                            <h4 className="text-sm font-black text-black">Active Orbix Student Account</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            An active Orbix student profile with your affiliated institution selected in your profile settings to bind the verification state.
                        </p>
                    </div>
                </div>

                {/* Important Exclusion Alert */}
                <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-600 shadow-[3px_3px_0px_#e11d48] space-y-2">
                    <div className="flex items-center gap-2 text-rose-900 font-black text-sm">
                        <AlertTriangle className="w-5 h-5 text-rose-600 stroke-[2.5]" />
                        <span>Important Notice for Club Organizations</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-rose-950 leading-relaxed">
                        Club and student organization accounts are <strong>not eligible</strong> for this student verification workflow. Collegiate societies and developer clubs must follow the dedicated{" "}
                        <Link
                            to="/docs/club-verification-protocol"
                            className="underline font-black text-rose-900 hover:text-black"
                        >
                            Orbix Club Verification Protocol
                        </Link>
                        , which evaluates administrative faculty sponsorship and student leadership mandates.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: THE 7-STEP VERIFICATION WORKFLOW                               */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        The Multi-Step Verification Process
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Orbix follows an authoritative multi-step verification process that combines document evidence, intelligent feature extraction, two-channel institutional contact verification, and manual reviewer auditing.
                </p>

                <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#a2ff86] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    01
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Step 01 — Submit Your Academic Document
                                </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-neutral-100 border border-black text-neutral-700">
                                Document Ingestion
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Upload either your physical <strong>Student Identification Card</strong> (front or both sides) or an official screenshot of your student profile from the <strong>College ERP / SIS system</strong>. The submitted document is used to establish the academic and institutional details associated with your application.
                        </p>
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
                            <FileText className="w-4 h-4 text-black shrink-0" />
                            <span>Supported formats: High-resolution PNG, JPG, or PDF up to 10 MB with clear, legible text.</span>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#70D6FF] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    02
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Step 02 — Document Information Extraction
                                </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-neutral-100 border border-black text-neutral-700">
                                OCR Assistance
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Orbix uses its document-processing system to extract relevant attributes from the uploaded document: Student Full Name, College Name, Enrollment / Roll Number, Degree Course, and Academic Year. This helps structure the submitted information for verification and review.
                        </p>
                        <div className="p-4 rounded-xl bg-[#FFE566]/20 border border-black/30 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-black text-black">
                                <Sparkles className="w-4 h-4 text-amber-700" />
                                <span>Core Governance Rule: Assistance vs. Confirmation</span>
                            </div>
                            <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                                Automated extraction is an assistance mechanism, not a confirmation of authenticity. Extracted information alone does not qualify an application for approval. Every record is subject to manual human auditor review.
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#FFE566] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    03
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Step 03 — Verify Your Institutional Email
                                </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-neutral-100 border border-black text-neutral-700">
                                Email OTP
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Verify that you have active access to your college-associated email address. Orbix dispatches a time-limited one-time password (OTP) to your institutional email. Enter the OTP in the verification console to complete this step.
                        </p>
                    </div>

                    {/* Step 4 */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#FF70A6] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    04
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Step 04 — Verify Your Institutional Phone Number
                                </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-neutral-100 border border-black text-neutral-700">
                                Phone OTP
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Independently verify your college-associated mobile phone number through an SMS OTP. <strong>Institutional email and phone verification are separate requirements. Completing one does not automatically complete the other.</strong>
                        </p>
                    </div>

                    {/* Step 5 */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#a2ff86] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    05
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Step 05 — Submit Your Application
                                </h3>
                            </div>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-neutral-100 border border-black text-neutral-700">
                                Application Gate
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Once the document submission and both institutional contact-verification steps are complete, you can submit your application for review. <strong>Applications cannot be submitted without completing both mandatory email and phone verification requirements.</strong>
                        </p>
                    </div>

                    {/* Step 6 & 7 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-white font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    06
                                </span>
                                <h3 className="text-sm sm:text-base font-black text-black">
                                    Step 06 — Affiliation Review
                                </h3>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                An authorized Orbix verification reviewer examines the submitted document, OCR extraction accuracy, and associated verification evidence against national university directories.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-black text-[#a2ff86] font-mono font-black text-xs flex items-center justify-center border border-black shadow-[1px_1px_0px_#000]">
                                    07
                                </span>
                                <h3 className="text-sm sm:text-base font-black text-black">
                                    Step 07 — Verification Decision
                                </h3>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                Your application receives a final decision. Once approved, your student profile is updated with the <strong>College Verified</strong> badge across all leaderboards, clubs, and platform experiences.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* INTERACTIVE WORKBENCH: LIVE COMPONENT SHOWCASE                            */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/15">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#70D6FF] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000] mb-2">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Interactive Architecture Simulator</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-black">
                            College Verification Component Workbench
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                            Explore the exact UI components and multi-stage state machines that power the student verification process.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setEmailOtpVerified(true);
                                setPhoneOtpVerified(true);
                                setReviewerDecision("APPROVED");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EE] text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-white cursor-pointer"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Demo</span>
                        </button>
                    </div>
                </div>

                {/* Workbench Navigation Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-black/10">
                    {[
                        { id: "DOCUMENT", label: "1. Document Upload", icon: UploadCloud },
                        { id: "OCR_REVIEW", label: "2. OCR Assistance", icon: Sparkles },
                        { id: "CONTACT_INFO", label: "3. Dual Contact OTP", icon: Mail },
                        { id: "AUDIT_REVIEW", label: "4. Reviewer Console", icon: Eye },
                        { id: "VERIFIED_BADGE", label: "5. Verified Student Card", icon: ShieldCheck },
                    ].map((t) => {
                        const Icon = t.icon;
                        const isActive = activeWorkbenchTab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveWorkbenchTab(t.id as any)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black border-2 transition-all shrink-0 cursor-pointer ${
                                    isActive
                                        ? "bg-black text-[#a2ff86] border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 border-black/30 hover:border-black hover:bg-white"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab 1: Document Upload Component */}
                {activeWorkbenchTab === "DOCUMENT" && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-base font-black text-black">
                                Component: Academic Document Intake Dropzone
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium">
                                Accepts Student Identification Card or College ERP / SIS portal profile screenshot with mime-type checking.
                            </p>
                        </div>

                        {/* Interactive Document Type Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedDocType("student_id")}
                                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                    selectedDocType === "student_id"
                                        ? "bg-[#FFE566] border-black shadow-[3px_3px_0px_#000]"
                                        : "bg-white border-black/30 hover:border-black"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-black uppercase">Option A</span>
                                    {selectedDocType === "student_id" && <Check className="w-4 h-4 stroke-[3]" />}
                                </div>
                                <h5 className="text-sm font-black text-black">Physical Student ID Card</h5>
                                <p className="text-[11px] text-neutral-700 font-medium mt-1">
                                    Front side or front + reverse sides showing photo, roll number, and valid academic year.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedDocType("erp_profile")}
                                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                    selectedDocType === "erp_profile"
                                        ? "bg-[#FFE566] border-black shadow-[3px_3px_0px_#000]"
                                        : "bg-white border-black/30 hover:border-black"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-black uppercase">Option B</span>
                                    {selectedDocType === "erp_profile" && <Check className="w-4 h-4 stroke-[3]" />}
                                </div>
                                <h5 className="text-sm font-black text-black">College ERP Profile Screenshot</h5>
                                <p className="text-[11px] text-neutral-700 font-medium mt-1">
                                    Official student dashboard screenshot displaying enrollment code and verified enrollment status.
                                </p>
                            </button>
                        </div>

                        {/* Dropzone Component Preview */}
                        <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black flex flex-col items-center justify-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                <UploadCloud className="w-6 h-6 text-black" />
                            </div>
                            <div>
                                <h5 className="text-sm font-black text-black">
                                    {hasSimulatedUpload ? "psit_student_id_aarav_sharma.pdf" : "Drag & Drop Academic Document"}
                                </h5>
                                <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                    {hasSimulatedUpload
                                        ? "Uploaded successfully • 2.4 MB • Preview ready for OCR extraction"
                                        : "Supports PDF, PNG, or JPEG up to 10 MB with clear, legible text."}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-950 font-black text-[11px] border border-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>MIME Check: Valid PDF / Image</span>
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-100 text-cyan-950 font-black text-[11px] border border-cyan-400">
                                    <span>Resolution: 300 DPI</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: OCR Extraction & Review Component */}
                {activeWorkbenchTab === "OCR_REVIEW" && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h4 className="text-base font-black text-black">
                                    Component: Intelligent OCR Extraction & Candidate Review
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Extracted key attributes are previewed for student confirmation. Users can edit values before final dispatch.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                <span className="text-xs font-black">OCR Confidence: {DEMO_STUDENT.ocrConfidence}%</span>
                            </div>
                        </div>

                        {/* Side-by-Side: Raw Extraction vs Editable Form */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Raw OCR Stream */}
                            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                    <span className="text-xs font-black uppercase text-neutral-600">
                                        Raw OCR Sensor Output
                                    </span>
                                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-black">
                                        Tesseract + Vision Model
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs font-mono">
                                    <div className="p-2 rounded bg-white border border-black/20">
                                        <span className="text-neutral-500 font-bold block text-[10px]">RAW_NAME:</span>
                                        <span className="font-bold text-black">{DEMO_STUDENT.rawExtractedData.studentName}</span>
                                    </div>
                                    <div className="p-2 rounded bg-white border border-black/20">
                                        <span className="text-neutral-500 font-bold block text-[10px]">RAW_ENROLLMENT:</span>
                                        <span className="font-bold text-black">{DEMO_STUDENT.rawExtractedData.enrollmentNo}</span>
                                    </div>
                                    <div className="p-2 rounded bg-white border border-black/20">
                                        <span className="text-neutral-500 font-bold block text-[10px]">RAW_INSTITUTION:</span>
                                        <span className="font-bold text-black">{DEMO_STUDENT.rawExtractedData.collegeName}</span>
                                    </div>
                                    <div className="p-2 rounded bg-white border border-black/20">
                                        <span className="text-neutral-500 font-bold block text-[10px]">RAW_DEGREE_STREAM:</span>
                                        <span className="font-bold text-black">{DEMO_STUDENT.rawExtractedData.degree}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Candidate Review Form */}
                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                    <span className="text-xs font-black uppercase text-black">
                                        Structured Application Fields (Editable)
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        Confirm Accuracy
                                    </span>
                                </div>

                                <div className="space-y-2.5 text-xs font-bold">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                            Student Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={editableStudentName}
                                            onChange={(e) => setEditableStudentName(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-xs font-bold focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                            Enrollment / Roll Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={editableEnrollmentNo}
                                            onChange={(e) => setEditableEnrollmentNo(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-xs font-mono font-bold focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                            Degree & Specialization *
                                        </label>
                                        <input
                                            type="text"
                                            value={editableDegree}
                                            onChange={(e) => setEditableDegree(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-xs font-bold focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                            Academic Year *
                                        </label>
                                        <input
                                            type="text"
                                            value={editableYear}
                                            onChange={(e) => setEditableYear(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] text-xs font-bold focus:bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 3: Dual Contact OTP Component */}
                {activeWorkbenchTab === "CONTACT_INFO" && (
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <h4 className="text-base font-black text-black">
                                Component: Dual Institutional Contact OTP Verification
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium">
                                Both channels must reach verified status independently. One does not substitute for the other.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Institutional Email Card */}
                            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-black/10">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                                        <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                            Institutional Email
                                        </h5>
                                    </div>
                                    {emailOtpVerified ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#a2ff86] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000]">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Verified</span>
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                            Awaiting OTP
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-neutral-600 block">College Email Address</label>
                                    <p className="text-xs font-mono font-black text-black bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                                        {DEMO_STUDENT.institutionEmail}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-neutral-600 block">6-Digit Email OTP</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={simulatedEmailCode}
                                            onChange={(e) => setSimulatedEmailCode(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-black font-mono font-black text-center text-sm shadow-[1.5px_1.5px_0px_#000]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setEmailOtpVerified(!emailOtpVerified)}
                                            className="px-3.5 py-2 rounded-xl bg-[#FFE566] text-black font-black text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-[#ffe043] cursor-pointer"
                                        >
                                            {emailOtpVerified ? "Undo" : "Verify OTP"}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-medium">
                                        OTPs expire in 15 minutes • Single-use nonce protection
                                    </p>
                                </div>
                            </div>

                            {/* Institutional Phone Card */}
                            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-black/10">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-black stroke-[2.5]" />
                                        <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                            Institutional Phone
                                        </h5>
                                    </div>
                                    {phoneOtpVerified ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#a2ff86] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000]">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Verified</span>
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                            Awaiting OTP
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-neutral-600 block">Registered Phone Number</label>
                                    <p className="text-xs font-mono font-black text-black bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                                        {DEMO_STUDENT.institutionPhone}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-neutral-600 block">6-Digit Phone OTP</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={simulatedPhoneCode}
                                            onChange={(e) => setSimulatedPhoneCode(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-black font-mono font-black text-center text-sm shadow-[1.5px_1.5px_0px_#000]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setPhoneOtpVerified(!phoneOtpVerified)}
                                            className="px-3.5 py-2 rounded-xl bg-[#FFE566] text-black font-black text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-[#ffe043] cursor-pointer"
                                        >
                                            {phoneOtpVerified ? "Undo" : "Verify OTP"}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-medium">
                                        SMS gateway validated • Maximum 5 retry attempts
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 4: Reviewer Console Component */}
                {activeWorkbenchTab === "AUDIT_REVIEW" && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h4 className="text-base font-black text-black">
                                    Component: Authorized Reviewer Evaluation Queue
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Internal review interface used by authorized Orbix operations teams to inspect applications before granting verified standing.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase text-neutral-500">Simulate Decision:</span>
                                <NeoSelect
                                    value={reviewerDecision}
                                    onChange={(val) => setReviewerDecision(val as any)}
                                    options={[
                                        { value: "APPROVED", label: "Approve Affiliation" },
                                        { value: "PROCESSING", label: "Mark In-Processing" },
                                        { value: "PENDING", label: "Set Pending" },
                                        { value: "REJECTED", label: "Reject Application" },
                                    ]}
                                    size="sm"
                                    triggerClassName="bg-white text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* Reviewer Audit Checklist Card */}
                        <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-black stroke-[2.5]" />
                                    <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                        Applicant Audit File: #VER-2026-PSIT-1042
                                    </h5>
                                </div>
                                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-md border border-black shadow-[1px_1px_0px_#000] ${
                                    reviewerDecision === "APPROVED"
                                        ? "bg-[#a2ff86] text-black"
                                        : reviewerDecision === "REJECTED"
                                        ? "bg-rose-100 text-rose-950 border-rose-400"
                                        : "bg-amber-100 text-amber-950 border-amber-400"
                                }`}>
                                    Status: {reviewerDecision}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                                <div className="p-3 bg-white rounded-xl border border-black/20 flex items-center justify-between">
                                    <span>1. Document Legibility & Seal Inspection</span>
                                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-black/20 flex items-center justify-between">
                                    <span>2. AISHE National Directory Match</span>
                                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-black/20 flex items-center justify-between">
                                    <span>3. Institutional Email DKIM / SPF Valid</span>
                                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-black/20 flex items-center justify-between">
                                    <span>4. Independent Phone OTP Verified</span>
                                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 5: Verified Student Profile Preview */}
                {activeWorkbenchTab === "VERIFIED_BADGE" && (
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <h4 className="text-base font-black text-black">
                                Component: Verified Student Profile & Card View
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium">
                                Once approved, the student profile receives the iconic Blue Rosette Verified Badge and verified collegiate credential.
                            </p>
                        </div>

                        {/* Live Profile Card Representation */}
                        <div className="max-w-md mx-auto p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-xl font-black text-black">
                                        AS
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <h4 className="text-base font-black text-black">{DEMO_STUDENT.studentName}</h4>
                                            <VerifiedBadge size="sm" title="College Verified Student" />
                                        </div>
                                        <p className="text-xs font-mono font-bold text-neutral-600">@aarav_dev</p>
                                    </div>
                                </div>

                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#a2ff86] text-black font-black text-[10px] uppercase border border-black shadow-[1px_1px_0px_#000]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>College Verified</span>
                                </span>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1.5 text-xs font-bold">
                                <div className="flex items-center gap-1.5 text-black">
                                    <Building2 className="w-3.5 h-3.5 text-neutral-700" />
                                    <span className="truncate">{DEMO_STUDENT.collegeName}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-neutral-600 font-medium pt-1 border-t border-black/10">
                                    <span>AISHE Code: {DEMO_STUDENT.aisheCode}</span>
                                    <span>{DEMO_STUDENT.collegeCity}, {DEMO_STUDENT.collegeState}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-black/10 text-neutral-600">
                                <span>Enrollment: {DEMO_STUDENT.enrollmentNo}</span>
                                <span className="font-mono text-black">Batch: 2023 - 27</span>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: UNDERSTANDING VERIFICATION STATUS                              */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Understanding Verification Status
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    You can track the progress of your College Verification application through its current lifecycle state. Each status reflects an exact verification milestone within the platform engine.
                </p>

                {/* Status Matrix Table */}
                <div className="overflow-x-auto rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000] bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#FAF6EE] border-b-2 border-black text-black font-black uppercase tracking-wider">
                                <th className="p-3.5 border-r-2 border-black w-44">Status</th>
                                <th className="p-3.5 border-r-2 border-black">Description & Operational Meaning</th>
                                <th className="p-3.5 w-40">Profile Effect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black/10 font-bold">
                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-neutral-100 text-neutral-700 shadow-[1.5px_1.5px_0px_#000]">
                                        Not Verified
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    No active college verification application has been submitted or approved for this account.
                                </td>
                                <td className="p-3.5 text-neutral-600 font-medium">Standard student badge</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-amber-100 text-amber-950 shadow-[1.5px_1.5px_0px_#000]">
                                        <Clock className="w-3.5 h-3.5 text-amber-800" />
                                        Pending
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Your application has been received and is awaiting intake processing in the reviewer queue.
                                </td>
                                <td className="p-3.5 text-neutral-600 font-medium">Under Review indicator</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-cyan-100 text-cyan-950 shadow-[1.5px_1.5px_0px_#000]">
                                        <Sparkles className="w-3.5 h-3.5 text-cyan-800" />
                                        Processing
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Your application is actively undergoing document review and institutional directory cross-matching.
                                </td>
                                <td className="p-3.5 text-neutral-600 font-medium">Under Review indicator</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000]">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Approved
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Your college affiliation has been confirmed. You hold verified collegiate status on Orbix.
                                </td>
                                <td className="p-3.5 text-emerald-800 font-black">
                                    <div className="flex items-center gap-1">
                                        <VerifiedBadge size="xs" />
                                        <span>College Verified</span>
                                    </div>
                                </td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-rose-100 text-rose-950 shadow-[1.5px_1.5px_0px_#000]">
                                        <XCircle className="w-3.5 h-3.5 text-rose-800" />
                                        Rejected
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Your application could not be approved due to document illegibility, mismatched details, or unverified contact ownership. Re-application is permitted.
                                </td>
                                <td className="p-3.5 text-rose-700 font-bold">Unverified</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black bg-amber-100 text-amber-950 shadow-[1.5px_1.5px_0px_#000]">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
                                        Invalidated
                                    </span>
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    A previously approved verification is no longer valid (e.g. because you changed your registered college or updated core identity parameters).
                                </td>
                                <td className="p-3.5 text-amber-800 font-bold">Re-verification required</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: CHANGING YOUR COLLEGE & 72-HOUR SAFEGUARD                      */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Changing Your College & The 72-Hour Safeguard
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Your College Verification status is intrinsically bound to the specific institution recorded on your student profile. When a student transfers, completes their studies, or changes their registered institution, the system enforces automated fair-play rules.
                </p>

                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    <h4 className="text-sm sm:text-base font-black text-black">
                        What Happens When a College Change is Initiated:
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-neutral-800">
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-start gap-2.5">
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span><strong>Immediate Invalidation:</strong> Your previous college verification approval is instantly invalidated.</span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span><strong>Status Removal:</strong> Your account no longer retains the previous institution&apos;s verified badge or chapter access.</span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <span><strong>Audit Ledger Preservation:</strong> Your historical verification audit log is permanently preserved for accountability.</span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-start gap-2.5">
                            <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                            <span><strong>72-Hour Cooldown:</strong> A mandatory 72-hour cooldown applies before any new college verification request can be submitted.</span>
                        </div>
                    </div>

                    <p className="text-xs text-neutral-600 font-medium leading-relaxed pt-2">
                        * The 72-hour cooldown prevents intentional leaderboard manipulation, unauthorized festival hopping during Pan-India campus hackathons, and fraudulent badge swapping.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: SECURITY AND DATA PROTECTION                                   */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        06
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Security and Data Protection
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Student documents and verification records are handled through a dedicated, isolated verification infrastructure. Orbix applies strict access restrictions and security controls to protect submitted personal and academic data.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Restricted Document Storage</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Uploaded verification documents are stored in private encrypted storage and are never exposed publicly. Access is granted strictly to authorized reviewers through signed URLs.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Fingerprint className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Independent OTP Verification</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Institutional email and phone verification use dedicated, decoupled verification records, separate from standard account login and recovery mechanisms.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Time-Limited OTP Expiration</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Verification OTPs expire after 15 minutes, are strictly single-use nonces, and enforce a maximum ceiling of five failed attempts before lockout.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Document Validation & MIME Guard</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            All uploaded files undergo magic-byte signature validation to block spoofed or disguised executable files and ensure valid PDF or image structure.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Controlled Human Approval</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Final verification approval is restricted to authorized operations reviewers and is subject to immutable database audit logging.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-black stroke-[2.5]" />
                            <h4 className="text-xs font-black uppercase text-black">Tamper-Proof Audit History</h4>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            Every approval, rejection, and invalidation event is recorded with an immutable timestamp, reviewer identification, and audit rationale.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 7: WHAT COLLEGE VERIFICATION DOES NOT USE                         */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        07
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        What College Verification Does Not Use
                    </h2>
                </div>

                <div className="p-6 sm:p-8 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-4">
                    <h3 className="text-lg sm:text-xl font-black text-black">
                        Ethical Boundaries & Privacy Guarantees
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                        Orbix College Verification does not introduce government Aadhaar-based identification, national identity scraping, biometric facial recognition, or video liveness surveillance.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="p-4 rounded-xl bg-white border-2 border-black flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <span className="text-xs font-black text-black">NO Aadhaar Numbers or Government National IDs</span>
                        </div>
                        <div className="p-4 rounded-xl bg-white border-2 border-black flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <span className="text-xs font-black text-black">NO Biometric Facial Recognition or Liveness Tracking</span>
                        </div>
                    </div>

                    <p className="text-xs text-neutral-600 font-medium pt-1">
                        The process relies purely on official student identification or institutional ERP evidence, institutional email and phone verification, and authorized manual review. OCR extraction supports document processing but does not independently establish whether a student is genuine.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 8: COLLEGE VERIFICATION VS ACCOUNT VERIFICATION                   */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#70D6FF] font-mono font-black text-xs">
                        08
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        College Verification vs. Account Verification
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    College Verification and standard Orbix account verification serve different purposes within the platform architecture.
                </p>

                <div className="overflow-x-auto rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000] bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#FAF6EE] border-b-2 border-black text-black font-black uppercase tracking-wider">
                                <th className="p-3.5 border-r-2 border-black w-56">Verification Channel</th>
                                <th className="p-3.5 border-r-2 border-black">Target Purpose</th>
                                <th className="p-3.5 w-44">System Scope</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black/10 font-bold">
                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">Account Email Verification</td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Confirms ownership and access to the primary account email address for login and password recovery.
                                </td>
                                <td className="p-3.5 text-neutral-600 font-medium">Core Authentication</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black">Account Phone Verification</td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Confirms the account&apos;s registered phone number for two-factor authentication and security notifications.
                                </td>
                                <td className="p-3.5 text-neutral-600 font-medium">Security & 2FA</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black bg-[#70D6FF]/10 text-cyan-950 font-black">
                                    College Email Verification
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Confirms active access to the institution-associated email address issued by your college.
                                </td>
                                <td className="p-3.5 text-black font-black">Collegiate Trust</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black bg-[#70D6FF]/10 text-cyan-950 font-black">
                                    College Phone Verification
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Confirms access to the institution-associated phone number registered on academic records.
                                </td>
                                <td className="p-3.5 text-black font-black">Collegiate Trust</td>
                            </tr>

                            <tr className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3.5 border-r-2 border-black bg-[#a2ff86]/20 text-emerald-950 font-black">
                                    College Document Review
                                </td>
                                <td className="p-3.5 border-r-2 border-black text-neutral-700">
                                    Establishes documentary evidence of enrollment and institutional affiliation through human audit.
                                </td>
                                <td className="p-3.5 text-emerald-900 font-black">Collegiate Trust</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                    * Completing standard account verification does not automatically grant College Verified status. Similarly, College Verification does not replace or modify your account&apos;s existing security credentials.
                </p>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 9: GETTING STARTED & ACCOUNT CENTER ACTION                        */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        09
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Getting Started with College Verification
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Ready to verify your institutional affiliation and unlock the College Verified badge on your profile? Follow these steps:
                </p>

                <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-3">
                    <ol className="space-y-2.5 text-xs sm:text-sm font-bold text-neutral-800 list-decimal list-inside">
                        <li>Sign in to your Orbix student account.</li>
                        <li>Open the <strong>Account Center</strong> or navigate to <strong>Settings &rarr; Collegiate Enrollment & Verification</strong>.</li>
                        <li>Select <strong>Verify College Affiliation</strong> to launch the verification console.</li>
                        <li>Upload your student identification card or official college ERP profile screenshot.</li>
                        <li>Review OCR-extracted attributes and complete institutional email & phone OTP verification.</li>
                        <li>Submit your application for review by the Orbix operations team.</li>
                        <li>Track your real-time verification status through your account dashboard.</li>
                    </ol>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Instant access from Settings &rarr; Collegiate Enrollment & Verification</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/settings?tab=account"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                        >
                            <span>Open Settings</span>
                        </Link>

                        <button
                            type="button"
                            onClick={handleLaunchLiveVerification}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer"
                        >
                            <GraduationCap className="w-4 h-4 stroke-[2.5]" />
                            <span>Launch Verification Modal</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* CLOSING VISION                                                            */}
            {/* ========================================================================= */}
            <div className="p-8 rounded-3xl bg-[#a2ff86] border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] text-black space-y-3">
                <h3 className="text-xl sm:text-2xl font-black">
                    Building a More Trusted Student Ecosystem
                </h3>
                <p className="text-xs sm:text-sm font-medium leading-relaxed">
                    At Orbix, trust is an essential part of building meaningful student communities. College Verification is designed to help establish that trust through institutional evidence, independent verification, and controlled review — creating a more credible environment for students and college-related activities across the platform.
                </p>
            </div>
        </article>
    );
};

export default CollegeVerificationDocumentary;
