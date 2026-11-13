import React, { useState, useEffect, useId } from "react";
import {
    X,
    Calendar,
    MapPin,
    AlertCircle,
    CheckCircle2,
    CheckCheck,
    Sparkles,
    ArrowLeft,
    ArrowRight,
    Info,
    Check,
    Globe2,
    GraduationCap,
    Users,
    User,
} from "lucide-react";
import { NeoSelect } from "../../components/NeoSelect";
import { NeoImageDropzone } from "../../components/NeoImageDropzone";
import { NeoDateTimePicker } from "../../components/NeoDateTimePicker";
import { EventLiveListingCard } from "../../components/EventLiveListingCard";
import { OrbixButton } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../utils/clubProfileApi";
import { ClubMarkdownEditor } from "./Profile/ClubMarkdownEditor";
import {
    PRESET_EVENT_BANNERS,
    getRandomPresetBanner,
} from "../../components/EventBanners/presetEventBanners";
import { EventFormBuilderWorkspace } from "./FormBuilder/EventFormBuilderWorkspace";
import type {
    FormStructure,
    FormQuestion,
} from "../../api/clubEventFormApi";
import type {
    ClubEvent,
    CreateClubEventPayload,
    ClubEventStatus,
} from "../../store/clubEventsSlice";

export interface ClubEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (eventData: CreateClubEventPayload, isEditing: boolean, eventId?: string) => void;
    editingEvent?: ClubEvent | null;
    selectedScope?: "PAN_INDIA" | "CAMPUS";
    clubId?: string;
    clubName?: string;
    clubLogoUrl?: string | null;
    collegeName?: string;
    collegeId?: string | null;
    initialStatus?: ClubEventStatus;
    onOpenMobileSidebar?: () => void;
}

interface FormState {
    title: string;
    summary: string;
    description: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string;
    registrationUrl: string;
    coverImageUrl: string;
    status: ClubEventStatus;
    scope: "PAN_INDIA" | "CAMPUS";
    isTeamEvent: boolean;
    minTeamSize: number;
    maxTeamSize: number;
}

interface FormErrors {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    registrationUrl?: string;
    venueOrLocation?: string;
    teamSize?: string;
}

const URL_REGEX = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?(\?.*)?$/i;

const DEFAULT_QUESTIONS: FormQuestion[] = [
    {
        id: "q_solo_team",
        type: "multiple_choice",
        title: "Are you registering as an individual or team?",
        description: "Select whether you are hacking solo or with an established team.",
        required: true,
        options: [
            { id: "opt_indiv", text: "Individual (Looking for a team)" },
            { id: "opt_solo", text: "Solo Participant" },
            { id: "opt_team", text: "Team (I am the Team Leader)" },
            { id: "opt_member", text: "Team Member" },
        ],
    },
    {
        id: "q_track",
        type: "multiple_choice",
        title: "Preferred Track / Domain",
        description: "Which domain will you focus on during this event?",
        required: true,
        options: [
            { id: "opt_fullstack", text: "Full-Stack Web Development" },
            { id: "opt_ai", text: "AI / Machine Learning" },
            { id: "opt_mobile", text: "Mobile App Development" },
            { id: "opt_cloud", text: "Cloud & DevOps" },
            { id: "opt_design", text: "UI/UX & Product Design" },
        ],
    },
    {
        id: "q_tech_stack",
        type: "checkboxes",
        title: "Primary Tech Stack & Tools",
        description: "Select technologies you have experience with or plan to use.",
        required: false,
        options: [
            { id: "opt_react", text: "React / Next.js" },
            { id: "opt_node", text: "Node.js / Express" },
            { id: "opt_python", text: "Python / FastAPI / Django" },
            { id: "opt_ts", text: "TypeScript" },
            { id: "opt_postgres", text: "PostgreSQL / Prisma" },
            { id: "opt_docker", text: "Docker / Kubernetes" },
        ],
    },
];

