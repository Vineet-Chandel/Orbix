import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
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
    ExternalLink,
    Edit3,
    FileText,
    Sparkles,
    Star,
    Heart,
    ThumbsUp,
    Award,
    Download,
    RotateCcw,
    Clock,
    WifiOff,
    CheckCheck,
    ChevronDown,
    ChevronUp,
    Lightbulb,
    ClipboardList,
} from "lucide-react";
import type {
    ClubEventFormRecord,
    FormQuestion,
    FormSection,
    FileAttachmentMeta,
    StudentIdentityProfile,
} from "../../../api/clubEventFormApi";
import { NeoSelect } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import { NeoDateTimePicker } from "../../../components/NeoDateTimePicker";
import {
    requestAttachmentUploadSignature,
    uploadFileToCloudinary,
    submitEventFormResponse,
    saveStudentDraft,
    clearStudentDraft,
} from "../../../api/clubEventFormApi";
import {
    getCloudinaryBannerUrl,
    getCloudinaryAvatarUrl,
    getCloudinaryThumbnailUrl,
    getOptimizedCloudinaryUrl,
} from "../../../utils/cloudinaryDelivery";
import { useToast } from "../../../context/ToastContext";
import { OrbixLoader } from "../../../components/ui/loader";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { downloadPassPdf } from "../../../utils/passPdfGenerator";
import { OrbixLogo } from "../../../components/OrbixLogo";

export interface StudentFormRendererProps {
    form: ClubEventFormRecord;
    event: any;
    club?: any;
    user?: any;
    studentProfile?: StudentIdentityProfile | null;
    userResponse?: any;
    draftResponse?: {
        answers?: Record<string, any>;
        fileAttachments?: FileAttachmentMeta[];
        currentSectionIndex?: number;
        sectionHistory?: number[];
        formVersionId?: string;
        updatedAt?: string;
    } | null;
    isPreview?: boolean;
    isClosed?: boolean;
    closedReason?: string;
    onSuccess?: (registration: any) => void;
    onCancel?: () => void;
    onEditResponse?: () => void;
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
    draftResponse,
    isPreview = false,
    isClosed = false,
    closedReason,
    onSuccess,
    onCancel,
    onEditResponse,
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

    const accentColor = form.themeSettings?.accentColor || "#38BDF8";
    const cardSurfaceColor = form.themeSettings?.cardSurfaceColor || "#FFFFFF";

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
    const [copiedRegId, setCopiedRegId] = useState(false);
    const [showIdentityEditor, setShowIdentityEditor] = useState(false);
    const [showAnswersSummary, setShowAnswersSummary] = useState(true);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    // Autosave states
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "offline">("saved");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [draftRestoredNotice, setDraftRestoredNotice] = useState<string | null>(null);
    const isInitialMount = useRef(true);

    // Storage key for local storage persistence
    const storageKey = `orbix_student_draft_${user?.id || "guest"}_${form.eventId}_${form.publishedVersionId || "v1"}`;

    // Form autosave setting
    const isAutosaveEnabled =
        !isPreview &&
        !userResponse &&
        !submittedRegistration &&
        form.settings?.presentation?.autosaveProgress !== false &&
        form.settings?.presentation?.disableRespondentAutosave !== true;

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

