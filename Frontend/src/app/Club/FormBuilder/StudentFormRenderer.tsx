import React, { useState, useEffect } from "react";
import {
    CheckCircle2,
    Calendar,
    MapPin,
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    UploadCloud,
    Paperclip,
    Trash2,
    Check,
    Ticket,
    Copy,
    ShieldCheck,
    School,
    GraduationCap,
    ExternalLink,
    Edit3,
    FileText,
    Sparkles,
    Star,
    Heart,
    ThumbsUp,
    Award,
} from "lucide-react";
import type {
    ClubEventFormRecord,
    FormQuestion,
    FormSection,
    FileAttachmentMeta,
    StudentIdentityProfile,
} from "../../../api/clubEventFormApi";
import {
    requestAttachmentUploadSignature,
    uploadFileToCloudinary,
    submitEventFormResponse,
} from "../../../api/clubEventFormApi";
import { useToast } from "../../../context/ToastContext";
import { OrbixLoader } from "../../../components/ui/loader";

export interface StudentFormRendererProps {
    form: ClubEventFormRecord;
    event: any;
    club?: any;
    user?: any;
    studentProfile?: StudentIdentityProfile | null;
    userResponse?: any;
    isPreview?: boolean;
    isClosed?: boolean;
    closedReason?: string;
    onSuccess?: (registration: any) => void;
    onCancel?: () => void;
}

const getYouTubeEmbedUrl = (url?: string): string | null => {
    if (!url) return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
    } catch {
        return null;
    }
};