export const ClubEventModal: React.FC<ClubEventModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    editingEvent,
    selectedScope = "CAMPUS",
    clubId,
    clubName = "Club",
    clubLogoUrl,
    collegeName = "Pranveer Singh Institute of Technology, Kanpur",
    initialStatus = "published",
    onOpenMobileSidebar,
}) => {
    const toast = useToast();
    const modalId = useId();

    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

    const formatForInput = (isoStr: string | null | undefined): string => {
        if (!isoStr) return "";
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return "";
            const pad = (n: number) => (n < 10 ? `0${n}` : n);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
            return "";
        }
    };

    const [form, setForm] = useState<FormState>({
        title: "",
        summary: "",
        description: "",
        startsAt: "",
        endsAt: "",
        timezone: "Asia/Kolkata",
        locationType: "in_person",
        venueOrLocation: "",
        registrationUrl: "",
        coverImageUrl: "",
        status: initialStatus,
        scope: editingEvent?.scope || selectedScope || "CAMPUS",
        isTeamEvent: Boolean(editingEvent?.isTeamEvent),
        minTeamSize: editingEvent?.minTeamSize || 1,
        maxTeamSize: editingEvent?.maxTeamSize || 4,
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // Banner upload states
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Form builder state for Step 3
    const [formStructure, setFormStructure] = useState<FormStructure>({
        sections: [
            {
                id: "sec_default_1",
                title: "Participant Information & Preferences",
                description: "Tell the organizers about your background and interests.",
                afterSectionAction: "submit_form",
                questions: DEFAULT_QUESTIONS,
            },
        ],
    });
    const [formSettings, setFormSettings] = useState<any>({
        allowMultipleResponses: false,
        limitOneResponsePerUser: true,
        showProgressBar: true,
        shuffleQuestions: false,
    });
    const [formTheme, setFormTheme] = useState<any>({
        accentColor: "#38BDF8",
        themePreset: "neo_brutalist",
    });

    // Initialize or reset form when modal opens or editingEvent changes
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1);
            if (editingEvent) {
                setForm({
                    title: editingEvent.title || "",
                    summary: editingEvent.summary || "",
                    description: editingEvent.description || "",
                    startsAt: formatForInput(editingEvent.startsAt),
                    endsAt: formatForInput(editingEvent.endsAt),
                    timezone: editingEvent.timezone || "Asia/Kolkata",
                    locationType: editingEvent.locationType || "in_person",
                    venueOrLocation: editingEvent.venueOrLocation || "",
                    registrationUrl: editingEvent.registrationUrl || "",
                    coverImageUrl: editingEvent.coverImageUrl || "",
                    status: editingEvent.status || "published",
                    scope: editingEvent.scope || selectedScope || "CAMPUS",
                    isTeamEvent: Boolean(editingEvent.isTeamEvent),
                    minTeamSize: editingEvent.minTeamSize || 1,
                    maxTeamSize: editingEvent.maxTeamSize || 4,
                });
            } else {
                const defaultBanner = getRandomPresetBanner().dataUrl;
                setForm({
                    title: "",
                    summary: "",
                    description: "",
                    startsAt: "",
                    endsAt: "",
                    timezone: "Asia/Kolkata",
                    locationType: "in_person",
                    venueOrLocation: "",
                    registrationUrl: "",
                    coverImageUrl: defaultBanner,
                    status: initialStatus,
                    scope: selectedScope || "CAMPUS",
                    isTeamEvent: false,
                    minTeamSize: 1,
                    maxTeamSize: 4,
                });
                setFormStructure({
                    sections: [
                        {
                            id: "sec_default_1",
                            title: "Participant Information & Preferences",
                            description: "Tell the organizers about your background and interests.",
                            afterSectionAction: "submit_form",
                            questions: JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)),
                        },
                    ],
                });
                setFormSettings({
                    allowMultipleResponses: false,
                    limitOneResponsePerUser: true,
                    showProgressBar: true,
                    shuffleQuestions: false,
                });
                setFormTheme({
                    accentColor: "#38BDF8",
                    themePreset: "neo_brutalist",
                });
            }
            setErrors({});
            setTouched({});
            setIsUploadingBanner(false);
            setUploadProgress(null);
        }
    }, [isOpen, editingEvent, initialStatus]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isUploadingBanner) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isUploadingBanner, onClose]);

    // Validation logic for valid details only
    const validate = (currentForm: FormState): FormErrors => {
        const errs: FormErrors = {};

        // 1. Title validation
        const trimmedTitle = currentForm.title.trim();
        if (!trimmedTitle) {
            errs.title = "Event title is required.";
        } else if (trimmedTitle.length < 3) {
            errs.title = "Title must be at least 3 characters.";
        } else if (trimmedTitle.length > 120) {
            errs.title = "Title cannot exceed 120 characters.";
        }

        // 2. Starts At validation
        if (!currentForm.startsAt) {
            errs.startsAt = "Event start date and time is required.";
        } else {
            const startDate = new Date(currentForm.startsAt);
            if (isNaN(startDate.getTime())) {
                errs.startsAt = "Please enter a valid start date and time.";
            }
        }

        // 3. Ends At validation
        if (currentForm.endsAt) {
            const endDate = new Date(currentForm.endsAt);
            if (isNaN(endDate.getTime())) {
                errs.endsAt = "Please enter a valid end date and time.";
            } else if (currentForm.startsAt) {
                const startDate = new Date(currentForm.startsAt);
                if (endDate.getTime() <= startDate.getTime()) {
                    errs.endsAt = "End date and time must be strictly after the start date and time.";
                }
            }
        }

        // 4. Registration URL validation
        if (currentForm.registrationUrl.trim()) {
            const regUrl = currentForm.registrationUrl.trim();
            if (!URL_REGEX.test(regUrl)) {
                errs.registrationUrl = "Must be a valid URL starting with http:// or https:// (e.g. https://forms.gle/...)";
            }
        }

        // 5. Venue or Location details validation for in_person / hybrid when published
        if (currentForm.status === "published" && (currentForm.locationType === "in_person" || currentForm.locationType === "hybrid")) {
            if (!currentForm.venueOrLocation.trim()) {
                errs.venueOrLocation = "Venue / campus room is recommended for published in-person sessions.";
            }
        }

        // 6. Team size validation if team event enabled
        if (currentForm.isTeamEvent) {
            const min = Number(currentForm.minTeamSize) || 1;
            const max = Number(currentForm.maxTeamSize) || 4;
            if (min < 1) {
                errs.teamSize = "Minimum team size must be at least 1.";
            } else if (max < min) {
                errs.teamSize = `Maximum team size cannot be smaller than minimum (${min}).`;
            } else if (max > 50) {
                errs.teamSize = "Maximum team size cannot exceed 50.";
            }
        }

        return errs;
    };

    const handleBlur = (field: string) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        setErrors(validate(form));
    };

    const handleBannerFileSelect = async (file: File) => {
        try {
            setIsUploadingBanner(true);
            setUploadProgress(0);

            // Fetch signed upload params for banner
            const uploadConfig = await requestClubUploadSignature("banner", clubId);

            // Upload directly with real-time progress
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setUploadProgress(percent);
            });

            setForm((prev) => ({ ...prev, coverImageUrl: result.secureUrl }));
            toast.success("Event banner uploaded successfully!", { title: "Media Uploaded" });
        } catch (err: any) {
            console.error("Banner upload failed:", err);
            toast.error(err.message || "Failed to upload banner image. Please try again.", {
                title: "Upload Failed",
            });
        } finally {
            setIsUploadingBanner(false);
            setUploadProgress(null);
        }
    };

    // Step 1 -> Step 2 Navigation
    const handleGoToStep2 = () => {
        setTouched({
            title: true,
            startsAt: true,
            endsAt: true,
            registrationUrl: true,
            venueOrLocation: true,
        });

        const validationErrors = validate(form);
        setErrors(validationErrors);

        if (
            validationErrors.title ||
            validationErrors.startsAt ||
            validationErrors.endsAt ||
            validationErrors.registrationUrl
        ) {
            const firstError =
                validationErrors.title ||
                validationErrors.startsAt ||
                validationErrors.endsAt ||
                validationErrors.registrationUrl;
            toast.error(firstError || "Please correct the highlighted fields before proceeding.", {
                title: "Validation Error",
            });
            return;
        }

        // Ensure banner is selected; if empty, pick a random preset
        if (!form.coverImageUrl) {
            setForm((prev) => ({ ...prev, coverImageUrl: getRandomPresetBanner().dataUrl }));
        }

        setCurrentStep(2);
    };

    // Step 2 -> Step 3 Navigation
    const handleGoToStep3 = () => {
        if (!form.coverImageUrl) {
            setForm((prev) => ({ ...prev, coverImageUrl: getRandomPresetBanner().dataUrl }));
        }
        setCurrentStep(3);
    };

    // Form builder helper methods for Step 3
    const totalQuestions = formStructure.sections.reduce((acc, s) => acc + s.questions.length, 0);

    // Final Submission Handler (Atomic Launch)
    const handleSubmitFinal = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Validate Step 1
        const validationErrors = validate(form);
        if (
            validationErrors.title ||
            validationErrors.startsAt ||
            validationErrors.endsAt ||
            validationErrors.registrationUrl
        ) {
            setCurrentStep(1);
            setTouched({
                title: true,
                startsAt: true,
                endsAt: true,
                registrationUrl: true,
                venueOrLocation: true,
            });
            setErrors(validationErrors);
            const firstError =
                validationErrors.title ||
                validationErrors.startsAt ||
                validationErrors.endsAt ||
                validationErrors.registrationUrl;
            toast.error(firstError || "Please fix validation errors in Step 1.", {
                title: "Validation Error",
            });
            return;
        }

        // Validate Step 3 Form Questions
        if (totalQuestions === 0) {
            setCurrentStep(3);
            toast.error("The registration form cannot be empty. Please include at least 1 question for participants.", {
                title: "Registration Form Required",
            });
            return;
        }

        const effectiveBanner = form.coverImageUrl.trim() || getRandomPresetBanner().dataUrl;

        // Construct clean payload with valid details only
        const payload: CreateClubEventPayload = {
            title: form.title.trim(),
            summary: form.summary.trim() || null,
            description: form.description.trim() || null,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            timezone: form.timezone,
            locationType: form.locationType,
            venueOrLocation: form.venueOrLocation.trim() || null,
            registrationUrl: form.registrationUrl.trim() || null,
            coverImageUrl: effectiveBanner,
            status: form.status,
            scope: form.scope,
            isTeamEvent: form.isTeamEvent,
            minTeamSize: form.minTeamSize,
            maxTeamSize: form.maxTeamSize,
            initialFormStructure: formStructure,
            initialFormSettings: formSettings,
            initialFormTheme: formTheme,
        };

        // Fire callback immediately for optimistic update
        onSubmit(payload, Boolean(editingEvent), editingEvent?.id);
    };

    if (!isOpen) return null;

    return (
        <div
            id={modalId}
            className="w-full flex-1 flex flex-col min-h-0 text-black space-y-6"
        >
            {/* Top Workspace Header Bar */}
            <div className="pb-5 border-b-2 border-black/55 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {onOpenMobileSidebar && (
                        <button
                            type="button"
                            onClick={onOpenMobileSidebar}
                            className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer shrink-0"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    )}

                    <div className="truncate">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg lg:text-xl font-black text-black tracking-tight truncate">
                                {editingEvent ? "Edit Club Event" : "Create New Club Event"}
                            </h2>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${
                                    form.status === "published"
                                        ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                        : form.status === "completed"
                                        ? "bg-sky-300 text-black shadow-[1px_1px_0px_#000]"
                                        : form.status === "draft"
                                        ? "bg-amber-300 text-black shadow-[1px_1px_0px_#000]"
                                        : "bg-rose-300 text-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                {form.status === "published"
                                    ? "Live Stage"
                                    : form.status === "completed"
                                    ? "Completed Stage"
                                    : form.status === "draft"
                                    ? "Draft Stage"
                                    : "Cancelled Stage"}
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-neutral-600 font-medium truncate">
                            Step {currentStep} of 3: {currentStep === 1 ? "Event Information" : currentStep === 2 ? "Banner Selection" : "Registration Form"}
                        </p>
                    </div>
                </div>

                {/* Center / Right: 3-Step Wizard Navigation Stepper */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Stepper Pills */}
                    <div className="flex items-center bg-[#FAF6EE] p-1 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                                currentStep === 1
                                    ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-white/60"
                            }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">1</span>
                            <span>Event Info</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleGoToStep2()}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                                currentStep === 2
                                    ? "bg-[#38BDF8] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-white/60"
                            }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">2</span>
                            <span>Banner</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleGoToStep3()}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                                currentStep === 3
                                    ? "bg-[#A2FF86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-white/60"
                            }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">3</span>
                            <span>Form ({totalQuestions})</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* STEP 1: EVENT INFORMATION & SCHEDULE */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 1 && (
                <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Step 1 of 3
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black">Event Information & Schedule</h3>
                        </div>
                        <span className="text-[11px] font-bold text-neutral-500 bg-white px-2.5 py-1 rounded-lg border border-black/30 shadow-[1px_1px_0px_#000]">
                            * Required Fields
                        </span>
                    </div>

                    {/* Scope Indicator Banner (Phase 2) */}
                    <div
                        className={`p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            form.scope === "PAN_INDIA"
                                ? "bg-gradient-to-r from-orange-50 via-white to-emerald-50 border-orange-500"
                                : "bg-sky-50 border-sky-600"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-11 h-11 rounded-2xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 ${
                                    form.scope === "PAN_INDIA" ? "bg-[#FF9933] text-black" : "bg-[#38BDF8] text-black"
                                }`}
                            >
                                {form.scope === "PAN_INDIA" ? (
                                    <Globe2 className="w-5 h-5 stroke-[2.3]" />
                                ) : (
                                    <GraduationCap className="w-5 h-5 stroke-[2.3]" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 ${
                                            form.scope === "PAN_INDIA"
                                                ? "bg-[#FF9933] text-black"
                                                : "bg-[#38BDF8] text-black"
                                        }`}
                                    >
                                        {form.scope === "PAN_INDIA" ? (
                                            <>
                                                <Globe2 className="w-3 h-3" />
                                                <span>Pan India Reach</span>
                                            </>
                                        ) : (
                                            <>
                                                <GraduationCap className="w-3 h-3" />
                                                <span>Campus Only</span>
                                            </>
                                        )}
                                    </span>
                                    <span className="text-xs font-black text-black">
                                        {form.scope === "PAN_INDIA"
                                            ? "National Discovery & Cross-College Participation"
                                            : `Exclusive to ${collegeName || "Host Campus"}`}
                                    </span>
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium mt-0.5">
                                    {form.scope === "PAN_INDIA"
                                        ? "Students from colleges throughout India can discover and register for this session."
                                        : `Registration restricted exclusively to verified students of ${collegeName || "your college"}.`}
                                </p>
                            </div>
                        </div>

                        {!editingEvent && (
                            <button
                                type="button"
                                onClick={() =>
                                    setForm((prev) => ({
                                        ...prev,
                                        scope: prev.scope === "PAN_INDIA" ? "CAMPUS" : "PAN_INDIA",
                                    }))
                                }
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-[11px] font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-all shrink-0 self-start sm:self-center"
                            >
                                Switch to {form.scope === "PAN_INDIA" ? "Campus Only" : "Pan India"}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Sub-column: Title, Schedule, Location */}
                        <div className="space-y-5">
                            {/* 1. Title */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                                        Event Title *
                                    </label>
                                    <span
                                        className={`text-[10px] font-mono font-bold ${
                                            form.title.length > 120
                                                ? "text-rose-600"
                                                : form.title.length >= 3
                                                ? "text-emerald-700"
                                                : "text-neutral-500"
                                        }`}
                                    >
                                        {form.title.length}/120
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    onBlur={() => handleBlur("title")}
                                    maxLength={120}
                                    placeholder="e.g. Masterclass: System Design & Microservices Architecture"
                                    className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${
                                        touched.title && errors.title
                                            ? "border-rose-500 bg-rose-50/50"
                                            : "border-black focus:ring-2 focus:ring-[#a2ff86]"
                                    }`}
                                />
                                {touched.title && errors.title && (
                                    <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.title}</span>
                                    </p>
                                )}
                            </div>

                            {/* 2. Schedule Row: Starts At & Ends At */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                                <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                                    <Calendar className="w-4 h-4 text-neutral-700" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Schedule & Timings
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <NeoDateTimePicker
                                            label="Starts At"
                                            required
                                            value={form.startsAt}
                                            onChange={(val) => {
                                                setForm({ ...form, startsAt: val });
                                                if (errors.startsAt) {
                                                    setErrors({ ...errors, startsAt: undefined });
                                                }
                                            }}
                                            onBlur={() => handleBlur("startsAt")}
                                            error={touched.startsAt ? errors.startsAt : undefined}
                                            placeholder="Pick event start date & time"
                                            mode="datetime"
                                        />
                                        {touched.startsAt && errors.startsAt && (
                                            <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                <span>{errors.startsAt}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <NeoDateTimePicker
                                            label="Ends At (Optional)"
                                            value={form.endsAt}
                                            onChange={(val) => {
                                                setForm({ ...form, endsAt: val });
                                                if (errors.endsAt) {
                                                    setErrors({ ...errors, endsAt: undefined });
                                                }
                                            }}
                                            onBlur={() => handleBlur("endsAt")}
                                            error={touched.endsAt ? errors.endsAt : undefined}
                                            placeholder="Pick event end date & time"
                                            mode="datetime"
                                        />
                                        {touched.endsAt && errors.endsAt && (
                                            <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                <span>{errors.endsAt}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[10px] text-neutral-500 font-medium">
                                    * Times are formatted according to Indian Standard Time (Asia/Kolkata).
                                </p>
                            </div>

                            {/* 3. Location Row */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                                <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                                    <MapPin className="w-4 h-4 text-neutral-700" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Location & Venue
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Location Type *
                                        </label>
                                        <NeoSelect
                                            value={form.locationType}
                                            onChange={(val) =>
                                                setForm({ ...form, locationType: val as any })
                                            }
                                            options={[
                                                { value: "in_person", label: "In-Person (Campus)" },
                                                { value: "virtual", label: "Virtual (Online / Zoom / Meet)" },
                                                { value: "hybrid", label: "Hybrid (Campus + Stream)" },
                                            ]}
                                            size="sm"
                                            className="w-full"
                                            triggerClassName="h-9 font-bold bg-[#FAF6EE] text-xs border-2 border-black"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Venue or Location Details
                                        </label>
                                        <input
                                            type="text"
                                            value={form.venueOrLocation}
                                            onChange={(e) =>
                                                setForm({ ...form, venueOrLocation: e.target.value })
                                            }
                                            onBlur={() => handleBlur("venueOrLocation")}
                                            placeholder={
                                                form.locationType === "virtual"
                                                    ? "e.g. Google Meet link / Zoom room"
                                                    : "e.g. Main Auditorium, Block C"
                                            }
                                            className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Registration Format & Team Dynamics */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-neutral-800" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Registration Format
                                        </h4>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] ${
                                            form.isTeamEvent ? "bg-[#a2ff86] text-black" : "bg-[#FAF6EE] text-neutral-700"
                                        }`}
                                    >
                                        {form.isTeamEvent ? "Team Event" : "Solo / Individual"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, isTeamEvent: false }))}
                                        className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-1 ${
                                            !form.isTeamEvent
                                                ? "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000] ring-2 ring-black"
                                                : "bg-white border-black/30 hover:border-black text-neutral-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <User className="w-4 h-4 text-black" />
                                            <span className="text-xs font-black text-black">Sole Registration</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-500 font-medium">
                                            Individual attendee registration (1 person per application)
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, isTeamEvent: true }))}
                                        className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-1 ${
                                            form.isTeamEvent
                                                ? "bg-[#a2ff86]/30 border-black shadow-[2px_2px_0px_#000] ring-2 ring-black"
                                                : "bg-white border-black/30 hover:border-black text-neutral-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-black" />
                                            <span className="text-xs font-black text-black">Team Registration</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-500 font-medium">
                                            Participants either create or join teams via code / invite
                                        </span>
                                    </button>
                                </div>

                                {form.isTeamEvent && (
                                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-black uppercase tracking-wider">
                                                Team Member Capacity
                                            </span>
                                            <span className="text-[11px] font-bold text-neutral-600">
                                                {form.minTeamSize} to {form.maxTeamSize} Members per Team
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-black uppercase text-black mb-1">
                                                    Min Team Size
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                minTeamSize: Math.max(1, prev.minTeamSize - 1),
                                                            }))
                                                        }
                                                        className="w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={form.maxTeamSize}
                                                        value={form.minTeamSize}
                                                        onChange={(e) => {
                                                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                minTeamSize: val,
                                                                maxTeamSize: Math.max(val, prev.maxTeamSize),
                                                            }));
                                                        }}
                                                        className="w-full h-8 px-2 text-center rounded-lg bg-white border-2 border-black text-xs font-black text-black"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                minTeamSize: Math.min(prev.maxTeamSize, prev.minTeamSize + 1),
                                                            }))
                                                        }
                                                        className="w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-black uppercase text-black mb-1">
                                                    Max Team Size
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                maxTeamSize: Math.max(prev.minTeamSize, prev.maxTeamSize - 1),
                                                            }))
                                                        }
                                                        className="w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={form.minTeamSize}
                                                        max={50}
                                                        value={form.maxTeamSize}
                                                        onChange={(e) => {
                                                            const val = Math.max(form.minTeamSize, parseInt(e.target.value, 10) || form.minTeamSize);
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                maxTeamSize: val,
                                                            }));
                                                        }}
                                                        className="w-full h-8 px-2 text-center rounded-lg bg-white border-2 border-black text-xs font-black text-black"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                maxTeamSize: Math.min(50, prev.maxTeamSize + 1),
                                                            }))
                                                        }
                                                        className="w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {errors.teamSize && (
                                            <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                <span>{errors.teamSize}</span>
                                            </p>
                                        )}

                                        <p className="text-[10px] text-neutral-600 font-medium flex items-center gap-1.5">
                                            <Info className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                            <span>Leaders can search members by <span className="font-mono font-bold">@username</span> or share their team code. Joining & roster locking freeze automatically when the event starts.</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Sub-column: URL, Summary, Description, Stage */}
                        <div className="space-y-5">
                            {/* 4. Registration / RSVP URL */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Registration / RSVP URL (Optional)
                                </label>
                                <input
                                    type="url"
                                    value={form.registrationUrl}
                                    onChange={(e) =>
                                        setForm({ ...form, registrationUrl: e.target.value })
                                    }
                                    onBlur={() => handleBlur("registrationUrl")}
                                    placeholder="https://forms.gle/... or https://unstop.com/..."
                                    className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${
                                        touched.registrationUrl && errors.registrationUrl
                                            ? "border-rose-500 bg-rose-50/50"
                                            : "border-black focus:ring-2 focus:ring-[#a2ff86]"
                                    }`}
                                />
                                {touched.registrationUrl && errors.registrationUrl ? (
                                    <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{errors.registrationUrl}</span>
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-neutral-500 font-medium mt-1">
                                        Provide an external link if ticketing or registration is hosted externally.
                                    </p>
                                )}
                            </div>

                            {/* 5. Brief Summary */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                                        Brief Summary (1-2 Sentences)
                                    </label>
                                    <span className="text-[10px] font-mono font-bold text-neutral-500">
                                        {form.summary.length}/200
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    maxLength={200}
                                    value={form.summary}
                                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                                    placeholder="A hands-on session exploring smart contracts, decentralized apps, and tooling..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden focus:ring-2 focus:ring-[#a2ff86]"
                                />
                            </div>

                            {/* 6. Full Description & Agenda */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                                        Full Description & Agenda
                                    </label>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF6EE] border border-black/40 text-neutral-700">
                                        Markdown Supported
                                    </span>
                                </div>
                                <ClubMarkdownEditor
                                    value={form.description}
                                    onChange={(val) => setForm({ ...form, description: val })}
                                    placeholder="Prerequisites, schedule, speaker profiles, certifications, guidelines, and competition prizes..."
                                    minHeight="min-h-[140px]"
                                />
                            </div>

                            {/* 7. Publish Status Selector */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Publication Stage
                                </label>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "published" })}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                            form.status === "published"
                                                ? "bg-emerald-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                                : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">Published</span>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "draft" })}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                            form.status === "draft"
                                                ? "bg-amber-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                                : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">Draft</span>
                                            <Info className="w-3.5 h-3.5 text-amber-800" />
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "completed" })}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                            form.status === "completed"
                                                ? "bg-sky-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                                : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">Completed</span>
                                            <CheckCheck className="w-3.5 h-3.5 text-sky-900" />
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, status: "cancelled" })}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                            form.status === "cancelled"
                                                ? "bg-rose-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                                : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">Cancelled</span>
                                            <X className="w-3.5 h-3.5 text-rose-800" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 1 Footer */}
                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <OrbixButton
                            type="button"
                            onClick={handleGoToStep2}
                            variant="primary"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            className="px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] whitespace-nowrap shrink-0"
                        >
                            Next: Select Banner
                        </OrbixButton>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 2: BANNER SELECTION STUDIO */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 2 && (
                <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Step 2 of 3
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black">Event Banner Studio & Live Preview</h3>
                            <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                Select from 5 high-vibe developer SVG banners, or upload a custom flyer for this event.
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 bg-white px-3 py-1.5 rounded-xl border border-black shadow-[1px_1px_0px_#000]">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Auto-Selected If Omitted</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 7 Columns: Custom Dropzone (Top) & Preset Banners (Below) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* 1. Custom Flyer Dropzone Space (At the upper side) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Upload Custom Event Flyer
                                    </h4>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        Drag & drop or browse device
                                    </span>
                                </div>
                                <NeoImageDropzone
                                    headline="Drag and drop your event banner here"
                                    subtext="or click anywhere in this block to browse your device"
                                    value={form.coverImageUrl.startsWith("data:image/svg+xml") ? "" : form.coverImageUrl}
                                    onChange={handleBannerFileSelect}
                                    onRemove={() => {
                                        setForm((prev) => ({ ...prev, coverImageUrl: getRandomPresetBanner().dataUrl }));
                                    }}
                                    isUploading={isUploadingBanner}
                                    uploadProgress={uploadProgress}
                                    aspectRatio="banner"
                                    maxSizeMB={5}
                                    recommendedNote="Recommended 16:9 ratio (e.g. 1200x675px). PNG, JPG, or WEBP up to 5MB."
                                />
                            </div>

                            {/* 2. Curated Developer Banners (At the bottom side of custom upload) */}
                            <div className="pt-4 border-t-2 border-black/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Or Choose from 5 Curated Developer Banners
                                        </h4>
                                        <p className="text-[11px] text-neutral-600 font-medium">
                                            Instant high-vibe SVGs styled for developer clubs & hackathons
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const randomBanner = getRandomPresetBanner();
                                            setForm((prev) => ({ ...prev, coverImageUrl: randomBanner.dataUrl }));
                                            toast.info(`Swapped to "${randomBanner.title}" banner!`);
                                        }}
                                        className="inline-flex items-center gap-1 text-[11px] font-black text-sky-700 hover:text-sky-900 underline cursor-pointer shrink-0"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Surprise Me</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {PRESET_EVENT_BANNERS.map((banner) => {
                                        const isSelected = form.coverImageUrl === banner.dataUrl;
                                        return (
                                            <div
                                                key={banner.id}
                                                onClick={() => {
                                                    setForm((prev) => ({ ...prev, coverImageUrl: banner.dataUrl }));
                                                    toast.success(`Selected banner: "${banner.title}"`);
                                                }}
                                                className={`group relative rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${
                                                    isSelected
                                                        ? "border-black shadow-[4px_4px_0px_#000] ring-4 ring-[#A2FF86] bg-neutral-900"
                                                        : "border-black/50 hover:border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] bg-white hover:translate-y-[-1px]"
                                                }`}
                                            >
                                                {/* Aspect 16:9 Banner Thumbnail */}
                                                <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-950 relative">
                                                    {banner.svgString ? (
                                                        <div
                                                            dangerouslySetInnerHTML={{ __html: banner.svgString }}
                                                            className="w-full h-full pointer-events-none transition-transform group-hover:scale-105 duration-300 [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={banner.dataUrl}
                                                            alt={banner.title}
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                                        />
                                                    )}
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#A2FF86] text-black border-2 border-black font-black text-[10px] shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                            <span>Active</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-2.5 bg-white border-t-2 border-black flex items-center justify-between">
                                                    <div className="truncate">
                                                        <h5 className="text-xs font-black text-black truncate">{banner.title}</h5>
                                                        <span className="text-[10px] font-bold text-neutral-500 truncate block">
                                                            {banner.category}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border border-black/40 bg-[#FAF6EE] text-black shrink-0">
                                                        {banner.badgeText.split(" ")[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 5 Columns: Live Catalog Card Preview */}
                        <div className="lg:col-span-5 space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span>Real-Time Catalog Preview</span>
                            </h4>

                            <div className="sticky top-4">
                                <EventLiveListingCard
                                    title={form.title || "Untitled Campus Event"}
                                    summary={form.summary}
                                    description={form.description}
                                    startsAt={form.startsAt}
                                    endsAt={form.endsAt}
                                    timezone={form.timezone}
                                    venueOrLocation={form.venueOrLocation}
                                    locationType={form.locationType}
                                    registrationUrl={form.registrationUrl}
                                    coverImageUrl={form.coverImageUrl}
                                    status={form.status}
                                    clubName={clubName || "Your Club Chapter"}
                                    clubLogoUrl={clubLogoUrl}
                                    collegeName={collegeName || "Your College Campus"}
                                    eventId={editingEvent?.id}
                                    slug={editingEvent?.slug}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 2 Footer */}
                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back: Event Info</span>
                        </button>
                        <OrbixButton
                            type="button"
                            onClick={handleGoToStep3}
                            variant="lime"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            className="px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] whitespace-nowrap shrink-0"
                        >
                            Next: Build Registration Form
                        </OrbixButton>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 3: REGISTRATION FORM BUILDER WORKSPACE */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 3 && (
                <div className="w-full">
                    <EventFormBuilderWorkspace
                        eventId={editingEvent?.id || "create-draft"}
                        club={{ id: clubId, name: clubName, logoUrl: clubLogoUrl }}
                        isWizardMode={true}
                        initialFormRecord={{
                            id: "wizard-draft-form",
                            eventId: editingEvent?.id || "create-draft",
                            title: `${form.title.trim() || "Event"} Registration`,
                            description: form.summary.trim() || "Complete registration to secure your verified student pass.",
                            structure: formStructure,
                            settings: formSettings,
                            themeSettings: formTheme,
                            isPublished: false,
                            version: 1,
                        } as any}
                        initialEventData={{
                            ...form,
                            title: form.title.trim() || "Event",
                        }}
                        onWizardChange={(updatedForm) => {
                            if (updatedForm.structure) setFormStructure(updatedForm.structure);
                            if (updatedForm.settings) setFormSettings(updatedForm.settings);
                            if (updatedForm.themeSettings) setFormTheme(updatedForm.themeSettings);
                        }}
                        onWizardSubmit={() => handleSubmitFinal()}
                    />
                </div>
            )}
        </div>
    );
};

export default ClubEventModal;