    // Restore unfinished draft from Server or Local Storage on initial load
    useEffect(() => {
        if (!userResponse && !submittedRegistration && isAutosaveEnabled) {
            let restored = false;

            // 1. Try server draft first
            if (draftResponse && draftResponse.answers && Object.keys(draftResponse.answers).length > 0) {
                setAnswers((prev) => ({ ...prev, ...draftResponse.answers }));
                if (draftResponse.fileAttachments && Array.isArray(draftResponse.fileAttachments)) {
                    setFileAttachments(draftResponse.fileAttachments);
                }
                if (typeof draftResponse.currentSectionIndex === "number" && draftResponse.currentSectionIndex < sections.length) {
                    setCurrentSecIdx(draftResponse.currentSectionIndex);
                }
                if (Array.isArray(draftResponse.sectionHistory) && draftResponse.sectionHistory.length > 0) {
                    setSectionHistory(draftResponse.sectionHistory);
                }
                restored = true;
                setSaveStatus("saved");
                if (draftResponse.updatedAt) {
                    setLastSavedAt(new Date(draftResponse.updatedAt));
                }
            } else {
                // 2. Try browser localStorage fallback
                try {
                    const localRaw = localStorage.getItem(storageKey);
                    if (localRaw) {
                        const parsed = JSON.parse(localRaw);
                        if (parsed && typeof parsed === "object" && parsed.answers && Object.keys(parsed.answers).length > 0) {
                            setAnswers((prev) => ({ ...prev, ...parsed.answers }));
                            if (parsed.fileAttachments && Array.isArray(parsed.fileAttachments)) {
                                setFileAttachments(parsed.fileAttachments);
                            }
                            if (typeof parsed.currentSecIdx === "number" && parsed.currentSecIdx < sections.length) {
                                setCurrentSecIdx(parsed.currentSecIdx);
                            }
                            if (Array.isArray(parsed.sectionHistory) && parsed.sectionHistory.length > 0) {
                                setSectionHistory(parsed.sectionHistory);
                            }
                            restored = true;
                            setSaveStatus("saved");
                            if (parsed.timestamp) {
                                setLastSavedAt(new Date(parsed.timestamp));
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Could not parse local draft:", e);
                }
            }

            if (restored) {
                setDraftRestoredNotice("Restored your partially completed draft.");
            }
        }
    }, [storageKey, draftResponse, userResponse, submittedRegistration, isAutosaveEnabled, sections.length]);

    // Debounced Autosave (Every 1500ms after changes, no spamming API on every keystroke)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (!isAutosaveEnabled || Object.keys(answers).length === 0) return;

        setSaveStatus("unsaved");

        const timeout = setTimeout(async () => {
            setSaveStatus("saving");

            // Persist locally
            try {
                const payload = {
                    answers,
                    fileAttachments,
                    currentSecIdx,
                    sectionHistory,
                    timestamp: Date.now(),
                };
                localStorage.setItem(storageKey, JSON.stringify(payload));
            } catch (err) {
                console.warn("LocalStorage save error:", err);
            }

            // Persist to server if authenticated student
            if (user?.id) {
                try {
                    await saveStudentDraft(form.eventId, {
                        answers,
                        fileAttachments,
                        currentSectionIndex: currentSecIdx,
                        sectionHistory,
                        formVersionId: form.publishedVersionId || undefined,
                    });
                    setSaveStatus("saved");
                    setLastSavedAt(new Date());
                } catch (apiErr) {
                    console.warn("Server draft autosave failed, saved locally:", apiErr);
                    setSaveStatus("offline");
                }
            } else {
                setSaveStatus("saved");
                setLastSavedAt(new Date());
            }
        }, 1500);

        return () => clearTimeout(timeout);
    }, [answers, fileAttachments, currentSecIdx, sectionHistory, form.eventId, form.publishedVersionId, isAutosaveEnabled, storageKey, user?.id]);

    // Clear Form Action
    const handleClearForm = async () => {
        try {
            localStorage.removeItem(storageKey);
            if (user?.id) {
                await clearStudentDraft(form.eventId).catch(() => {});
            }
            setAnswers({});
            setFileAttachments([]);
            setCurrentSecIdx(0);
            setSectionHistory([0]);
            setValidationErrors({});
            setSaveStatus("saved");
            setShowClearConfirm(false);
            setDraftRestoredNotice(null);
            toast.success("Registration form cleared.");
        } catch {
            toast.error("Failed to clear draft.");
        }
    };

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

    const activeSection: FormSection | undefined = sections[currentSecIdx];
    const totalSections = sections.length;

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
        let firstInvalidQuestionId: string | null = null;

        for (const q of sec.questions) {
            if (q.type === "image_card" || q.type === "image_block" || q.type === "video_block" || q.type === "markdown_card" || q.type === "title_card") {
                continue;
            }

            const val = answers[q.id];
            const isProvided = val !== undefined && val !== null && (typeof val === "string" ? val.trim() !== "" : true);

            if (q.required) {
                if (q.type === "file_upload") {
                    const hasFile = fileAttachments.some((f) => f.questionId === q.id);
                    if (!hasFile) {
                        errors[q.id] = "This question requires an uploaded file.";
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    }
                } else if (!isProvided) {
                    errors[q.id] = "This question is required.";
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
            }

            // String length checks
            if (typeof val === "string" && val.trim().length > 0) {
                if (q.validation?.minLength && val.trim().length < q.validation.minLength) {
                    errors[q.id] = `Must be at least ${q.validation.minLength} characters.`;
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
                if (q.validation?.maxLength && val.trim().length > q.validation.maxLength) {
                    errors[q.id] = `Must not exceed ${q.validation.maxLength} characters.`;
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
                if (q.validation?.pattern) {
                    try {
                        const regex = new RegExp(q.validation.pattern);
                        if (!regex.test(val.trim())) {
                            errors[q.id] = q.validation.patternError || "Invalid format.";
                            if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                        }
                    } catch {}
                }
            }

            // Number validation
            if (q.type === "short_answer" && q.validation?.numberType && val !== undefined && val !== "") {
                const numVal = Number(val);
                if (isNaN(numVal)) {
                    errors[q.id] = "Must be a valid number.";
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                } else {
                    const t = q.validation.numberType;
                    const target = Number(q.validation.numberValue ?? 0);
                    const target2 = Number(q.validation.numberValue2 ?? 0);
                    if (t === "greater_than" && numVal <= target) {
                        errors[q.id] = `Must be greater than ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "greater_or_equal" && numVal < target) {
                        errors[q.id] = `Must be greater than or equal to ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "less_than" && numVal >= target) {
                        errors[q.id] = `Must be less than ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "less_or_equal" && numVal > target) {
                        errors[q.id] = `Must be less than or equal to ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "equal" && numVal !== target) {
                        errors[q.id] = `Must be equal to ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "not_equal" && numVal === target) {
                        errors[q.id] = `Must not be equal to ${target}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "between" && (numVal < target || numVal > target2)) {
                        errors[q.id] = `Must be between ${target} and ${target2}.`;
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    } else if (t === "whole_number" && !Number.isInteger(numVal)) {
                        errors[q.id] = "Must be a whole number (integer).";
                        if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                    }
                }
            }

            // Checkbox selection limits
            if (q.type === "checkboxes" && Array.isArray(val)) {
                if (q.validation?.minSelected && val.length < q.validation.minSelected) {
                    errors[q.id] = `Please select at least ${q.validation.minSelected} options.`;
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
                if (q.validation?.maxSelected && val.length > q.validation.maxSelected) {
                    errors[q.id] = `Please select at most ${q.validation.maxSelected} options.`;
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
                if (q.validation?.exactSelected && val.length !== q.validation.exactSelected) {
                    errors[q.id] = `Please select exactly ${q.validation.exactSelected} options.`;
                    if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                }
            }

            // Grid validation
            if ((q.type === "multiple_choice_grid" || q.type === "checkbox_grid") && q.gridConfig) {
                const rows = q.gridConfig.rows || [];
                if (q.gridConfig.requireEachRow) {
                    for (const row of rows) {
                        const rowAns = val?.[row];
                        if (!rowAns || (Array.isArray(rowAns) && rowAns.length === 0)) {
                            errors[q.id] = `Please provide a response for each row ("${row}").`;
                            if (!firstInvalidQuestionId) firstInvalidQuestionId = q.id;
                            break;
                        }
                    }
                }
            }
        }

        setValidationErrors(errors);

        if (firstInvalidQuestionId) {
            const el = document.getElementById(`q_wrapper_${firstInvalidQuestionId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }

        return Object.keys(errors).length === 0;
    };

    // Multi-Section Navigation with Conditional Routing
    const handleNext = async () => {
        if (!activeSection) return;
        if (!validateSection(activeSection)) {
            toast.error("Please answer all required questions properly before proceeding.");
            return;
        }

        // Determine next destination based on answer conditional branching rules
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

        // If action is submit_form or this is the final physical section
        if (nextDestination === "submit_form" || currentSecIdx === totalSections - 1) {
            await handleSubmit();
            return;
        }

        // Find target section index (Conditional routing: skip irrelevant sections)
        let targetIdx = currentSecIdx + 1;
        if (typeof nextDestination === "string" && nextDestination !== "next_section") {
            const foundIdx = sections.findIndex((s) => s.id === nextDestination);
            if (foundIdx !== -1) {
                targetIdx = foundIdx;
            }
        }

        if (targetIdx < totalSections) {
            setSectionHistory((prev) => [...prev, targetIdx]);
            setCurrentSecIdx(targetIdx);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            await handleSubmit();
        }
    };

    // Previous Section Navigation (Traverse back through historical path)
    const handleBack = () => {
        if (sectionHistory.length > 1) {
            const newHistory = [...sectionHistory];
            newHistory.pop();
            const prevIdx = newHistory[newHistory.length - 1];
            setSectionHistory(newHistory);
            setCurrentSecIdx(prevIdx);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (currentSecIdx > 0) {
            setCurrentSecIdx(currentSecIdx - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Form Submission with Idempotency Key Guard & Double Click Prevention
    const handleSubmit = async () => {
        if (isSubmitting) return;

        const studentName = answers["q_student_name"] || effectiveProfile.fullName || "Student";
        const studentEmail = answers["q_student_email"] || effectiveProfile.email || "";

        if (isPreview) {
            toast.success("Preview response simulated successfully! (Preview Mode)", {
                title: "Form Submission Simulation",
            });
            setSubmittedRegistration({
                id: "preview_reg_" + Math.random().toString(36).substring(2, 9),
                ticketCode: null,
                status: "pending",
                applicantName: studentName,
                applicantEmail: studentEmail,
                registeredAt: new Date().toISOString(),
                answers,
                fileAttachments,
            });
            return;
        }

        try {
            setIsSubmitting(true);

            // Generate cryptographically unique idempotency key
            const idempotencyKey = `idem_${user?.id || "guest"}_${form.eventId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            const res = await submitEventFormResponse(form.eventId, {
                applicantName: studentName,
                applicantEmail: studentEmail,
                phoneNumber: answers["q_phone"] || effectiveProfile.phoneNumber || undefined,
                notes: answers["q_notes"] || undefined,
                answers,
                fileAttachments,
                idempotencyKey,
                institutionId: studentProfile?.collegeId || (user as any)?.college_id || undefined,
                institutionName: effectiveProfile.college || undefined,
            });

            const regRecord = {
                ...res.registration,
                applicantName: studentName,
                applicantEmail: studentEmail,
                answers: res.registration?.answers || answers,
                fileAttachments: res.registration?.fileAttachments || fileAttachments,
            };

            setSubmittedRegistration(regRecord);

            // Clean up autosaved drafts
            try {
                localStorage.removeItem(storageKey);
                if (user?.id) {
                    await clearStudentDraft(form.eventId).catch(() => {});
                }
            } catch {}

            toast.success(res.message || "Registration submitted successfully!");
            if (onSuccess) {
                onSuccess(regRecord);
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
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
        toast.success("Ticket pass code copied!");
        setTimeout(() => setCopiedTicket(false), 2000);
    };

    // Copy Registration ID
    const handleCopyRegId = (regId: string) => {
        navigator.clipboard.writeText(regId);
        setCopiedRegId(true);
        toast.success("Registration ID copied!");
        setTimeout(() => setCopiedRegId(false), 2000);
    };

    // Download Pass as PDF
    const handleDownloadPdf = async () => {
        if (isDownloadingPdf) return;
        const eventTitle = (event?.title || form?.title || "Event").trim();
        const safeName = eventTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `Orbix-Pass-${safeName}.pdf`;

        try {
            await downloadPassPdf({
                elementId: "application-pass-card",
                filename,
                onStart: () => setIsDownloadingPdf(true),
                onSuccess: () => {
                    setIsDownloadingPdf(false);
                    toast.success("Pass PDF downloaded successfully!");
                },
                onError: (err) => {
                    setIsDownloadingPdf(false);
                    console.error("PDF generation failed:", err);
                    toast.error("Could not download PDF. You can still use Print Pass Receipt.");
                },
            });
        } catch (e) {
            setIsDownloadingPdf(false);
        }
    };

    // -------------------------------------------------------------------------
    // RENDER: SUCCESS SCREEN (4.5 Registration Success Screen)
    // -------------------------------------------------------------------------
    if (submittedRegistration) {
        const formattedDate = event?.startsAt
            ? new Date(event.startsAt).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
              })
            : null;
        const formattedTime = event?.startsAt
            ? new Date(event.startsAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
              })
            : null;

        const submissionTimeStr = submittedRegistration.registeredAt
            ? new Date(submittedRegistration.registeredAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
              })
            : new Date().toLocaleString();

        const isApproved =
            submittedRegistration.status === "registered" ||
            submittedRegistration.status === "attended";

        return (
            <div
                id="application-pass-card"
                className="w-full max-w-xl mx-auto rounded-3xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 text-left space-y-4 animate-in fade-in duration-200 print:shadow-none print:border-2 print:p-6 print:rounded-2xl print:bg-white print:max-w-full"
            >
                {/* 1. Official Orbix Brand Header & Authenticity Stamp */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                            <OrbixLogo className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 leading-none">
                                <span className="font-black text-sm sm:text-base text-black tracking-tight uppercase">ORBIX</span>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    Verified Pass
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 block leading-tight mt-1">
                                Collegiate Ecosystem • Official Admission Pass
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">Security Hash</span>
                        <span className="text-xs font-mono font-black text-black">
                            {submittedRegistration.id ? submittedRegistration.id.slice(0, 8).toUpperCase() : "VERIFIED"}
                        </span>
                    </div>
                </div>

                {/* Top Pass Status & Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b-2 border-black/15">
                    {/* Status Pill */}
                    {isApproved ? (
                        <span className="px-3.5 py-1 rounded-full text-black bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black inline-flex items-center gap-1.5 uppercase tracking-wide">
                            <CheckCheck className="w-3.5 h-3.5 stroke-[3]" />
                            Registration Confirmed
                        </span>
                    ) : (
                        <span className="px-3.5 py-1 rounded-full text-black bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black inline-flex items-center gap-1.5 uppercase tracking-wide">
                            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                            Application Submitted for Review
                        </span>
                    )}

                    {/* Registration ID & Copy */}
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-black bg-white px-3 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[10px] uppercase font-black text-neutral-500 font-sans">Pass ID:</span>
                        <span className="text-black font-black truncate max-w-[120px] sm:max-w-[170px]" title={submittedRegistration.id}>
                            {submittedRegistration.id}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleCopyRegId(submittedRegistration.id)}
                            className="p-1 rounded hover:bg-neutral-100 text-black cursor-pointer print:hidden no-print"
                            title="Copy ID"
                            data-no-print="true"
                        >
                            {copiedRegId ? <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                </div>

                {/* Event Name & Confirmation Text */}
                <div className="space-y-1.5 pt-1">
                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                        {event?.title || form.title}
                    </h2>
                    <p className="text-xs text-neutral-700 font-bold leading-relaxed">
                        {isApproved
                            ? form.settings?.confirmationMessage || "Your registration has been confirmed! Present your pass code at event check-in."
                            : "Thank you! Your registration has been submitted successfully and is awaiting review from the club organizers."}
                    </p>
                </div>

                {/* Event Logistics (Date, Venue, Organizer) - Integrated without repeated boxes */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-xl bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-black" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-neutral-500 block leading-tight">Session Timing</span>
                            <span className="truncate block font-bold text-black text-[11px] mt-0.5">
                                {formattedDate ? `${formattedDate}${formattedTime ? ` • ${formattedTime}` : ""}` : "Check event schedule"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-xl bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-black" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-neutral-500 block leading-tight">Location & Venue</span>
                            <span className="truncate block font-bold text-black text-[11px] mt-0.5">
                                {event?.venueOrLocation || "Campus Venue"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-xl bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                            <School className="w-3.5 h-3.5 text-black" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-neutral-500 block leading-tight">Host Club</span>
                            <span className="truncate block font-black text-black text-[11px] mt-0.5">
                                {club?.name || "Verified Club"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Ticket Perforation Dashed Line */}
                <div className="relative py-1 flex items-center">
                    <div className="border-b-2 border-dashed border-black/30 w-full" />
                </div>

                {/* Entry Clearance Section */}
                {isApproved && submittedRegistration.ticketCode ? (
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                                <Ticket className="w-3.5 h-3.5 text-black" />
                                Official Check-In Pass
                            </span>
                            <div className="font-mono text-2xl font-black text-black tracking-widest">
                                {submittedRegistration.ticketCode}
                            </div>
                            <span className="text-[11px] text-neutral-600 font-bold block">
                                Present this ticket code or pass during entry check-in.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleCopyTicket(submittedRegistration.ticketCode)}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] shadow-[2px_2px_0px_#000] text-black text-xs font-black cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 print:hidden no-print"
                            data-no-print="true"
                            title="Copy Pass Code"
                        >
                            {copiedTicket ? <Check className="w-3.5 h-3.5 text-black stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedTicket ? "Copied" : "Copy Code"}</span>
                        </button>
                    </div>
                ) : (
                    <div className="p-4 rounded-2xl bg-[#FFFBEB] border-2 border-black shadow-[3px_3px_0px_#000] text-left space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFE566] border border-black font-black text-[10px] uppercase tracking-wider text-black shadow-[1px_1px_0px_#000]">
                                <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Entry Pass Pending Organizer Review</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-800">
                                Pass Issuance Pending
                            </span>
                        </div>
                        <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                            Your entry pass number and check-in QR pass will be issued once your registration is approved by <strong className="text-black font-black">{club?.name || "the club organizers"}</strong>. You will receive an in-app notification immediately upon acceptance.
                        </p>
                    </div>
                )}

                {/* Collapsible Registration Details Summary */}
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setShowAnswersSummary((prev) => !prev)}
                        className="w-full p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between text-xs font-black uppercase tracking-wider text-black cursor-pointer hover:bg-neutral-50 transition-all print:hidden no-print"
                        data-no-print="true"
                    >
                        <span className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 stroke-[2.5]" />
                            <span>Submitted Registration Details</span>
                        </span>
                        {showAnswersSummary ? <ChevronUp className="w-4 h-4 stroke-[2.5]" /> : <ChevronDown className="w-4 h-4 stroke-[2.5]" />}
                    </button>

                    {/* Registration response details */}
                    <div className={`space-y-3 pt-3 text-xs ${showAnswersSummary ? "block" : "hidden print:block"}`}>
                        <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-neutral-500 font-black uppercase block text-[10px]">Applicant Name</span>
                                <p className="font-bold text-black">{submittedRegistration.applicantName || effectiveProfile.fullName}</p>
                            </div>
                            <div>
                                <span className="text-neutral-500 font-black uppercase block text-[10px]">Registered Email</span>
                                <p className="font-bold text-black">{submittedRegistration.applicantEmail || effectiveProfile.email}</p>
                            </div>
                            <div>
                                <span className="text-neutral-500 font-black uppercase block text-[10px]">Submission Time</span>
                                <p className="font-bold text-black font-mono">{submissionTimeStr}</p>
                            </div>
                            {submittedRegistration.rollNumber && (
                                <div>
                                    <span className="text-neutral-500 font-black uppercase block text-[10px]">Roll / ID</span>
                                    <p className="font-bold text-black font-mono">{submittedRegistration.rollNumber}</p>
                                </div>
                            )}
                            {submittedRegistration.department && (
                                <div>
                                    <span className="text-neutral-500 font-black uppercase block text-[10px]">Department</span>
                                    <p className="font-bold text-black">{submittedRegistration.department}</p>
                                </div>
                            )}
                        </div>

                        {/* Question answers list */}
                        {allQuestions.length > 0 && (
                            <div className="space-y-2.5 max-h-60 overflow-y-auto print:max-h-none print:overflow-visible pr-1">
                                {allQuestions.map((q) => {
                                    const submittedAns = submittedRegistration.answers?.[q.id];
                                    if (submittedAns === undefined || submittedAns === null || submittedAns === "") return null;

                                    return (
                                        <div key={q.id} className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1 text-left">
                                            <span className="font-black text-[10px] uppercase tracking-wide text-neutral-600 block">{q.title}</span>
                                            <p className="font-bold text-black text-xs whitespace-pre-wrap leading-relaxed">
                                                {typeof submittedAns === "object"
                                                    ? Array.isArray(submittedAns)
                                                        ? submittedAns.join(", ")
                                                        : JSON.stringify(submittedAns)
                                                    : String(submittedAns)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Uploaded file attachments */}
                        {submittedRegistration.fileAttachments && submittedRegistration.fileAttachments.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Uploaded Files</span>
                                {submittedRegistration.fileAttachments.map((f: FileAttachmentMeta, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <Paperclip className="w-4 h-4 text-black shrink-0" />
                                            <span className="font-black text-black truncate">{f.fileName}</span>
                                        </div>
                                        <a
                                            href={f.fileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1 rounded-lg bg-[#FFE566] text-black font-black text-[11px] border border-black hover:bg-[#FACC15] shrink-0 flex items-center gap-1 print:hidden no-print"
                                            data-no-print="true"
                                        >
                                            <span>View</span>
                                            <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quiz Assessment Result Card */}
                {isQuiz && (
                    <div className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50/50 space-y-3 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                                    <Award className="w-4 h-4" />
                                </span>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900">Quiz Assessment Result</h4>
                                    <p className="text-[10px] text-neutral-500">Evaluation and score breakdown</p>
                                </div>
                            </div>
                            {gradesReleased ? (
                                <div className="text-right">
                                    <span className="text-lg font-bold text-emerald-700">
                                        {submittedRegistration.quizScore ?? 0} / {submittedRegistration.quizMaxScore ?? 0}
                                    </span>
                                    <span className="block text-[10px] font-medium text-neutral-500">
                                        ({Math.round(((submittedRegistration.quizScore ?? 0) / (submittedRegistration.quizMaxScore || 1)) * 100)}%)
                                    </span>
                                </div>
                            ) : (
                                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-lg border border-amber-300">
                                    Review in Progress
                                </span>
                            )}
                        </div>

                        {!gradesReleased && (
                            <p className="text-xs text-neutral-600 bg-white p-2.5 rounded-xl border border-neutral-200 flex items-start gap-2">
                                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>Written and subjective answers are currently being evaluated by event staff. Your final score will be released here once review is complete.</span>
                            </p>
                        )}

                        {gradesReleased && submittedRegistration.quizGradedAnswers && (
                            <div className="space-y-2 pt-1">
                                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-900">Question Breakdown:</h5>
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {allQuestions.map((q) => {
                                        const gradedInfo = submittedRegistration.quizGradedAnswers?.[q.id];
                                        if (!gradedInfo) return null;
                                        const isCorrect = Boolean(gradedInfo.isCorrect);

                                        return (
                                            <div
                                                key={q.id}
                                                className={`p-2.5 rounded-xl border space-y-1.5 ${
                                                    isCorrect
                                                        ? "bg-white border-emerald-500/50"
                                                        : "bg-rose-50/60 border-rose-300"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-xs font-semibold text-neutral-900">{q.title}</span>
                                                    <span
                                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                                            isCorrect
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                                : "bg-rose-100 text-rose-800 border-rose-300"
                                                        }`}
                                                    >
                                                        {gradedInfo.earnedPoints ?? 0} / {gradedInfo.maxPoints ?? q.points ?? 1} pts
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-neutral-700">
                                                    <strong className="font-medium text-neutral-900">Your answer:</strong>{" "}
                                                    {Array.isArray(gradedInfo.studentAnswer)
                                                        ? gradedInfo.studentAnswer.join(", ")
                                                        : String(gradedInfo.studentAnswer ?? "(No answer provided)")}
                                                </div>
                                                {form.settings?.quiz?.showCorrectAnswers && !isCorrect && q.correctAnswers && q.correctAnswers.length > 0 && (
                                                    <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                                                        <span><strong className="font-semibold">Correct answer:</strong> {q.correctAnswers.join(", ")}</span>
                                                    </div>
                                                )}
                                                {gradedInfo.feedback && (
                                                    <div className="text-[11px] text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-neutral-200 flex items-center gap-1.5">
                                                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 inline shrink-0" />
                                                        <span>{gradedInfo.feedback}</span>
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

                {/* Official Footer Verification Strip */}
                <div className="pt-2.5 border-t-2 border-black/15 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-600 font-bold">
                    <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-black shrink-0" />
                        <span>Verified Event Admission Pass • Orbix ID: <strong className="text-black font-mono">{submittedRegistration.id}</strong></span>
                    </div>
                    <span className="font-mono text-[9px] text-neutral-400">orbix.in/verify</span>
                </div>

                {/* Action Buttons Toolbar (Strictly hidden when exporting PDF) */}
                <div
                    className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t-2 border-black/20 print:hidden no-print"
                    data-no-print="true"
                >
                    {/* Download Official Pass (PDF) */}
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isDownloadingPdf}
                        className="px-5 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60"
                        title="Download Pass as Official PDF"
                    >
                        <Download className="w-4 h-4 stroke-[2.5]" />
                        <span>{isDownloadingPdf ? "Generating PDF..." : "Download Pass (PDF)"}</span>
                    </button>

                    {/* View My Applications */}
                    <Link
                        to="/applications"
                        className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <span>My Applications</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                    </Link>

                    {/* Done / Close Button */}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            Done
                        </button>
                    )}

                    {/* Edit Response (if allowed) */}
                    {form.settings?.allowEditResponse && (
                        <button
                            type="button"
                            onClick={() => {
                                if (onEditResponse) {
                                    onEditResponse();
                                } else {
                                    setSubmittedRegistration(null);
                                }
                            }}
                            className="px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            Edit Response
                        </button>
                    )}

                    {/* Submit Another (if allowed) */}
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
                            className="px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            Submit Another
                        </button>
                    )}

                    {/* Done / Close */}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-900 font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            Done
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
            <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-xl p-8 text-center space-y-4 animate-in fade-in">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 stroke-[2.5]" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Registration Closed</h3>
                <p className="text-xs sm:text-sm text-neutral-500 font-normal whitespace-pre-line leading-relaxed">
                    {closedReason || form.settings?.closedMessage || "Registrations are currently closed for this event."}
                </p>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-sm cursor-pointer transition-colors"
                    >
                        Back
                    </button>
                )}
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: ACTIVE PUBLISHED FORM RESPONDER
    // -------------------------------------------------------------------------
    const progressPercent = totalSections > 1 ? Math.round(((currentSecIdx + 1) / totalSections) * 100) : 100;

    return (
        <div className={`w-full ${isPreview ? "max-w-full" : "max-w-5xl xl:max-w-6xl"} mx-auto space-y-6 text-neutral-900 dark:text-neutral-100`}>
            {/* Header Banner if present */}
            {form.headerImageUrl && (
                <div
                    className="rounded-2xl sm:rounded-3xl border-2 sm:border-[3px] overflow-hidden shadow-[4px_4px_0px_#000] bg-neutral-100 dark:bg-neutral-900"
                    style={{ borderColor: accentColor }}
                >
                    <img
                        src={getCloudinaryBannerUrl(form.headerImageUrl)}
                        alt="Form Banner"
                        loading="lazy"
                        className="w-full h-44 sm:h-64 lg:h-72 object-cover"
                    />
                </div>
            )}

            {/* Form Title & Context Card */}
            <div
                className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] shadow-[4px_4px_0px_#000] p-6 sm:p-7 space-y-3 relative overflow-hidden"
                style={{
                    borderColor: accentColor,
                    backgroundColor: cardSurfaceColor || undefined,
                }}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                        {club?.name || "Verified Club Event"}
                    </span>

                    {/* Autosave Status Pill & Clear Form */}
                    <div className="flex items-center gap-2">
                        {isAutosaveEnabled && (
                            <div className="flex items-center gap-2">
                                {saveStatus === "saving" && (
                                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full">
                                        <OrbixLoader size="xs" variant="inline" color="currentColor" />
                                        <span>Saving draft...</span>
                                    </span>
                                )}
                                {saveStatus === "saved" && (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Draft saved{lastSavedAt ? ` (${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}</span>
                                    </span>
                                )}
                                {saveStatus === "offline" && (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Saved locally</span>
                                    </span>
                                )}
                                {saveStatus === "unsaved" && (
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                        <Clock className="w-3 h-3" />
                                        <span>Unsaved changes</span>
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setShowClearConfirm(true)}
                                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Clear entered answers"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Clear</span>
                                </button>
                            </div>
                        )}

                        {isPreview && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                                Simulator / Preview Mode
                            </span>
                        )}
                    </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {form.title}
                </h1>

                {form.description && (
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-normal whitespace-pre-line leading-relaxed">
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

            {/* Restored Draft Notice Banner */}
            {draftRestoredNotice && (
                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border border-neutral-800 dark:border-neutral-200 shadow-sm flex items-center justify-between text-xs font-medium animate-in fade-in">
                    <span className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 shrink-0" />
                        <span>{draftRestoredNotice}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setDraftRestoredNotice(null)}
                        className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Verified Orbix Student Identity Card */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shadow-sm">
                            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                Verified Orbix Student Identity
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                    Orbix Verified
                                </span>
                            </h3>
                            <p className="text-[11px] text-neutral-500 font-normal">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Name & Avatar */}
                    <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-black/20 flex items-center gap-3">
                        <img
                            src={getCloudinaryAvatarUrl(effectiveProfile.avatarUrl)}
                            alt=""
                            loading="lazy"
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
                                Event-Specific Contact Override
                            </span>
                            <span className="text-[10px] text-neutral-500 font-bold">
                                Only modifies your contact for this event
                            </span>
                        </div>
                        <div className="max-w-xs text-xs">
                            <label className="font-bold text-neutral-700 block mb-1">Phone / WhatsApp</label>
                            <input
                                type="text"
                                value={answers["q_phone"] || ""}
                                onChange={(e) => setAnswer("q_phone", e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full p-2 rounded-xl border border-black font-bold bg-white text-black focus:outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Multi-Section Progress Bar (4.2 Multi-Section Forms) */}
            {totalSections > 1 && form.settings?.showProgressBar && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
                        <span>
                            Section {currentSecIdx + 1} of {totalSections}
                        </span>
                        <span>{progressPercent}% Complete</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-neutral-900 dark:bg-white transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Active Section Header Card (Section Title & Description) */}
            {activeSection && (activeSection.title || activeSection.description) && (
                <div
                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] border-black dark:border-white shadow-[4px_4px_0px_#000] space-y-1"
                    style={{
                        backgroundColor: cardSurfaceColor || undefined,
                    }}
                >
                    <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">{activeSection.title}</h3>
                    {activeSection.description && (
                        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">{activeSection.description}</p>
                    )}
                </div>
            )}

            {/* Questions List for Current Relevant Section */}
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
                                    id={`q_wrapper_${question.id}`}
                                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] shadow-[3px_3px_0px_#000] space-y-2"
                                    style={{
                                        borderColor: accentColor,
                                        backgroundColor: cardSurfaceColor || undefined,
                                    }}
                                >
                                    {question.title && (
                                        <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">{question.title}</h3>
                                    )}
                                    {question.description && (
                                        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-normal whitespace-pre-line leading-relaxed">
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
                                    id={`q_wrapper_${question.id}`}
                                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] shadow-[3px_3px_0px_#000] space-y-2.5"
                                    style={{
                                        borderColor: accentColor,
                                        backgroundColor: cardSurfaceColor || undefined,
                                    }}
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{question.title}</h4>
                                    )}
                                    {question.imageUrl && (
                                        <div className={`flex ${alignClass}`}>
                                            <img
                                                src={getOptimizedCloudinaryUrl(question.imageUrl, { width: 800, quality: "auto" })}
                                                alt=""
                                                loading="lazy"
                                                className="rounded-xl border border-neutral-200 dark:border-neutral-800 object-cover max-h-80 max-w-full"
                                            />
                                        </div>
                                    )}
                                    {question.imageCaption && (
                                        <p className="text-xs text-neutral-400 font-normal italic text-center">
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
                                    id={`q_wrapper_${question.id}`}
                                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] shadow-[3px_3px_0px_#000] space-y-3"
                                    style={{
                                        borderColor: accentColor,
                                        backgroundColor: cardSurfaceColor || undefined,
                                    }}
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{question.title}</h4>
                                    )}
                                    {embedUrl ? (
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm bg-black">
                                            <iframe
                                                src={embedUrl}
                                                title={question.title || "Embedded Video"}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="w-full h-full"
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-6 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-center text-xs text-neutral-400 font-medium">
                                            No valid video URL configured
                                        </div>
                                    )}
                                    {(question.videoTitle || question.description) && (
                                        <p className="text-xs text-neutral-400 font-normal italic text-center">
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
                                    id={`q_wrapper_${question.id}`}
                                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-neutral-50 dark:bg-neutral-900 border-2 sm:border-[3px] shadow-[3px_3px_0px_#000] space-y-2"
                                    style={{
                                        borderColor: accentColor,
                                        backgroundColor: cardSurfaceColor || undefined,
                                    }}
                                >
                                    {question.title && (
                                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{question.title}</h4>
                                    )}
                                    <div className="text-xs text-neutral-700 dark:text-neutral-300 font-normal whitespace-pre-line leading-relaxed">
                                        {question.content || question.description}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={question.id}
                                id={`q_wrapper_${question.id}`}
                                className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] transition-all space-y-3 shadow-[3px_3px_0px_#000] ${
                                    qError
                                        ? "ring-2 ring-rose-500/50"
                                        : ""
                                }`}
                                style={{
                                    borderColor: qError ? "#F43F5E" : accentColor,
                                    backgroundColor: cardSurfaceColor || undefined,
                                }}
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
                                            src={getOptimizedCloudinaryUrl(question.imageUrl, { width: 800, quality: "auto" })}
                                            alt=""
                                            loading="lazy"
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
                                        className="w-full text-xs sm:text-sm font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                                    />
                                )}

                                {/* Input Type: Paragraph */}
                                {question.type === "paragraph" && (
                                    <textarea
                                        value={val ?? ""}
                                        onChange={(e) => setAnswer(question.id, e.target.value)}
                                        placeholder={question.placeholder || "Your answer..."}
                                        rows={3}
                                        className="w-full text-xs sm:text-sm font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-y"
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
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                            isChecked
                                                                ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900 shadow-sm"
                                                                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#0A0A0A]"
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
                                                            className="w-4 h-4 accent-neutral-900 dark:accent-white cursor-pointer"
                                                        />
                                                        <span className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 flex-1">
                                                            {opt.text}
                                                        </span>
                                                        {opt.imageUrl && (
                                                            <img
                                                                src={getCloudinaryThumbnailUrl(opt.imageUrl, 100)}
                                                                alt=""
                                                                loading="lazy"
                                                                className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 object-cover shrink-0"
                                                            />
                                                        )}
                                                    </label>
                                                    {isOtherOpt && isChecked && (
                                                        <input
                                                            type="text"
                                                            placeholder="Please specify other..."
                                                            value={typeof val === "string" && val.startsWith("Other: ") ? val.replace("Other: ", "") : ""}
                                                            onChange={(e) => setAnswer(question.id, `Other: ${e.target.value}`)}
                                                            className="w-full text-xs sm:text-sm font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 ml-0 sm:ml-4 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white shadow-sm"
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
                                                    <div
                                                        onClick={toggleCheck}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                            isChecked
                                                                ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900 shadow-sm"
                                                                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#0A0A0A]"
                                                        }`}
                                                    >
                                                        <NeoCheckbox
                                                            checked={isChecked}
                                                            onCheckedChange={toggleCheck}
                                                            size="sm"
                                                        />
                                                        <span className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 flex-1">
                                                            {opt.text}
                                                        </span>
                                                        {opt.imageUrl && (
                                                            <img
                                                                src={getCloudinaryThumbnailUrl(opt.imageUrl, 100)}
                                                                alt=""
                                                                loading="lazy"
                                                                className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 object-cover shrink-0"
                                                            />
                                                        )}
                                                    </div>
                                                    {isOtherOpt && isChecked && (
                                                        <input
                                                            type="text"
                                                            placeholder="Please specify other..."
                                                            value={otherEntry ? otherEntry.replace("Other: ", "") : ""}
                                                            onChange={(e) => {
                                                                const updated = currentArr.filter((t) => !t.startsWith("Other: ") && t !== opt.text);
                                                                setAnswer(question.id, [...updated, `Other: ${e.target.value}`]);
                                                            }}
                                                            className="w-full text-xs sm:text-sm font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 ml-0 sm:ml-4 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white shadow-sm"
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
                                    <NeoSelect
                                        value={val ?? ""}
                                        onChange={(selectedVal) => setAnswer(question.id, selectedVal)}
                                        placeholder="Select an option..."
                                        size="md"
                                    >
                                        <option value="">Select an option...</option>
                                        {(question.options || []).map((opt) => (
                                            <option key={opt.id} value={opt.text}>
                                                {opt.text}
                                            </option>
                                        ))}
                                    </NeoSelect>
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
                                                        className={`w-10 h-10 rounded-xl border font-semibold text-xs sm:text-sm flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 ${
                                                            isSelected
                                                                ? "border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                                                                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
                                                        }`}
                                                    >
                                                        {score}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {(question.scaleConfig?.minLabel || question.scaleConfig?.maxLabel) && (
                                            <div className="flex items-center justify-between text-xs font-normal text-neutral-500">
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
                                                            className={`p-2.5 rounded-xl border cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                                                                isSelected
                                                                    ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900 shadow-sm"
                                                                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 bg-white dark:bg-neutral-900"
                                                            }`}
                                                            title={`Rate ${lvl} / ${levels}`}
                                                        >
                                                            {icon === "star" && (
                                                                <Star
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-amber-500 fill-amber-400"
                                                                            : "text-neutral-300 dark:text-neutral-600"
                                                                    }`}
                                                                />
                                                            )}
                                                            {icon === "heart" && (
                                                                <Heart
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-rose-500 fill-rose-500"
                                                                            : "text-neutral-300 dark:text-neutral-600"
                                                                    }`}
                                                                />
                                                            )}
                                                            {icon === "thumb" && (
                                                                <ThumbsUp
                                                                    className={`w-6 h-6 ${
                                                                        isSelected
                                                                            ? "text-sky-600 fill-sky-500"
                                                                            : "text-neutral-300 dark:text-neutral-600"
                                                                    }`}
                                                                />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                                {currentRating > 0 && (
                                                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 ml-2 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
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
                                            <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                                        {fileAttachments.find((f) => f.questionId === question.id)?.fileName}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(question.id)}
                                                    className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer transition-colors"
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
                                                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 shadow-sm">
                                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                                                        <span>Use Verified Orbix Resume</span>
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                                            Verified
                                                                        </span>
                                                                    </p>
                                                                    <p className="text-[11px] text-neutral-500 font-normal truncate">
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
                                                                className="px-3.5 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs shadow-sm cursor-pointer shrink-0 hover:bg-neutral-800 transition-colors"
                                                            >
                                                                Attach
                                                            </button>
                                                        </div>
                                                    )}

                                                <label className="border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50/70 dark:bg-neutral-900/50 hover:bg-neutral-100/70 transition-colors">
                                                    <UploadCloud className="w-5 h-5 text-neutral-500" />
                                                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                                        {uploadProgress[question.id]
                                                            ? `Uploading (${uploadProgress[question.id]}%)...`
                                                            : "Select or Drop File to Upload"}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-400 font-normal">
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
                                                                        className="p-2 text-center border-b border-neutral-100 dark:border-neutral-800"
                                                                    >
                                                                        {question.type === "checkbox_grid" ? (
                                                                            <div className="flex justify-center">
                                                                                <NeoCheckbox
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={() => handleGridCheck()}
                                                                                    size="sm"
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type="radio"
                                                                                name={`${question.id}_row_${rIdx}`}
                                                                                checked={isChecked}
                                                                                onChange={handleGridCheck}
                                                                                className="w-4 h-4 accent-neutral-900 dark:accent-white cursor-pointer"
                                                                            />
                                                                        )}
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
                                    <NeoDateTimePicker
                                        value={val ?? ""}
                                        onChange={(nextVal) => setAnswer(question.id, nextVal)}
                                        mode={question.dateConfig?.includeTime ? "datetime" : "date"}
                                        placeholder={question.dateConfig?.includeTime ? "Select date & time..." : "Select date..."}
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
                                                    className="w-16 text-center text-xs sm:text-sm font-medium border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                                                />
                                                <span className="text-xs font-medium text-neutral-500">hrs</span>
                                            </div>
                                            <span className="font-medium text-neutral-400">:</span>
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
                                                    className="w-16 text-center text-xs sm:text-sm font-medium border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                                                />
                                                <span className="text-xs font-medium text-neutral-500">mins</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            type="time"
                                            value={typeof val === "string" ? val : ""}
                                            onChange={(e) => setAnswer(question.id, e.target.value)}
                                            className="w-full text-xs sm:text-sm font-medium border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
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

            {/* Stepper Navigation Buttons (Next / Previous / Final Submission) */}
            <div className="pt-4 flex items-center justify-between gap-3">
                {currentSecIdx > 0 ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="h-10 px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 dark:bg-neutral-900 font-bold text-xs text-neutral-800 dark:text-neutral-200 shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        <span>Previous Section</span>
                    </button>
                ) : onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="h-10 px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 dark:bg-neutral-900 font-bold text-xs text-neutral-800 dark:text-neutral-200 shadow-[2px_2px_0px_#000] flex items-center justify-center cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
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
                    className="h-10 px-6 py-2 rounded-xl border-2 border-black font-black text-xs shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                    style={{ backgroundColor: accentColor, color: "#000" }}
                >
                    {isSubmitting ? (
                        <>
                            <OrbixLoader size="xs" variant="inline" color="#000" />
                            <span>Submitting registration...</span>
                        </>
                    ) : currentSecIdx === totalSections - 1 ? (
                        <span>Submit Registration</span>
                    ) : (
                        <>
                            <span>Next Section</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>

            {/* Clear Form Confirmation Modal */}
            <ConfirmationModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearForm}
                title="Clear Registration Form?"
                description="This will erase all your entered answers and attachments saved in this draft. This cannot be undone."
                confirmText="Yes, Clear Form"
                cancelText="Keep Editing"
                variant="danger"
            />
        </div>
    );
};