export const StudentFormRenderer: React.FC<StudentFormRendererProps> = ({
    form,
    event,
    club,
    user,
    studentProfile,
    userResponse,
    isPreview = false,
    isClosed = false,
    closedReason,
    onSuccess,
    onCancel,
}) => {
    const toast = useToast();

    // Sections and active section index
    const sections: FormSection[] = form.structure?.sections || [];
    const [currentSecIdx, setCurrentSecIdx] = useState(0);
    const [sectionHistory, setSectionHistory] = useState<number[]>([0]);

    // Answers state: questionId -> value
    const [answers, setAnswers] = useState<Record<string, any>>(() => {
        return userResponse?.answers || userResponse?.formResponse || {};
    });

    // File attachments state: array of FileAttachmentMeta
    const [fileAttachments, setFileAttachments] = useState<FileAttachmentMeta[]>(() => {
        return userResponse?.fileAttachments || [];
    });

    // Uploading state: questionId -> percent
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Submission states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedRegistration, setSubmittedRegistration] = useState<any>(userResponse || null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [copiedTicket, setCopiedTicket] = useState(false);
    const [showIdentityEditor, setShowIdentityEditor] = useState(false);

    // Resolved student identity details combining studentProfile and user store
    const effectiveProfile = {
        fullName:
            studentProfile?.fullName ||
            (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.username) ||
            "Student",
        username: studentProfile?.username || user?.username || "orbix_student",
        email: studentProfile?.email || user?.gmail || user?.email || "",
        avatarUrl:
            studentProfile?.avatarUrl ||
            user?.photoUrl ||
            user?.avatar_url ||
            "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png",
        college: studentProfile?.college || user?.college || "Independent Student",
        rollNumber: studentProfile?.rollNumber || user?.roll_number || null,
        department: studentProfile?.department || user?.department || null,
        yearOfStudy: studentProfile?.yearOfStudy || user?.year_of_study || null,
        phoneNumber: studentProfile?.phoneNumber || user?.phone || null,
        github: studentProfile?.github || user?.github || null,
        linkedin: studentProfile?.linkedin || user?.linkedin || null,
        website: studentProfile?.website || user?.website || null,
        resumeUrl: studentProfile?.resumeUrl || null,
        resumeFilename: studentProfile?.resumeFilename || "Verified_Resume.pdf",
        isVerifiedCampus: studentProfile?.isVerifiedCampus ?? Boolean(studentProfile?.collegeId),
    };

    // Auto-fill student profile info & custom question matching if empty
    useEffect(() => {
        if (!userResponse) {
            setAnswers((prev) => {
                const next = { ...prev };

                if (!next["q_student_name"] && effectiveProfile.fullName) {
                    next["q_student_name"] = effectiveProfile.fullName;
                }
                if (!next["q_student_email"] && effectiveProfile.email) {
                    next["q_student_email"] = effectiveProfile.email;
                }
                if (!next["q_roll_number"] && effectiveProfile.rollNumber) {
                    next["q_roll_number"] = effectiveProfile.rollNumber;
                }
                if (!next["q_department"] && effectiveProfile.department) {
                    next["q_department"] = effectiveProfile.department;
                }
                if (!next["q_year"] && effectiveProfile.yearOfStudy) {
                    next["q_year"] = effectiveProfile.yearOfStudy;
                }
                if (!next["q_phone"] && effectiveProfile.phoneNumber) {
                    next["q_phone"] = effectiveProfile.phoneNumber;
                }

                // Check questions across all sections to auto-fill matching profile fields
                sections.forEach((sec) => {
                    sec.questions.forEach((q) => {
                        const titleLower = q.title.toLowerCase();
                        if (!next[q.id]) {
                            if (titleLower.includes("github") && effectiveProfile.github) {
                                next[q.id] = effectiveProfile.github.startsWith("http")
                                    ? effectiveProfile.github
                                    : `https://github.com/${effectiveProfile.github}`;
                            } else if (titleLower.includes("linkedin") && effectiveProfile.linkedin) {
                                next[q.id] = effectiveProfile.linkedin.startsWith("http")
                                    ? effectiveProfile.linkedin
                                    : `https://linkedin.com/in/${effectiveProfile.linkedin}`;
                            } else if ((titleLower.includes("portfolio") || titleLower.includes("website")) && effectiveProfile.website) {
                                next[q.id] = effectiveProfile.website;
                            } else if (titleLower.includes("roll number") && effectiveProfile.rollNumber) {
                                next[q.id] = effectiveProfile.rollNumber;
                            } else if ((titleLower.includes("department") || titleLower.includes("branch")) && effectiveProfile.department) {
                                next[q.id] = effectiveProfile.department;
                            } else if ((titleLower.includes("year") || titleLower.includes("semester")) && effectiveProfile.yearOfStudy) {
                                next[q.id] = effectiveProfile.yearOfStudy;
                            } else if ((titleLower.includes("phone") || titleLower.includes("mobile") || titleLower.includes("whatsapp")) && effectiveProfile.phoneNumber) {
                                next[q.id] = effectiveProfile.phoneNumber;
                            }
                        }
                    });
                });

                return next;
            });
        }
    }, [user, studentProfile, userResponse, sections]);

    // Flatten custom questions for assessment results
    const allQuestions = React.useMemo(() => {
        const list: FormQuestion[] = [];
        (form.structure?.sections || []).forEach((sec) => {
            sec.questions.forEach((q) => {
                if (
                    q.type !== "title_card" &&
                    q.type !== "image_block" &&
                    q.type !== "video_block" &&
                    q.type !== "markdown_card" &&
                    q.type !== "image_card"
                ) {
                    list.push(q);
                }
            });
        });
        return list;
    }, [form.structure]);

    const isQuiz = Boolean(form.settings?.quiz?.isQuiz);
    const gradesReleased =
        Boolean(submittedRegistration?.quizGradesReleased) ||
        form.settings?.quiz?.releaseGrades === "immediately";

    // Autosave progress in browser storage if enabled
    useEffect(() => {
        if (!userResponse && !submittedRegistration && form.settings?.presentation?.autosaveProgress !== false) {
            try {
                const saved = localStorage.getItem(`orbix_form_draft_${form.eventId}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && typeof parsed === "object") {
                        setAnswers((prev) => ({ ...parsed, ...prev }));
                    }
                }
            } catch {}
        }
    }, [form.eventId, userResponse, submittedRegistration]);

    useEffect(() => {
        if (!userResponse && !submittedRegistration && form.settings?.presentation?.autosaveProgress !== false) {
            try {
                if (Object.keys(answers).length > 0) {
                    localStorage.setItem(`orbix_form_draft_${form.eventId}`, JSON.stringify(answers));
                }
            } catch {}
        }
    }, [answers, form.eventId, userResponse, submittedRegistration]);

    const activeSection: FormSection | undefined = sections[currentSecIdx];
    const totalSections = sections.length;
    const accentColor = form.themeSettings?.accentColor || "#38BDF8";

    // Handle answer change
    const setAnswer = (questionId: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
        if (validationErrors[questionId]) {
            setValidationErrors((prev) => {
                const copy = { ...prev };
                delete copy[questionId];
                return copy;
            });
        }
    };

    // File Upload Handler
    const handleFileUpload = async (question: FormQuestion, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Max size check
        const maxMb = question.validation?.maxFileSizeMb ?? 10;
        if (file.size > maxMb * 1024 * 1024) {
            toast.error(`File size exceeds limit of ${maxMb} MB.`);
            return;
        }

        try {
            setUploadProgress((prev) => ({ ...prev, [question.id]: 1 }));
            const signatureConfig = await requestAttachmentUploadSignature(form.eventId, question.id, file.type);
            const uploaded = await uploadFileToCloudinary(signatureConfig, file, (percent) => {
                setUploadProgress((prev) => ({ ...prev, [question.id]: percent }));
            });

            const newAttachment: FileAttachmentMeta = {
                questionId: question.id,
                questionTitle: question.title,
                fileName: uploaded.fileName,
                fileUrl: uploaded.secureUrl,
                filePublicId: uploaded.publicId,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
            };

            setFileAttachments((prev) => [
                ...prev.filter((f) => f.questionId !== question.id),
                newAttachment,
            ]);
            setAnswer(question.id, uploaded.secureUrl);
            toast.success(`Attached "${file.name}"!`);
        } catch (err: any) {
            toast.error(err.message || "File upload failed.");
        } finally {
            setUploadProgress((prev) => {
                const copy = { ...prev };
                delete copy[question.id];
                return copy;
            });
            e.target.value = "";
        }
    };

    const handleRemoveFile = (questionId: string) => {
        setFileAttachments((prev) => prev.filter((f) => f.questionId !== questionId));
        setAnswer(questionId, undefined);
    };

    // Validate current section before navigating forward or submitting
    const validateSection = (sec: FormSection): boolean => {
        const errors: Record<string, string> = {};

        for (const q of sec.questions) {
            if (q.type === "image_card" || q.type === "markdown_card") continue;

            const val = answers[q.id];
            const isProvided = val !== undefined && val !== null && (typeof val === "string" ? val.trim() !== "" : true);

            if (q.required) {
                if (q.type === "file_upload") {
                    const hasFile = fileAttachments.some((f) => f.questionId === q.id);
                    if (!hasFile) errors[q.id] = "This question requires an uploaded file.";
                } else if (!isProvided) {
                    errors[q.id] = "This question is required.";
                }
            }

            // String length checks
            if (typeof val === "string" && val.trim().length > 0) {
                if (q.validation?.minLength && val.trim().length < q.validation.minLength) {
                    errors[q.id] = `Must be at least ${q.validation.minLength} characters.`;
                }
                if (q.validation?.maxLength && val.trim().length > q.validation.maxLength) {
                    errors[q.id] = `Must not exceed ${q.validation.maxLength} characters.`;
                }
                if (q.validation?.pattern) {
                    try {
                        const regex = new RegExp(q.validation.pattern);
                        if (!regex.test(val.trim())) {
                            errors[q.id] = q.validation.patternError || "Invalid format.";
                        }
                    } catch {}
                }
            }

            // Checkbox limits
            if (q.type === "checkboxes" && Array.isArray(val)) {
                if (q.validation?.minSelected && val.length < q.validation.minSelected) {
                    errors[q.id] = `Please select at least ${q.validation.minSelected} options.`;
                }
                if (q.validation?.maxSelected && val.length > q.validation.maxSelected) {
                    errors[q.id] = `Please select at most ${q.validation.maxSelected} options.`;
                }
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Next Section or Submit
    const handleNext = async () => {
        if (!activeSection) return;
        if (!validateSection(activeSection)) {
            toast.error("Please answer all required questions before proceeding.");
            return;
        }

        // Determine next destination based on answer branching rules
        let nextDestination: string | number = "next_section";

        for (const q of activeSection.questions) {
            if (q.options && (q.type === "multiple_choice" || q.type === "dropdown")) {
                const selectedVal = answers[q.id];
                const matchedOption = q.options.find((o) => o.text === selectedVal);
                if (matchedOption?.goToSectionId) {
                    nextDestination = matchedOption.goToSectionId;
                    break;
                }
            }
        }

        if (nextDestination === "next_section") {
            nextDestination = activeSection.afterSectionAction || "next_section";
        }

        if (nextDestination === "submit_form" || currentSecIdx === totalSections - 1) {
            await handleSubmit();
            return;
        }

        // Find target section index
        let targetIdx = currentSecIdx + 1;
        if (typeof nextDestination === "string" && nextDestination !== "next_section") {
            const foundIdx = sections.findIndex((s) => s.id === nextDestination);
            if (foundIdx !== -1) targetIdx = foundIdx;
        }

        if (targetIdx < totalSections) {
            setSectionHistory((prev) => [...prev, targetIdx]);
            setCurrentSecIdx(targetIdx);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            await handleSubmit();
        }
    };

    // Back Section
    const handleBack = () => {
        if (sectionHistory.length > 1) {
            const newHistory = [...sectionHistory];
            newHistory.pop();
            const prevIdx = newHistory[newHistory.length - 1];
            setSectionHistory(newHistory);
            setCurrentSecIdx(prevIdx);
        } else if (currentSecIdx > 0) {
            setCurrentSecIdx(currentSecIdx - 1);
        }
    };

    // Form Submission
    const handleSubmit = async () => {
        const studentName = answers["q_student_name"] || effectiveProfile.fullName || "Student";
        const studentEmail = answers["q_student_email"] || effectiveProfile.email || "";

        if (isPreview) {
            toast.success("Preview response simulated successfully! (Preview Mode)", {
                title: "Form Submission Simulation",
            });
            setSubmittedRegistration({
                ticketCode: "PREVIEW-PASS",
                status: "pending",
                applicantName: studentName,
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await submitEventFormResponse(form.eventId, {
                applicantName: studentName,
                applicantEmail: studentEmail,
                department: answers["q_department"] || effectiveProfile.department || undefined,
                yearOfStudy: answers["q_year"] || effectiveProfile.yearOfStudy || undefined,
                rollNumber: answers["q_roll_number"] || effectiveProfile.rollNumber || undefined,
                phoneNumber: answers["q_phone"] || effectiveProfile.phoneNumber || undefined,
                notes: answers["q_notes"] || undefined,
                answers,
                fileAttachments,
            });

            setSubmittedRegistration(res.registration);
            try {
                localStorage.removeItem(`orbix_form_draft_${form.eventId}`);
            } catch {}
            toast.success(res.message || "Registration submitted successfully!");
            if (onSuccess) {
                onSuccess(res.registration);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to submit registration.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Copy Ticket Code
    const handleCopyTicket = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedTicket(true);
        toast.success("Ticket code copied!");
        setTimeout(() => setCopiedTicket(false), 2000);
    };

    // -------------------------------------------------------------------------
    // RENDER: SUCCESS SCREEN
    // -------------------------------------------------------------------------
    if (submittedRegistration) {
        return (
            <div className="max-w-xl mx-auto rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-6 sm:p-8 text-center space-y-6">
                <div
                    className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_#000]"
                    style={{ backgroundColor: accentColor }}
                >
                    <CheckCircle2 className="w-9 h-9 text-black stroke-[2.5]" />
                </div>

                <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full text-black bg-[#a2ff86] border border-black text-xs font-black uppercase tracking-wider">
                        Registration Confirmed
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-black">
                        {form.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-700 font-medium whitespace-pre-line">
                        {form.settings?.confirmationMessage || "Your registration has been submitted successfully!"}
                    </p>
                </div>

                {/* Ticket Pass Box */}
                {submittedRegistration.ticketCode && (
                    <div className="p-5 rounded-2xl border-2 border-black bg-neutral-50 shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between text-xs font-black text-neutral-500 uppercase tracking-wider">
                            <span>Your Entry Pass</span>
                            <Ticket className="w-4 h-4 text-black" />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <span className="font-mono text-xl sm:text-2xl font-black text-black tracking-widest bg-white px-4 py-2 rounded-xl border border-black shadow-inner">
                                {submittedRegistration.ticketCode}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopyTicket(submittedRegistration.ticketCode)}
                                className="p-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] shadow-[2px_2px_0px_#000] cursor-pointer"
                                title="Copy Pass Code"
                            >
                                {copiedTicket ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
                            </button>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-medium block">
                            Present this ticket code or QR pass at the entrance during event check-in.
                        </span>
                    </div>
                )}

                {/* Quiz Assessment Result Card */}
                {isQuiz && (
                    <div className="p-5 rounded-2xl border-2 border-black bg-[#F0FDF4] shadow-[3px_3px_0px_#16A34A] space-y-4 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#16A34A]/20 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-2 rounded-xl bg-[#22C55E] border border-black text-black">
                                    <Award className="w-5 h-5" />
                                </span>
                                <div>
                                    <h4 className="text-sm sm:text-base font-black text-black">Quiz Assessment Result</h4>
                                    <p className="text-[11px] text-neutral-600 font-medium">Evaluation and score breakdown</p>
                                </div>
                            </div>
                            {gradesReleased ? (
                                <div className="text-right">
                                    <span className="text-xl sm:text-2xl font-black text-[#15803D]">
                                        {submittedRegistration.quizScore ?? 0} / {submittedRegistration.quizMaxScore ?? 0}
                                    </span>
                                    <span className="block text-[11px] font-bold text-neutral-500">
                                        ({Math.round(((submittedRegistration.quizScore ?? 0) / (submittedRegistration.quizMaxScore || 1)) * 100)}%)
                                    </span>
                                </div>
                            ) : (
                                <span className="text-xs font-black bg-amber-100 text-amber-800 px-3 py-1 rounded-xl border border-amber-300">
                                    Review in Progress
                                </span>
                            )}
                        </div>

                        {!gradesReleased && (
                            <p className="text-xs text-neutral-600 font-medium bg-white p-3 rounded-xl border border-black/20">
                                ⏳ Written and subjective answers are currently being evaluated by event staff. Your final score will be released here once review is complete.
                            </p>
                        )}

                        {gradesReleased && submittedRegistration.quizGradedAnswers && (
                            <div className="space-y-3 pt-1">
                                <h5 className="text-xs font-black uppercase tracking-wider text-black">Question Breakdown:</h5>
                                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                    {allQuestions.map((q) => {
                                        const gradedInfo = submittedRegistration.quizGradedAnswers?.[q.id];
                                        if (!gradedInfo) return null;
                                        const isCorrect = Boolean(gradedInfo.isCorrect);

                                        return (
                                            <div
                                                key={q.id}
                                                className={`p-3 rounded-xl border-2 space-y-2 ${
                                                    isCorrect
                                                        ? "bg-white border-[#16A34A]"
                                                        : "bg-rose-50 border-rose-300"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-xs font-black text-black">{q.title}</span>
                                                    <span
                                                        className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                                                            isCorrect
                                                                ? "bg-[#DCFCE7] text-[#15803D] border-[#16A34A]"
                                                                : "bg-rose-100 text-rose-800 border-rose-300"
                                                        }`}
                                                    >
                                                        {gradedInfo.earnedPoints ?? 0} / {gradedInfo.maxPoints ?? q.points ?? 1} pts
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-medium text-neutral-700">
                                                    <strong>Your answer:</strong>{" "}
                                                    {Array.isArray(gradedInfo.studentAnswer)
                                                        ? gradedInfo.studentAnswer.join(", ")
                                                        : String(gradedInfo.studentAnswer ?? "(No answer provided)")}
                                                </div>
                                                {form.settings?.quiz?.showCorrectAnswers && !isCorrect && q.correctAnswers && q.correctAnswers.length > 0 && (
                                                    <div className="text-[11px] font-bold text-emerald-800">
                                                        ✓ <strong>Correct answer:</strong> {q.correctAnswers.join(", ")}
                                                    </div>
                                                )}
                                                {gradedInfo.feedback && (
                                                    <div className="text-[11px] font-medium text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-black/10">
                                                        💡 {gradedInfo.feedback}
                                                    </div>
                                                )}
                                                {gradedInfo.links && gradedInfo.links.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {gradedInfo.links.map((link: any, idx: number) => (
                                                            <a
                                                                key={idx}
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 hover:underline"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                {link.title || link.url}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    {form.settings?.allowEditResponse && (
                        <button
                            type="button"
                            onClick={() => setSubmittedRegistration(null)}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-black font-black text-xs hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Edit Your Response
                        </button>
                    )}
                    {form.settings?.presentation?.showSubmitAnotherLink && !form.settings?.limitOneResponse && (
                        <button
                            type="button"
                            onClick={() => {
                                setSubmittedRegistration(null);
                                setAnswers({});
                                setFileAttachments([]);
                                setCurrentSecIdx(0);
                                setSectionHistory([0]);
                            }}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-black font-black text-xs hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Submit Another Response
                        </button>
                    )}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-black text-white font-black text-xs hover:bg-neutral-800 shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: CLOSED SCREEN
    // -------------------------------------------------------------------------
    if (isClosed && !isPreview) {
        return (
            <div className="max-w-xl mx-auto rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-300 border-2 border-black shadow-[3px_3px_0px_#000] mx-auto flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-black stroke-[2.5]" />
                </div>
                <h3 className="text-xl font-black text-black">Registration Closed</h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-medium whitespace-pre-line">
                    {closedReason || form.settings?.closedMessage || "Registrations are currently closed for this event."}
                </p>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2 rounded-xl border-2 border-black font-black text-xs hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Back
                    </button>
                )}
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: ACTIVE FORM RESPONDER
    // -------------------------------------------------------------------------
    const progressPercent = totalSections > 1 ? Math.round(((currentSecIdx + 1) / totalSections) * 100) : 100;

    return (
        <div className="max-w-2xl mx-auto space-y-6 text-black">
            {/* Header Banner if present */}
            {form.headerImageUrl && (
                <div className="rounded-3xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] bg-neutral-100">
                    <img
                        src={form.headerImageUrl}
                        alt="Form Banner"
                        className="w-full h-36 sm:h-48 object-cover"
                    />
                </div>
            )}

            {/* Form Title & Context Card */}
            <div
                className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 sm:p-7 space-y-3 relative overflow-hidden"
                style={{ borderTopWidth: "6px", borderTopColor: accentColor }}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-100 border border-black">
                        {club?.name || "Verified Club Event"}
                    </span>
                    {isPreview && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black">
                            Simulator / Preview Mode
                        </span>
                    )}
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                    {form.title}
                </h1>

                {form.description && (
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium whitespace-pre-line leading-relaxed">
                        {form.description}
                    </p>
                )}

                {/* Event Summary Details */}
                <div className="pt-3 border-t border-black/10 flex flex-wrap items-center gap-3 text-xs font-bold text-neutral-700">
                    <span className="flex items-center gap-1.5 bg-[#FAF6EE] px-2.5 py-1 rounded-xl border border-black/20">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        {event?.startsAt ? new Date(event.startsAt).toLocaleDateString() : "Upcoming Date"}
                    </span>
                    <span className="flex items-center gap-1.5 bg-[#FAF6EE] px-2.5 py-1 rounded-xl border border-black/20">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                        {event?.venueOrLocation || "Campus"}
                    </span>
                </div>
            </div>

            {/* Verified Orbix Student Identity Card */}
            <div className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#a2ff86] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-black flex items-center gap-1.5">
                                Verified Orbix Student Identity
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Orbix Verified
                                </span>
                            </h3>
                            <p className="text-[11px] text-neutral-500 font-medium">
                                Pre-populated from your authenticated student account.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowIdentityEditor((prev) => !prev)}
                        className="text-xs font-black text-neutral-700 hover:text-black flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{showIdentityEditor ? "Hide overrides" : "Edit details for this event"}</span>
                    </button>
                </div>

                {/* Primary Identity Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Name & Avatar */}
                    <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-black/20 flex items-center gap-3">
                        <img
                            src={effectiveProfile.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-xl border border-black object-cover shrink-0"
                        />
                        <div className="min-w-0">
                            <p className="font-black text-black truncate text-sm">
                                {effectiveProfile.fullName || "Student"}
                            </p>
                            <p className="text-[11px] font-bold text-neutral-500 truncate">
                                @{effectiveProfile.username}
                            </p>
                        </div>
                    </div>

                    {/* Email */}
                    <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-black/20 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-black text-neutral-500 tracking-wider block">
                                Campus Email
                            </span>
                            <p className="font-black text-black truncate text-xs">
                                {effectiveProfile.email || "No email provided"}
                            </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                            Verified
                        </span>
                    </div>

                    {/* College / Institution */}
                    <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-black/20 flex items-center gap-2.5">
                        <School className="w-5 h-5 text-neutral-600 shrink-0" />
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-black text-neutral-500 tracking-wider block">
                                College / Campus
                            </span>
                            <p className="font-black text-black truncate text-xs">
                                {effectiveProfile.college || "Independent Student"}
                            </p>
                        </div>
                    </div>

                    {/* Academic Details (Roll Number / Dept / Year) */}
                    <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-black/20 flex items-center gap-2.5">
                        <GraduationCap className="w-5 h-5 text-neutral-600 shrink-0" />
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-black text-neutral-500 tracking-wider block">
                                Academic Record
                            </span>
                            <p className="font-black text-black truncate text-xs">
                                {answers["q_roll_number"] || effectiveProfile.rollNumber
                                    ? `Roll: ${answers["q_roll_number"] || effectiveProfile.rollNumber}`
                                    : "Roll not set"}
                                {answers["q_department"] || effectiveProfile.department
                                    ? ` • ${answers["q_department"] || effectiveProfile.department}`
                                    : ""}
                                {answers["q_year"] || effectiveProfile.yearOfStudy
                                    ? ` (${answers["q_year"] || effectiveProfile.yearOfStudy})`
                                    : ""}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Verified Links Chips (GitHub, LinkedIn, Resume) */}
                {(effectiveProfile.github || effectiveProfile.linkedin || effectiveProfile.resumeUrl) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="text-[11px] font-black text-neutral-500 mr-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Verified Links:
                        </span>
                        {effectiveProfile.github && (
                            <a
                                href={
                                    effectiveProfile.github.startsWith("http")
                                        ? effectiveProfile.github
                                        : `https://github.com/${effectiveProfile.github}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-xl bg-white border border-black text-black font-black text-[11px] hover:bg-neutral-100 flex items-center gap-1 shadow-sm"
                            >
                                <span>GitHub: @{effectiveProfile.github.replace(/https?:\/\/github\.com\//, "")}</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                        )}
                        {effectiveProfile.linkedin && (
                            <a
                                href={
                                    effectiveProfile.linkedin.startsWith("http")
                                        ? effectiveProfile.linkedin
                                        : `https://linkedin.com/in/${effectiveProfile.linkedin}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-xl bg-white border border-black text-black font-black text-[11px] hover:bg-neutral-100 flex items-center gap-1 shadow-sm"
                            >
                                <span>LinkedIn</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                        )}
                        {effectiveProfile.resumeUrl && (
                            <a
                                href={effectiveProfile.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-xl bg-[#a2ff86]/30 border border-black text-black font-black text-[11px] hover:bg-[#a2ff86]/60 flex items-center gap-1 shadow-sm"
                            >
                                <FileText className="w-3 h-3 text-emerald-800" />
                                <span>Verified Resume ({effectiveProfile.resumeFilename || "PDF"})</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                        )}
                    </div>
                )}

                {/* Expandable Manual Overrides for This Event */}
                {showIdentityEditor && (
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-dashed border-black/30 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900">
                                Event-Specific Identity Overrides
                            </span>
                            <span className="text-[10px] text-neutral-500 font-bold">
                                Only modifies your application for this event
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">Roll / Student ID</label>
                                <input
                                    type="text"
                                    value={answers["q_roll_number"] || ""}
                                    onChange={(e) => setAnswer("q_roll_number", e.target.value)}
                                    placeholder="e.g. 2024CS0142"
                                    className="w-full p-2 rounded-xl border border-black font-bold bg-white text-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">Phone / WhatsApp</label>
                                <input
                                    type="text"
                                    value={answers["q_phone"] || ""}
                                    onChange={(e) => setAnswer("q_phone", e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="w-full p-2 rounded-xl border border-black font-bold bg-white text-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">Department / Branch</label>
                                <input
                                    type="text"
                                    value={answers["q_department"] || ""}
                                    onChange={(e) => setAnswer("q_department", e.target.value)}
                                    placeholder="e.g. Computer Science"
                                    className="w-full p-2 rounded-xl border border-black font-bold bg-white text-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">Year of Study</label>
                                <input
                                    type="text"
                                    value={answers["q_year"] || ""}
                                    onChange={(e) => setAnswer("q_year", e.target.value)}
                                    placeholder="e.g. 3rd Year"
                                    className="w-full p-2 rounded-xl border border-black font-bold bg-white text-black focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Multi-Section Progress Bar */}
            {totalSections > 1 && form.settings?.showProgressBar && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black text-neutral-600">
                        <span>
                            Section {currentSecIdx + 1} of {totalSections}
                        </span>
                        <span>{progressPercent}% Complete</span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-200 rounded-full border border-black overflow-hidden">
                        <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                        />
                    </div>
                </div>
            )}

            {/* Active Section Header Card (If titled) */}
            {activeSection && (activeSection.title || activeSection.description) && (
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <h3 className="text-base font-black text-black">{activeSection.title}</h3>
                    {activeSection.description && (
                        <p className="text-xs text-neutral-600 font-medium">{activeSection.description}</p>
                    )}
                </div>
            )}

            {/* Questions List for Current Section */}
            {activeSection && (
                <div className="space-y-4">
                    {activeSection.questions.map((question, _qIdx) => {
                        const qError = validationErrors[question.id];
                        const val = answers[question.id];

                        // Static Title and Description Block
                        if (question.type === "title_card") {
                            return (
                                <div
                                    key={question.id}
                                    className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2"
                                >
                                    {question.title && (
                                        <h3 className="text-base sm:text-lg font-black text-black">{question.title}</h3>
                                    )}
                                    {question.description && (
                                        <p className="text-xs sm:text-sm text-neutral-700 font-medium whitespace-pre-line leading-relaxed">
                                            {question.description}
                                        </p>
                                    )}
                                </div>
                            );
                        }

                        // Static Image Card / Image Block
                        if (question.type === "image_card" || question.type === "image_block") {
                            const alignClass =
                                question.imageAlignment === "left"
                                    ? "justify-start"
                                    : question.imageAlignment === "right"
                                    ? "justify-end"
                                    : "justify-center";

                            return (
                                <div
                                    key={question.id}
                                    className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-black text-black">{question.title}</h4>
                                    )}
                                    {question.imageUrl && (
                                        <div className={`flex ${alignClass}`}>
                                            <img
                                                src={question.imageUrl}
                                                alt=""
                                                className="rounded-xl border border-black object-cover max-h-80 max-w-full"
                                            />
                                        </div>
                                    )}
                                    {question.imageCaption && (
                                        <p className="text-xs text-neutral-500 font-medium italic text-center">
                                            {question.imageCaption}
                                        </p>
                                    )}
                                </div>
                            );
                        }

                        // Static Video Block (YouTube)
                        if (question.type === "video_block") {
                            const embedUrl = getYouTubeEmbedUrl(question.videoUrl);

                            return (
                                <div
                                    key={question.id}
                                    className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3"
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-black text-black">{question.title}</h4>
                                    )}
                                    {embedUrl ? (
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-black shadow-[2px_2px_0px_#000] bg-black">
                                            <iframe
                                                src={embedUrl}
                                                title={question.title || "Embedded Video"}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="w-full h-full"
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-6 border-2 border-dashed border-neutral-300 rounded-xl text-center text-xs text-neutral-500 font-bold">
                                            No valid video URL configured
                                        </div>
                                    )}
                                    {(question.videoTitle || question.description) && (
                                        <p className="text-xs text-neutral-500 font-medium italic text-center">
                                            {question.videoTitle || question.description}
                                        </p>
                                    )}
                                </div>
                            );
                        }

                        // Static Markdown / Notice Card
                        if (question.type === "markdown_card") {
                            return (
                                <div
                                    key={question.id}
                                    className="p-5 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2"
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-black text-black">{question.title}</h4>
                                    )}
                                    <div className="text-xs text-neutral-800 font-medium whitespace-pre-line leading-relaxed">
                                        {question.content || question.description}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={question.id}
                                className={`p-5 sm:p-6 rounded-2xl bg-white border-2 transition-all space-y-3 ${
                                    qError
                                        ? "border-rose-500 shadow-[3px_3px_0px_#dc2626]"
                                        : "border-black shadow-[3px_3px_0px_#000]"
                                }`}
                            >
                                {/* Question Title & Description */}
                                <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <label className="text-sm sm:text-base font-black text-black leading-snug">
                                            {question.title}
                                            {question.required && (
                                                <span className="text-rose-600 font-black ml-1">*</span>
                                            )}
                                        </label>
                                        {/* Point values when quiz */}
                                        {isQuiz &&
                                            form.settings?.quiz?.showPointValues !== false &&
                                            (question.points !== undefined || form.settings?.quiz?.defaultPointsPerQuestion) && (
                                                <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-lg bg-neutral-100 border border-black/30 text-neutral-700">
                                                    {question.points ?? form.settings?.quiz?.defaultPointsPerQuestion ?? 1} pt
                                                    {(question.points ?? form.settings?.quiz?.defaultPointsPerQuestion ?? 1) === 1 ? "" : "s"}
                                                </span>
                                            )}
                                    </div>
                                    {question.description && (
                                        <p className="text-xs text-neutral-500 font-medium">
                                            {question.description}
                                        </p>
                                    )}
                                </div>

                                {/* Question Image if attached */}
                                {question.imageUrl && (
                                    <div className="rounded-xl border border-black overflow-hidden max-w-sm">
                                        <img
                                            src={question.imageUrl}
                                            alt=""
                                            className="w-full max-h-60 object-contain bg-neutral-50"
                                        />
                                    </div>
                                )}

                                {/* Input Type: Short Answer */}
                                {question.type === "short_answer" && (
                                    <input
                                        type="text"
                                        value={val ?? ""}
                                        onChange={(e) => setAnswer(question.id, e.target.value)}
                                        placeholder={question.placeholder || "Your answer"}
                                        className="w-full text-xs sm:text-sm font-medium border-2 border-black rounded-xl p-2.5 focus:outline-none bg-neutral-50 focus:bg-white"
                                    />
                                )}

                                {/* Input Type: Paragraph */}
                                {question.type === "paragraph" && (
                                    <textarea
                                        value={val ?? ""}
                                        onChange={(e) => setAnswer(question.id, e.target.value)}
                                        placeholder={question.placeholder || "Your answer..."}
                                        rows={3}
                                        className="w-full text-xs sm:text-sm font-medium border-2 border-black rounded-xl p-3 focus:outline-none bg-neutral-50 focus:bg-white resize-y"
                                    />
                                )}

                                {/* Input Type: Multiple Choice */}
                                {question.type === "multiple_choice" && (
                                    <div className="space-y-2 pt-1">
                                        {(question.options || []).map((opt) => {
                                            const isOtherOpt = Boolean(opt.isOther || opt.text.toLowerCase().startsWith("other"));
                                            const isChecked = isOtherOpt
                                                ? typeof val === "string" && (val.startsWith("Other: ") || val === opt.text)
                                                : val === opt.text;

                                            return (
                                                <div key={opt.id} className="space-y-2">
                                                    <label
                                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                            isChecked
                                                                ? "border-black bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                                                : "border-black/20 hover:border-black/60 bg-white"
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={question.id}
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isOtherOpt) {
                                                                    setAnswer(question.id, "Other: ");
                                                                } else {
                                                                    setAnswer(question.id, opt.text);
                                                                }
                                                            }}
                                                            className="w-4 h-4 accent-black cursor-pointer"
                                                        />
                                                        <span className="text-xs sm:text-sm font-bold text-black flex-1">
                                                            {opt.text}
                                                        </span>
                                                        {opt.imageUrl && (
                                                            <img
                                                                src={opt.imageUrl}
                                                                alt=""
                                                                className="w-8 h-8 rounded-lg border border-black object-cover shrink-0"
                                                            />
                                                        )}
                                                    </label>
                                                    {isOtherOpt && isChecked && (
                                                        <input
                                                            type="text"
                                                            placeholder="Please specify other..."
                                                            value={typeof val === "string" && val.startsWith("Other: ") ? val.replace("Other: ", "") : ""}
                                                            onChange={(e) => setAnswer(question.id, `Other: ${e.target.value}`)}
                                                            className="w-full text-xs sm:text-sm font-medium border-2 border-black rounded-xl p-2.5 ml-0 sm:ml-4 bg-white focus:outline-none shadow-sm"
                                                            autoFocus
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Input Type: Checkboxes */}
                                {question.type === "checkboxes" && (
                                    <div className="space-y-2 pt-1">
                                        {(question.options || []).map((opt) => {
                                            const currentArr: string[] = Array.isArray(val) ? val : [];
                                            const isOtherOpt = Boolean(opt.isOther || opt.text.toLowerCase().startsWith("other"));
                                            const otherEntry = currentArr.find((item) => item.startsWith("Other: ") || item === opt.text);
                                            const isChecked = isOtherOpt ? Boolean(otherEntry) : currentArr.includes(opt.text);

                                            const toggleCheck = () => {
                                                if (isChecked) {
                                                    setAnswer(
                                                        question.id,
                                                        currentArr.filter((t) => (isOtherOpt ? !t.startsWith("Other: ") && t !== opt.text : t !== opt.text))
                                                    );
                                                } else {
                                                    const addVal = isOtherOpt ? "Other: " : opt.text;
                                                    setAnswer(question.id, [...currentArr, addVal]);
                                                }
                                            };

                                            return (
                                                <div key={opt.id} className="space-y-2">
                                                    <label
                                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                            isChecked
                                                                ? "border-black bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                                                : "border-black/20 hover:border-black/60 bg-white"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={toggleCheck}
                                                            className="w-4 h-4 accent-black rounded cursor-pointer"
                                                        />
                                                        <span className="text-xs sm:text-sm font-bold text-black flex-1">
                                                            {opt.text}
                                                        </span>
                                                        {opt.imageUrl && (
                                                            <img
                                                                src={opt.imageUrl}
                                                                alt=""
                                                                className="w-8 h-8 rounded-lg border border-black object-cover shrink-0"
                                                            />
                                                        )}
                                                    </label>
                                                    {isOtherOpt && isChecked && (
                                                        <input
                                                            type="text"
                                                            placeholder="Please specify other..."
                                                            value={otherEntry ? otherEntry.replace("Other: ", "") : ""}
                                                            onChange={(e) => {
                                                                const updated = currentArr.filter((t) => !t.startsWith("Other: ") && t !== opt.text);
                                                                setAnswer(question.id, [...updated, `Other: ${e.target.value}`]);
                                                            }}
                                                            className="w-full text-xs sm:text-sm font-medium border-2 border-black rounded-xl p-2.5 ml-0 sm:ml-4 bg-white focus:outline-none shadow-sm"
                                                            autoFocus
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Input Type: Dropdown */}
                                {question.type === "dropdown" && (
                                    <select
                                        value={val ?? ""}
                                        onChange={(e) => setAnswer(question.id, e.target.value)}
                                        className="w-full text-xs sm:text-sm font-bold border-2 border-black rounded-xl p-2.5 bg-white focus:outline-none cursor-pointer"
                                    >
                                        <option value="">Select an option...</option>
                                        {(question.options || []).map((opt) => (
                                            <option key={opt.id} value={opt.text}>
                                                {opt.text}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Input Type: Linear Scale */}
                                {question.type === "linear_scale" && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                                            {Array.from(
                                                { length: (question.scaleConfig?.max ?? 5) - (question.scaleConfig?.min ?? 1) + 1 },
                                                (_, i) => (question.scaleConfig?.min ?? 1) + i
                                            ).map((score) => {
                                                const isSelected = Number(val) === score;
                                                return (
                                                    <button
                                                        key={score}
                                                        type="button"
                                                        onClick={() => setAnswer(question.id, score)}
                                                        className={`w-10 h-10 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center justify-center cursor-pointer transition-transform active:scale-95 shrink-0 ${
                                                            isSelected
                                                                ? "border-black shadow-[2px_2px_0px_#000]"
                                                                : "border-black/30 hover:border-black bg-white"
                                                        }`}
                                                        style={{ backgroundColor: isSelected ? accentColor : undefined }}
                                                    >
                                                        {score}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {(question.scaleConfig?.minLabel || question.scaleConfig?.maxLabel) && (
                                            <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
                                                <span>{question.scaleConfig?.minLabel}</span>
                                                <span>{question.scaleConfig?.maxLabel}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Input Type: Rating (Stars, Hearts, Thumbs) */}
                                {question.type === "rating" && (() => {
                                    const levels = question.ratingConfig?.levels || 5;
                                    const icon = question.ratingConfig?.icon || "star";
                                    const currentRating = Number(val) || 0;

                                    return (
                                        <div className="space-y-2 pt-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {Array.from({ length: levels }, (_, i) => i + 1).map((lvl) => {
                                                    const isSelected = lvl <= currentRating;
                                                    return (
                                                        <button
                                                            key={lvl}
                                                            type="button"
                                                            onClick={() => setAnswer(question.id, lvl)}
                                                            className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                                                                isSelected
                                                                    ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                                    : "border-black/20 hover:border-black bg-white"
                                                            }`}
                                                            title={`Rate ${lvl} / ${levels}`}
                                                        >
                                                            {icon === "star" && (
                                                                <Star
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-amber-500 fill-amber-400"
                                                                            : "text-neutral-400"
                                                                    }`}
                                                                />
                                                            )}
                                                            {icon === "heart" && (
                                                                <Heart
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-rose-500 fill-rose-500"
                                                                            : "text-neutral-400"
                                                                    }`}
                                                                />
                                                            )}
                                                            {icon === "thumb" && (
                                                                <ThumbsUp
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-sky-600 fill-sky-500"
                                                                            : "text-neutral-400"
                                                                    }`}
                                                                />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                                {currentRating > 0 && (
                                                    <span className="text-xs font-black text-black ml-2 bg-neutral-100 px-2.5 py-1 rounded-xl border border-black/20">
                                                        {currentRating} of {levels}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Input Type: File Upload to Cloudinary */}
                                {question.type === "file_upload" && (
                                    <div className="space-y-3">
                                        {fileAttachments.some((f) => f.questionId === question.id) ? (
                                            <div className="flex items-center justify-between p-3 rounded-xl border-2 border-black bg-emerald-50">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Paperclip className="w-4 h-4 text-emerald-700 shrink-0" />
                                                    <span className="text-xs font-black text-black truncate">
                                                        {fileAttachments.find((f) => f.questionId === question.id)?.fileName}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(question.id)}
                                                    className="p-1 rounded-lg text-neutral-500 hover:text-rose-600 cursor-pointer"
                                                    title="Remove file"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* 1-Click Verified Resume Quick-Attach */}
                                                {effectiveProfile.resumeUrl &&
                                                    question.title.toLowerCase().includes("resume") && (
                                                        <div className="flex items-center justify-between p-3 rounded-xl border-2 border-black bg-[#FAF6EE] shadow-[2px_2px_0px_#000]">
                                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                                <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center shrink-0">
                                                                    <FileText className="w-4 h-4 text-black" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-black text-black flex items-center gap-1.5">
                                                                        <span>Use Verified Orbix Resume</span>
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                            Verified
                                                                        </span>
                                                                    </p>
                                                                    <p className="text-[11px] text-neutral-600 font-medium truncate">
                                                                        {effectiveProfile.resumeFilename}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newAttachment: FileAttachmentMeta = {
                                                                        questionId: question.id,
                                                                        questionTitle: question.title,
                                                                        fileName:
                                                                            effectiveProfile.resumeFilename ||
                                                                            "Verified_Orbix_Resume.pdf",
                                                                        fileUrl: effectiveProfile.resumeUrl!,
                                                                        filePublicId: "verified_profile_resume",
                                                                        fileSize: 1024 * 1024,
                                                                        mimeType: "application/pdf",
                                                                    };
                                                                    setFileAttachments((prev) => [
                                                                        ...prev.filter((f) => f.questionId !== question.id),
                                                                        newAttachment,
                                                                    ]);
                                                                    setAnswer(question.id, effectiveProfile.resumeUrl!);
                                                                    toast.success("Attached verified Orbix resume!");
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8fee72] border-2 border-black font-black text-xs text-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                                            >
                                                                Attach
                                                            </button>
                                                        </div>
                                                    )}

                                                <label className="border-2 border-dashed border-black/40 hover:border-black rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
                                                    <UploadCloud className="w-5 h-5 text-neutral-600" />
                                                    <span className="text-xs font-black text-black">
                                                        {uploadProgress[question.id]
                                                            ? `Uploading (${uploadProgress[question.id]}%)...`
                                                            : "Select or Drop File to Upload"}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-500 font-medium">
                                                        Max {question.validation?.maxFileSizeMb ?? 10} MB
                                                    </span>
                                                    <input
                                                        type="file"
                                                        onChange={(e) => handleFileUpload(question, e)}
                                                        disabled={Boolean(uploadProgress[question.id])}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Input Type: Grids */}
                                {(question.type === "multiple_choice_grid" || question.type === "checkbox_grid") && (
                                    <div className="overflow-x-auto border border-black/20 rounded-xl p-2">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="p-2 border-b border-black/10"></th>
                                                    {(question.gridConfig?.columns || []).map((col, cIdx) => (
                                                        <th
                                                            key={cIdx}
                                                            className="p-2 font-black text-center text-neutral-700 border-b border-black/10"
                                                        >
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(question.gridConfig?.rows || []).map((row, rIdx) => {
                                                    const rowAnswers = val?.[row] || (question.type === "checkbox_grid" ? [] : null);

                                                    return (
                                                        <tr key={rIdx} className="hover:bg-neutral-50">
                                                            <td className="p-2 font-bold text-black border-b border-black/10">
                                                                {row}
                                                            </td>
                                                            {(question.gridConfig?.columns || []).map((col, cIdx) => {
                                                                const isChecked =
                                                                    question.type === "checkbox_grid"
                                                                        ? Array.isArray(rowAnswers) && rowAnswers.includes(col)
                                                                        : rowAnswers === col;

                                                                 const handleGridCheck = () => {
                                                                    const currentGridVal = { ...(val || {}) };
                                                                    if (question.type === "checkbox_grid") {
                                                                        const existingRowArr: string[] = Array.isArray(currentGridVal[row])
                                                                            ? currentGridVal[row]
                                                                            : [];
                                                                        currentGridVal[row] = existingRowArr.includes(col)
                                                                            ? existingRowArr.filter((c) => c !== col)
                                                                            : [...existingRowArr, col];
                                                                    } else {
                                                                        // If limitOnePerColumn is enabled, ensure column is exclusive to this row
                                                                        if (question.gridConfig?.limitOnePerColumn) {
                                                                            Object.keys(currentGridVal).forEach((r) => {
                                                                                if (currentGridVal[r] === col) {
                                                                                    delete currentGridVal[r];
                                                                                }
                                                                            });
                                                                        }
                                                                        currentGridVal[row] = col;
                                                                    }
                                                                    setAnswer(question.id, currentGridVal);
                                                                };

                                                                return (
                                                                    <td
                                                                        key={cIdx}
                                                                        className="p-2 text-center border-b border-black/10"
                                                                    >
                                                                        <input
                                                                            type={question.type === "checkbox_grid" ? "checkbox" : "radio"}
                                                                            name={`${question.id}_row_${rIdx}`}
                                                                            checked={isChecked}
                                                                            onChange={handleGridCheck}
                                                                            className="w-4 h-4 accent-black cursor-pointer"
                                                                        />
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Input Type: Date */}
                                {question.type === "date" && (
                                    <input
                                        type={question.dateConfig?.includeTime ? "datetime-local" : "date"}
                                        value={val ?? ""}
                                        onChange={(e) => setAnswer(question.id, e.target.value)}
                                        className="w-full text-xs sm:text-sm font-bold border-2 border-black rounded-xl p-2.5 bg-white focus:outline-none"
                                    />
                                )}

                                {/* Input Type: Time */}
                                {question.type === "time" && (
                                    question.timeConfig?.mode === "duration" ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="99"
                                                    placeholder="00"
                                                    value={typeof val === "object" ? val?.hours ?? "" : ""}
                                                    onChange={(e) =>
                                                        setAnswer(question.id, {
                                                            ...(typeof val === "object" ? val : {}),
                                                            hours: e.target.value === "" ? "" : Number(e.target.value),
                                                        })
                                                    }
                                                    className="w-16 text-center text-xs sm:text-sm font-bold border-2 border-black rounded-xl p-2.5 bg-white focus:outline-none"
                                                />
                                                <span className="text-xs font-bold text-neutral-600">hrs</span>
                                            </div>
                                            <span className="font-bold">:</span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    placeholder="00"
                                                    value={typeof val === "object" ? val?.minutes ?? "" : ""}
                                                    onChange={(e) =>
                                                        setAnswer(question.id, {
                                                            ...(typeof val === "object" ? val : {}),
                                                            minutes: e.target.value === "" ? "" : Number(e.target.value),
                                                        })
                                                    }
                                                    className="w-16 text-center text-xs sm:text-sm font-bold border-2 border-black rounded-xl p-2.5 bg-white focus:outline-none"
                                                />
                                                <span className="text-xs font-bold text-neutral-600">mins</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            type="time"
                                            value={typeof val === "string" ? val : ""}
                                            onChange={(e) => setAnswer(question.id, e.target.value)}
                                            className="w-full text-xs sm:text-sm font-bold border-2 border-black rounded-xl p-2.5 bg-white focus:outline-none"
                                        />
                                    )
                                )}

                                {/* Validation Error display */}
                                {qError && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 pt-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>{qError}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="pt-4 flex items-center justify-between gap-3">
                {currentSecIdx > 0 ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-black text-xs text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                ) : onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-black text-xs text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Cancel
                    </button>
                ) : (
                    <div />
                )}

                <button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl border-2 border-black font-black text-xs text-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    style={{ backgroundColor: accentColor }}
                >
                    {isSubmitting ? (
                        <>
                            <OrbixLoader size="xs" />
                            <span>Submitting...</span>
                        </>
                    ) : currentSecIdx === totalSections - 1 ? (
                        <span>Submit Registration</span>
                    ) : (
                        <>
                            <span>Next</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
