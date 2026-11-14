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
import { EventTimelineBuilder } from "./TimelineBuilder/EventTimelineBuilder";
import { EventWizardReviewStep } from "./TimelineBuilder/EventWizardReviewStep";
import type { ConfiguredStage } from "./TimelineBuilder/types";
import {
    evaluateStepNavigation,
    validateStep1,
    type FormErrors,
} from "./eventWizardNavigationGuard";
import { fetchEventStages } from "../../api/eventLifecycleApi";
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

    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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

    const buildDefaultStages = (startsAtStr?: string, endsAtStr?: string): ConfiguredStage[] => {
        const sDate = startsAtStr ? new Date(startsAtStr) : new Date();
        const eDate = endsAtStr ? new Date(endsAtStr) : new Date(Date.now() + 7 * 86400000);

        return [
            {
                id: `stage_reg_${Date.now()}`,
                name: "Registration & RSVP",
                type: "registration",
                description: "Initial participant signup, profile matching, and admission screening.",
                instructions: "Complete all required questionnaire fields to secure your admission pass.",
                stageOrder: 1,
                startsAt: sDate.toISOString().slice(0, 16),
                endsAt: new Date(sDate.getTime() + 4 * 86400000).toISOString().slice(0, 16),
                timezone: "Asia/Kolkata",
                status: "active",
                eligibilityType: "all_registered",
                actionType: "registration",
                requirements: {
                    allowResubmission: false,
                    maxSubmissions: 1,
                    teamSubmissionOnly: false,
                    leaderOnlySubmit: false,
                    allMembersCanView: true,
                    lateSubmissionPolicy: "disallow",
                    requireApprovalToAdvance: false,
                },
            },
            {
                id: `stage_sub_${Date.now()}`,
                name: "Hackathon Sprint & Submissions",
                type: "development",
                description: "Build, commit, and submit project source repository, live demo, and presentation pitch.",
                instructions: "Submit your GitHub repository, live URL, and architecture deck before the deadline.",
                stageOrder: 2,
                startsAt: new Date(sDate.getTime() + 4 * 86400000).toISOString().slice(0, 16),
                endsAt: new Date(sDate.getTime() + 6 * 86400000).toISOString().slice(0, 16),
                timezone: "Asia/Kolkata",
                status: "scheduled",
                eligibilityType: "accepted_only",
                actionType: "submit_project",
                requirements: {
                    allowResubmission: true,
                    maxSubmissions: 3,
                    teamSubmissionOnly: false,
                    leaderOnlySubmit: true,
                    allMembersCanView: true,
                    lateSubmissionPolicy: "disallow",
                    requireApprovalToAdvance: true,
                },
                formConfig: {
                    title: "Sprint Project Submission",
                    description: "Upload your code repositories and demo assets.",
                    fields: [
                        {
                            id: "f_github",
                            label: "GitHub Repository URL",
                            type: "github",
                            description: "Link to your public repository containing source code and README.",
                            required: true,
                            placeholder: "https://github.com/...",
                        },
                        {
                            id: "f_live_url",
                            label: "Live Demo URL",
                            type: "url",
                            description: "Deployed application preview link.",
                            required: false,
                            placeholder: "https://your-project.vercel.app",
                        },
                        {
                            id: "f_deck",
                            label: "Pitch Deck / Architecture PDF",
                            type: "file",
                            description: "Presentation slides or architectural specification (Max 25MB).",
                            required: false,
                            allowedExtensions: [".pdf", ".ppt", ".pptx"],
                            maxSizeBytes: 25 * 1024 * 1024,
                        },
                    ],
                    allowedFileTypes: [".pdf", ".ppt", ".pptx", ".zip"],
                    maxFileSizeBytes: 25 * 1024 * 1024,
                    maxFiles: 3,
                },
            },
            {
                id: `stage_res_${Date.now()}`,
                name: "Evaluation & Winner Announcement",
                type: "results",
                description: "Final evaluation, jury score compilation, and credential issuance.",
                instructions: "Scores will be revealed live. Verified certificates are dispatched to the student portfolio.",
                stageOrder: 3,
                startsAt: new Date(sDate.getTime() + 6 * 86400000).toISOString().slice(0, 16),
                endsAt: eDate.toISOString().slice(0, 16),
                timezone: "Asia/Kolkata",
                status: "scheduled",
                eligibilityType: "all_registered",
                actionType: "view_results",
                requirements: {
                    allowResubmission: false,
                    maxSubmissions: 0,
                    teamSubmissionOnly: false,
                    leaderOnlySubmit: false,
                    allMembersCanView: true,
                    lateSubmissionPolicy: "disallow",
                    requireApprovalToAdvance: false,
                },
            },
        ];
    };

    const [stages, setStages] = useState<ConfiguredStage[]>(() => buildDefaultStages());

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

                if (editingEvent.id) {
                    fetchEventStages(editingEvent.id)
                        .then((res: { success: boolean; stages: any[] }) => {
                            if (res.stages && res.stages.length > 0) {
                                setStages(
                                    res.stages.map((st: any, idx: number) => ({
                                        id: st.id || `stage_${idx}`,
                                        name: st.name || `Round ${idx + 1}`,
                                        type: st.type || "custom",
                                        description: st.description || "",
                                        instructions: st.instructions || "",
                                        stageOrder: typeof st.stage_order === "number" ? st.stage_order : idx + 1,
                                        startsAt: formatForInput(st.starts_at || st.startsAt),
                                        endsAt: formatForInput(st.ends_at || st.endsAt),
                                        timezone: st.timezone || "Asia/Kolkata",
                                        status: st.status || "scheduled",
                                        eligibilityType: st.eligibility_type || "all_registered",
                                        actionType: st.action_type || "none",
                                        requirements: st.requirements || {
                                            allowResubmission: true,
                                            maxSubmissions: 1,
                                            teamSubmissionOnly: false,
                                            leaderOnlySubmit: false,
                                            allMembersCanView: true,
                                            lateSubmissionPolicy: "disallow",
                                            requireApprovalToAdvance: false,
                                        },
                                        bannerUrl: st.banner_url || undefined,
                                        formConfig: st.formConfig || undefined,
                                    }))
                                );
                            } else {
                                setStages(buildDefaultStages(editingEvent.startsAt || undefined, editingEvent.endsAt || undefined));
                            }
                        })
                        .catch((err: any) => {
                            console.error("Failed to load stages for editing event:", err);
                            setStages(buildDefaultStages(editingEvent.startsAt || undefined, editingEvent.endsAt || undefined));
                        });
                } else {
                    setStages(buildDefaultStages(editingEvent.startsAt || undefined, editingEvent.endsAt || undefined));
                }
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
                setStages(buildDefaultStages());
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

    // Form builder helper methods
    const totalQuestions = formStructure.sections.reduce((acc, s) => acc + s.questions.length, 0);

    // Step 1 Validation logic
    const validate = (currentForm: FormState): FormErrors => validateStep1(currentForm).errors || {};

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

    // Centralized Step Navigation Guard (Sequential Forward & Unrestricted Backward)
    const handleNavigateToStep = (targetStep: 1 | 2 | 3 | 4 | 5): boolean => {
        const result = evaluateStepNavigation(currentStep, targetStep, {
            form,
            stages,
            totalQuestions,
            isUploadingBanner,
        });

        if (!result.allowed) {
            if (result.blockingStep === 1) {
                setTouched({
                    title: true,
                    startsAt: true,
                    endsAt: true,
                    registrationUrl: true,
                    venueOrLocation: true,
                    teamSize: true,
                });
                if (result.step1Errors) {
                    setErrors(result.step1Errors);
                }
            }
            toast.error(result.errorMessage || "Please complete all required fields before proceeding.", {
                title: result.blockingStep === 1
                    ? "Validation Error"
                    : result.blockingStep === 2
                    ? "Timeline Stage Required"
                    : result.blockingStep === 3
                    ? "Registration Form Required"
                    : "Banner Required",
            });
            return false;
        }

        // When entering Step 4 or Step 5, ensure a banner exists if missing
        if ((targetStep === 4 || targetStep === 5) && !form.coverImageUrl) {
            setForm((prev) => ({ ...prev, coverImageUrl: getRandomPresetBanner().dataUrl }));
        }

        setCurrentStep(targetStep);
        return true;
    };

    // Step navigation actions
    const handleGoToStep2 = () => handleNavigateToStep(2);
    const handleGoToStep3 = () => handleNavigateToStep(3);
    const handleGoToStep4 = () => handleNavigateToStep(4);
    const handleGoToStep5 = () => handleNavigateToStep(5);

    // Final Submission Handler (Atomic Launch or Edit Save)
    const handleSubmitFinal = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Validate all preceding steps before final launch
        const navCheck = evaluateStepNavigation(currentStep, 5, {
            form,
            stages,
            totalQuestions,
            isUploadingBanner,
        });

        if (!navCheck.allowed) {
            if (navCheck.blockingStep === 1) {
                setCurrentStep(1);
                setTouched({
                    title: true,
                    startsAt: true,
                    endsAt: true,
                    registrationUrl: true,
                    venueOrLocation: true,
                    teamSize: true,
                });
                if (navCheck.step1Errors) {
                    setErrors(navCheck.step1Errors);
                }
            } else if (navCheck.blockingStep === 2) {
                setCurrentStep(2);
            } else if (navCheck.blockingStep === 3) {
                setCurrentStep(3);
            } else if (navCheck.blockingStep === 4) {
                setCurrentStep(4);
            }
            toast.error(navCheck.errorMessage || "Please fix validation errors before proceeding.", {
                title: navCheck.blockingStep === 1
                    ? "Validation Error"
                    : navCheck.blockingStep === 2
                    ? "Timeline Required"
                    : navCheck.blockingStep === 3
                    ? "Registration Form Required"
                    : "Banner Required",
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
            initialStages: stages,
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
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-black tracking-tight truncate">
                                {editingEvent ? "Edit Club Event" : "Create New Club Event"}
                            </h2>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${form.status === "published"
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
                            Step {currentStep} of 5: {
                                currentStep === 1
                                    ? "Event Information & Schedule"
                                    : currentStep === 2
                                        ? "Timeline & Round Architecture"
                                        : currentStep === 3
                                            ? "Registration Form Builder"
                                            : currentStep === 4
                                                ? "Banner Selection & Preview"
                                                : "Review & Publish"
                            }
                        </p>
                    </div>
                </div>

                {/* Center / Right: 5-Step Wizard Navigation Stepper */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Stepper Pills */}
                    <div className="flex items-center bg-[#FAF6EE] p-1 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] gap-1 overflow-x-auto max-w-full">
                        <button
                            type="button"
                            onClick={() => handleNavigateToStep(1)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${currentStep === 1
                                ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-white/60"
                                }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">1</span>
                            <span>Event Info</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleNavigateToStep(2)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${currentStep === 2
                                ? "bg-[#C084FC] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-white/60"
                                }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">2</span>
                            <span>Timeline ({stages.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleNavigateToStep(3)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${currentStep === 3
                                ? "bg-[#A2FF86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-white/60"
                                }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">3</span>
                            <span>Form ({totalQuestions})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleNavigateToStep(4)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${currentStep === 4
                                ? "bg-[#38BDF8] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-white/60"
                                }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">4</span>
                            <span>Banner</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleNavigateToStep(5)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${currentStep === 5
                                ? "bg-[#FDE047] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-white/60"
                                }`}
                        >
                            <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">5</span>
                            <span>Review</span>
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
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-neutral-500">
                                Step 1 of 5
                            </span>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black">Event Information & Schedule</h3>
                        </div>
                        <span className="text-[13px] font-bold text-neutral-500">
                            * Required Fields
                        </span>
                    </div>

                    {/* Scope Indicator Banner */}
                    <div
                        className={`p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${form.scope === "PAN_INDIA"
                            ? "bg-amber-50/70"
                            : "bg-sky-50/80"
                            }`}
                    >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div
                                className={`w-11 h-11 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 ${form.scope === "PAN_INDIA" ? "bg-[#FF9933] text-black" : "bg-[#38BDF8] text-black"
                                    }`}
                            >
                                {form.scope === "PAN_INDIA" ? (
                                    <Globe2 className="w-5 h-5 stroke-[2.5]" />
                                ) : (
                                    <GraduationCap className="w-5 h-5 stroke-[2.5]" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] whitespace-nowrap shrink-0 ${form.scope === "PAN_INDIA"
                                            ? "bg-[#FF9933] text-black"
                                            : "bg-[#38BDF8] text-black"
                                            }`}
                                    >
                                        {form.scope === "PAN_INDIA" ? "Pan India Reach" : "Campus Exclusive"}
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-black">
                                        {form.scope === "PAN_INDIA"
                                            ? "National Discovery & Cross-College Participation"
                                            : `Exclusive to ${collegeName || "Host Campus"}`}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium mt-1">
                                    {form.scope === "PAN_INDIA"
                                        ? "Students from colleges throughout India can discover and register for this event."
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
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer transition-all shrink-0 self-start sm:self-center whitespace-nowrap"
                            >
                                Switch to {form.scope === "PAN_INDIA" ? "Campus Exclusive" : "Pan India"}
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
                                        className={`text-[10px] font-mono font-bold ${form.title.length > 120
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
                                    className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${touched.title && errors.title
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
                                    <h4 className="text-sm font-black uppercase tracking-wider text-black">
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
                                    <h4 className="text-sm font-black uppercase tracking-wider text-black">
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
                                        <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                            Registration Format
                                        </h4>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] ${form.isTeamEvent ? "bg-[#a2ff86] text-black" : "bg-[#FAF6EE] text-neutral-700"
                                            }`}
                                    >
                                        {form.isTeamEvent ? "Team Event" : "Solo / Individual"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, isTeamEvent: false }))}
                                        className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-1 ${!form.isTeamEvent
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
                                        className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-1 ${form.isTeamEvent
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
                                    className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${touched.registrationUrl && errors.registrationUrl
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
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${form.status === "published"
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
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${form.status === "draft"
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
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${form.status === "completed"
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
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all ${form.status === "cancelled"
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
                            Next: Configure Timeline
                        </OrbixButton>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 2: TIMELINE & ROUND ARCHITECTURE */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 2 && (
                <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-neutral-500">
                                Step 2 of 5
                            </span>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black">Event Timeline & Stage Architecture</h3>
                            <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                Structure rounds, deadlines, participant eligibility, and submission requirements.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase bg-[#FFE566] text-black px-3 py-1 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                {stages.length} {stages.length === 1 ? "Round" : "Rounds"}
                            </span>
                        </div>
                    </div>

                    <EventTimelineBuilder
                        stages={stages}
                        onChange={setStages}
                        eventStartsAt={form.startsAt}
                        eventEndsAt={form.endsAt}
                        isTeamEvent={form.isTeamEvent}
                    />

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
                <div className="w-full space-y-6">
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
                        onWizardBack={() => setCurrentStep(2)}
                        onWizardSubmit={() => handleGoToStep4()}
                    />

                    {/* Step 3 Footer */}
                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between pb-28">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back: Timeline</span>
                        </button>
                        <OrbixButton
                            type="button"
                            onClick={handleGoToStep4}
                            variant="lime"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            className="px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] whitespace-nowrap shrink-0"
                        >
                            Next: Select Banner
                        </OrbixButton>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 4: BANNER SELECTION STUDIO */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 4 && (
                <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-neutral-500">
                                Step 4 of 5
                            </span>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black">Event Banner Studio & Live Preview</h3>
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
                                    <h4 className="text-sm font-black uppercase tracking-wider text-black">
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
                                        <h4 className="text-sm font-black uppercase tracking-wider text-black">
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
                                                className={`group relative rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${isSelected
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
                                                        <h5 className="text-sm font-black text-black truncate">{banner.title}</h5>
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
                            <h4 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-1.5">
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
                                    showShareButton={false}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 4 Footer */}
                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(3)}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back: Registration Form</span>
                        </button>
                        <OrbixButton
                            type="button"
                            onClick={handleGoToStep5}
                            variant="lime"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            className="px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] whitespace-nowrap shrink-0"
                        >
                            Next: Review & Publish
                        </OrbixButton>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 5: REVIEW & PUBLISH PRE-FLIGHT CHECKLIST */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 5 && (
                <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-neutral-500">
                                Step 5 of 5
                            </span>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black">Pre-Flight Review & Launch Checklist</h3>
                            <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                Verify all event configurations, schedule milestones, and communication channels before publishing.
                            </p>
                        </div>
                    </div>

                    <EventWizardReviewStep
                        form={form}
                        stages={stages}
                        formQuestions={formStructure.sections.flatMap((s) => s.questions)}
                        collegeName={collegeName}
                        onJumpToStep={(st) => handleNavigateToStep(st as any)}
                    />

                    {/* Step 5 Footer */}
                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back: Banner Studio</span>
                        </button>
                        <OrbixButton
                            type="button"
                            onClick={handleSubmitFinal}
                            variant="lime"
                            iconRight={<Sparkles className="w-4 h-4" />}
                            className="px-8 py-3 text-sm font-black shadow-[4px_4px_0px_#000] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                            {editingEvent ? "Save & Update Event" : "Launch & Publish Event"}
                        </OrbixButton>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClubEventModal;