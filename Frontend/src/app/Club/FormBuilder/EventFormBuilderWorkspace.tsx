import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Plus,
    Split,
    Palette,
    Settings,
    Eye,
    BarChart3,
    Save,
    Share2,
    Check,
    ArrowLeft,
    FileText,
    ShieldCheck,
    Code2,
    Trophy,
    Users,
    Layers,
    UploadCloud,
    Sparkles,
    Send,
    Undo2,
    Redo2,
    AlertTriangle,
    Image as ImageIcon,
    Video,
    Heading,
    ClipboardList,
    Trash2,
    CheckCircle2,
    X,
} from "lucide-react";
import {
    type ClubEventFormRecord,
    type FormQuestion,
    type FormSection,
    type FormStructure,
    type FormSettings as FormSettingsType,
    fetchClubEventForm,
    saveClubEventForm,
    publishClubEventForm,
} from "../../../api/clubEventFormApi";
import { QuestionCard } from "./QuestionCard";
import { SectionCard } from "./SectionCard";
import { FormThemeDrawer } from "./FormThemeDrawer";
import { FormSettingsTab } from "./FormSettingsTab";
import { FormResponsesAnalyticsView } from "./FormResponsesAnalyticsView";
import { StudentFormRenderer } from "./StudentFormRenderer";
import { NeoToggle } from "../../../components/NeoToggle";
import { OrbixLoader } from "../../../components/ui/loader";
import { useToast } from "../../../context/ToastContext";

const QUICK_TEMPLATES = [
    {
        key: "tech_stack",
        label: "Tech Stack",
        icon: Code2,
        color: "bg-[#38BDF8]/20 text-sky-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_tech`,
            type: "checkboxes",
            title: "What is your preferred technology stack?",
            description: "Select all technologies and frameworks you are comfortable building with.",
            required: true,
            options: [
                { id: "opt_1", text: "React / Next.js / TypeScript" },
                { id: "opt_2", text: "Node.js / Express / NestJS" },
                { id: "opt_3", text: "Python / Django / FastAPI" },
                { id: "opt_4", text: "AI / Machine Learning / PyTorch" },
                { id: "opt_5", text: "Go / Rust / Systems" },
                { id: "opt_6", text: "Mobile (Flutter / React Native)" },
                { id: "opt_other", text: "Other...", isOther: true },
            ],
            validation: {
                minSelected: 1,
            },
        }),
    },
    {
        key: "hackathon_exp",
        label: "Hackathon Experience",
        icon: Trophy,
        color: "bg-[#FFE566]/30 text-amber-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_exp`,
            type: "multiple_choice",
            title: "Have you participated in a hackathon before?",
            required: true,
            options: [
                { id: "opt_1", text: "Yes, 1-2 times" },
                { id: "opt_2", text: "Yes, 3+ times (Experienced hacker)" },
                { id: "opt_3", text: "No, this is my first hackathon!" },
            ],
        }),
    },
    {
        key: "solo_team",
        label: "Solo vs Team",
        icon: Users,
        color: "bg-[#a2ff86]/30 text-emerald-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_mode`,
            type: "multiple_choice",
            title: "Are you registering individually or as a team?",
            description: "If registering as a team lead, you can invite your team members after registration.",
            required: true,
            options: [
                { id: "opt_1", text: "Individual (Looking for teammates at the event)" },
                { id: "opt_2", text: "Individual (Solo project)" },
                { id: "opt_3", text: "Team Lead (Registering an existing team)" },
                { id: "opt_4", text: "Team Member (Joining an existing team)" },
            ],
        }),
    },
    {
        key: "team_role",
        label: "Preferred Role",
        icon: Layers,
        color: "bg-[#C084FC]/25 text-purple-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_role`,
            type: "dropdown",
            title: "Select your preferred team role",
            required: true,
            options: [
                { id: "opt_1", text: "Frontend Developer" },
                { id: "opt_2", text: "Backend Developer" },
                { id: "opt_3", text: "Full Stack Engineer" },
                { id: "opt_4", text: "UI / UX Designer" },
                { id: "opt_5", text: "AI / ML Engineer" },
                { id: "opt_6", text: "Product Pitch & Presentation Lead" },
            ],
        }),
    },
    {
        key: "project_idea",
        label: "Project Idea Pitch",
        icon: FileText,
        color: "bg-[#FB7185]/20 text-rose-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_idea`,
            type: "paragraph",
            title: "Describe your project idea",
            description: "Briefly explain the problem you are solving, your solution, and key features.",
            required: false,
            validation: {
                minLength: 30,
                maxLength: 1000,
            },
        }),
    },
    {
        key: "github_profile",
        label: "GitHub Profile",
        icon: Sparkles,
        color: "bg-neutral-200 text-neutral-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_gh`,
            type: "short_answer",
            title: "Enter your GitHub profile",
            description: "Orbix pre-fills this from your verified student profile if linked.",
            required: true,
            validation: {
                pattern: "^(https?:\\/\\/)?(www\\.)?github\\.com\\/[A-Za-z0-9_-]+\\/?$|^[A-Za-z0-9_-]+$",
                patternError: "Please enter a valid GitHub username or URL.",
            },
        }),
    },
    {
        key: "resume_upload",
        label: "Resume Upload",
        icon: UploadCloud,
        color: "bg-cyan-100 text-cyan-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_resume`,
            type: "file_upload",
            title: "Upload your resume (Optional)",
            description: "Students with verified Orbix resumes can attach their file in 1 click.",
            required: false,
            validation: {
                allowedFileTypes: ["pdf"],
                maxFileSizeMb: 10,
                maxFiles: 1,
            },
        }),
    },
    {
        key: "project_proposal",
        label: "Project Proposal Deck",
        icon: UploadCloud,
        color: "bg-indigo-100 text-indigo-900",
        build: (): FormQuestion => ({
            id: `q_${Date.now()}_proposal`,
            type: "file_upload",
            title: "Upload your project proposal / pitch deck",
            description: "Accepts PDF or presentation slide decks up to 25 MB stored in Cloudinary.",
            required: false,
            validation: {
                allowedFileTypes: ["pdf"],
                maxFileSizeMb: 25,
                maxFiles: 1,
            },
        }),
    },
];

export interface EventFormBuilderWorkspaceProps {
    eventId: string;
    club?: any;
    onBack?: () => void;
}

type MainTab = "questions" | "responses" | "settings";
type SaveBadgeStatus = "saved" | "saving" | "unsaved" | "error";

export const EventFormBuilderWorkspace: React.FC<EventFormBuilderWorkspaceProps> = ({
    eventId,
    club,
    onBack,
}) => {
    const toast = useToast();

    // 1. Core States
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [activeTab, setActiveTab] = useState<MainTab>("questions");
    const [form, setForm] = useState<ClubEventFormRecord | null>(null);
    const [event, setEvent] = useState<any>(null);
    const [registeredCount, setRegisteredCount] = useState(0);

    // 2. Save Status Indicator State
    const [saveStatus, setSaveStatus] = useState<SaveBadgeStatus>("saved");
    const isInitialLoad = useRef(true);
    const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

    // 3. Selection & Undo/Redo States
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [history, setHistory] = useState<FormStructure[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    // 4. Modals & Drawers
    const [isThemeDrawerOpen, setIsThemeDrawerOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [copiedShareLink, setCopiedShareLink] = useState(false);

    // Load initial form definition
    const loadForm = async () => {
        setLoading(true);
        try {
            const res = await fetchClubEventForm(eventId);
            setForm(res.form);
            setEvent(res.event);
            setRegisteredCount(res.registeredCount);

            if (res.form.structure) {
                setHistory([JSON.parse(JSON.stringify(res.form.structure))]);
                setHistoryIndex(0);
            }

            if (res.form.structure?.sections?.[0]?.questions?.[0]) {
                setActiveQuestionId(res.form.structure.sections[0].questions[0].id);
            }
            setSaveStatus("saved");
        } catch (err: any) {
            toast.error(err.message || "Failed to load form builder.");
        } finally {
            setLoading(false);
            isInitialLoad.current = false;
        }
    };

    useEffect(() => {
        loadForm();
    }, [eventId]);

    // Push new snapshot to undo/redo stack
    const pushHistory = (newStructure: FormStructure) => {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push(JSON.parse(JSON.stringify(newStructure)));
        if (nextHistory.length > 30) nextHistory.shift();
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
    };

    // Undo action
    const handleUndo = () => {
        if (historyIndex > 0 && form) {
            const prevStructure = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            setForm({
                ...form,
                structure: JSON.parse(JSON.stringify(prevStructure)),
            });
            setSaveStatus("unsaved");
            toast.info("Undo performed");
        }
    };

    // Redo action
    const handleRedo = () => {
        if (historyIndex < history.length - 1 && form) {
            const nextStructure = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            setForm({
                ...form,
                structure: JSON.parse(JSON.stringify(nextStructure)),
            });
            setSaveStatus("unsaved");
            toast.info("Redo performed");
        }
    };

    // Global Undo/Redo keyboard listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                if (e.shiftKey) {
                    e.preventDefault();
                    handleRedo();
                } else {
                    e.preventDefault();
                    handleUndo();
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [history, historyIndex, form]);

    // Debounced automatic autosave
    useEffect(() => {
        if (isInitialLoad.current || !form) return;

        setSaveStatus("unsaved");

        if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
        }

        autosaveTimer.current = setTimeout(async () => {
            try {
                setSaveStatus("saving");
                await saveClubEventForm(eventId, {
                    title: form.title,
                    description: form.description,
                    headerImageUrl: form.headerImageUrl,
                    headerImagePublicId: form.headerImagePublicId,
                    themeSettings: form.themeSettings,
                    settings: form.settings,
                    structure: form.structure,
                    isPublished: false,
                });
                setSaveStatus("saved");
            } catch {
                setSaveStatus("error");
            }
        }, 1800);

        return () => {
            if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        };
    }, [form?.structure, form?.title, form?.description, form?.settings, form?.themeSettings]);

    // Explicit Save Draft Button Click
    const handleSaveForm = async () => {
        if (!form) return;
        setSaving(true);
        setSaveStatus("saving");
        try {
            const res = await saveClubEventForm(eventId, {
                title: form.title,
                description: form.description,
                headerImageUrl: form.headerImageUrl,
                headerImagePublicId: form.headerImagePublicId,
                themeSettings: form.themeSettings,
                settings: form.settings,
                structure: form.structure,
                isPublished: form.isPublished,
            });
            setForm(res.form);
            setSaveStatus("saved");
            toast.success("Draft saved successfully!", { title: "Draft Saved" });
        } catch (err: any) {
            setSaveStatus("error");
            toast.error(err.message || "Failed to save draft.");
        } finally {
            setSaving(false);
        }
    };

    // Publish form into an immutable version snapshot
    const handlePublishForm = async () => {
        if (!form) return;
        setIsPublishing(true);
        setSaveStatus("saving");
        try {
            await saveClubEventForm(eventId, {
                title: form.title,
                description: form.description,
                headerImageUrl: form.headerImageUrl,
                headerImagePublicId: form.headerImagePublicId,
                themeSettings: form.themeSettings,
                settings: form.settings,
                structure: form.structure,
                isPublished: false,
            });

            const res = await publishClubEventForm(eventId, "Published via Form Studio");
            setForm(res.form);
            setSaveStatus("saved");
            toast.success(`Form Version ${res.version.versionNumber} is now live for students!`, {
                title: "Snapshot Published Live",
            });
        } catch (err: any) {
            setSaveStatus("error");
            toast.error(err.message || "Failed to publish form.");
        } finally {
            setIsPublishing(false);
        }
    };

    // Copy direct registration link for students
    const handleCopyShareLink = () => {
        const link = `${window.location.origin}/events/${eventId}/register`;
        navigator.clipboard.writeText(link);
        setCopiedShareLink(true);
        toast.success("Registration link copied to clipboard!");
        setTimeout(() => setCopiedShareLink(false), 2500);
    };

    // -------------------------------------------------------------------------
    // FORM MANIPULATION HELPERS
    // -------------------------------------------------------------------------
    const updateSections = (updater: (sections: FormSection[]) => FormSection[]) => {
        if (!form) return;
        const currentSections = form.structure?.sections || [];
        const nextSections = updater([...currentSections]);
        const updatedStructure = {
            ...form.structure,
            sections: nextSections,
        };
        setForm({
            ...form,
            structure: updatedStructure,
        });
        pushHistory(updatedStructure);
    };

    // Add new standard Question
    const handleAddQuestion = (sectionIdx?: number) => {
        if (!form) return;
        const targetSecIdx =
            sectionIdx !== undefined ? sectionIdx : (form.structure?.sections?.length || 1) - 1;
        const isQuiz = Boolean(form.settings.quiz?.isQuiz);
        const defaultRequired = Boolean(form.settings.questionDefaults?.defaultRequired);
        const defaultPoints =
            form.settings.quiz?.defaultPointsPerQuestion ??
            form.settings.questionDefaults?.defaultPointValue ??
            1;

        const newQuestion: FormQuestion = {
            id: `q_${Date.now()}`,
            type: "short_answer",
            title: "Untitled Question",
            required: defaultRequired,
            ...(isQuiz ? { points: defaultPoints, isGraded: true } : {}),
        };

        updateSections((sections) => {
            if (sections[targetSecIdx]) {
                sections[targetSecIdx].questions.push(newQuestion);
            } else if (sections.length === 0) {
                sections.push({
                    id: `sec_${Date.now()}`,
                    title: "Untitled Section",
                    afterSectionAction: "submit_form",
                    questions: [newQuestion],
                });
            }
            return sections;
        });

        setActiveQuestionId(newQuestion.id);
    };

    // Add Standalone Title Block
    const handleAddTitleBlock = (sectionIdx?: number) => {
        const targetSecIdx =
            sectionIdx !== undefined ? sectionIdx : (form?.structure?.sections?.length || 1) - 1;
        const titleCard: FormQuestion = {
            id: `block_title_${Date.now()}`,
            type: "title_card",
            title: "Section Heading",
            description: "Provide helpful instructions or context for this part of the form.",
            required: false,
        };
        updateSections((sections) => {
            if (sections[targetSecIdx]) sections[targetSecIdx].questions.push(titleCard);
            return sections;
        });
        setActiveQuestionId(titleCard.id);
        toast.success("Added Title & Description block");
    };

    // Add Standalone Image Block
    const handleAddImageBlock = (sectionIdx?: number) => {
        const targetSecIdx =
            sectionIdx !== undefined ? sectionIdx : (form?.structure?.sections?.length || 1) - 1;
        const imgCard: FormQuestion = {
            id: `block_img_${Date.now()}`,
            type: "image_block",
            title: "Image Title",
            imageCaption: "Optional image caption",
            imageAlignment: "center",
            required: false,
        };
        updateSections((sections) => {
            if (sections[targetSecIdx]) sections[targetSecIdx].questions.push(imgCard);
            return sections;
        });
        setActiveQuestionId(imgCard.id);
        toast.success("Added Image block. Click to upload picture.");
    };

    // Add Standalone Video Block
    const handleAddVideoBlock = (sectionIdx?: number) => {
        const targetSecIdx =
            sectionIdx !== undefined ? sectionIdx : (form?.structure?.sections?.length || 1) - 1;
        const vidCard: FormQuestion = {
            id: `block_vid_${Date.now()}`,
            type: "video_block",
            title: "Video Guide",
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoTitle: "Watch this walkthrough before applying",
            required: false,
        };
        updateSections((sections) => {
            if (sections[targetSecIdx]) sections[targetSecIdx].questions.push(vidCard);
            return sections;
        });
        setActiveQuestionId(vidCard.id);
        toast.success("Added YouTube Video block. Paste video link in editor.");
    };

    // Add new Section (Multi-step page)
    const handleAddSection = () => {
        const newSection: FormSection = {
            id: `sec_${Date.now()}`,
            title: `Section ${(form?.structure?.sections?.length || 0) + 1}`,
            description: "",
            afterSectionAction: "submit_form",
            questions: [
                {
                    id: `q_${Date.now()}`,
                    type: "short_answer",
                    title: "Untitled Question",
                    required: false,
                },
            ],
        };

        updateSections((sections) => [...sections, newSection]);
        toast.success("Added new multi-step section page");
    };

    // Clear all questions in form
    const handleClearForm = () => {
        if (!form) return;
        const resetStructure: FormStructure = {
            sections: [
                {
                    id: `sec_${Date.now()}`,
                    title: "Registration Questions",
                    description: "",
                    afterSectionAction: "submit_form",
                    questions: [],
                },
            ],
        };
        setForm({
            ...form,
            structure: resetStructure,
        });
        pushHistory(resetStructure);
        setIsClearConfirmOpen(false);
        toast.success("Form cleared successfully.");
    };

    // Branching Graph Validation: check for broken links
    const branchingWarnings = useMemo(() => {
        if (!form?.structure?.sections) return [];
        const validSectionIds = new Set(form.structure.sections.map((s) => s.id));
        const warnings: string[] = [];

        form.structure.sections.forEach((sec, sIdx) => {
            if (
                sec.afterSectionAction &&
                sec.afterSectionAction !== "submit_form" &&
                sec.afterSectionAction !== "next_section"
            ) {
                if (!validSectionIds.has(sec.afterSectionAction)) {
                    warnings.push(`Section ${sIdx + 1} targets a deleted section.`);
                }
            }

            sec.questions.forEach((q) => {
                (q.options || []).forEach((opt) => {
                    if (
                        opt.goToSectionId &&
                        opt.goToSectionId !== "submit_form" &&
                        opt.goToSectionId !== "next_section"
                    ) {
                        if (!validSectionIds.has(opt.goToSectionId)) {
                            warnings.push(
                                `Question "${q.title}" option "${opt.text}" routes to a missing section.`
                            );
                        }
                    }
                });
            });
        });

        return warnings;
    }, [form?.structure?.sections]);

    if (loading) {
        return (
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
                <OrbixLoader size="lg" />
                <span className="text-xs font-black text-neutral-600">Loading Form Builder Studio...</span>
            </div>
        );
    }

    if (!form) return null;

    const accentColor = form.themeSettings?.accentColor || "#38BDF8";
    const sections = form.structure?.sections || [];

    return (
        <div className="space-y-6 text-black">
            {/* Top Workspace Navigation Bar */}
            <div className="pb-4 border-b-2 border-black/55 flex flex-col gap-4">
                {/* Upper bar: Title, Save Status, Undo/Redo, Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer shrink-0"
                                title="Back to event"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Event Details</span>
                            </button>
                        )}

                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
                                    {form.title || "Untitled Registration Form"}
                                </h2>

                                {/* Dynamic Save Status Badge */}
                                <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border border-black/20 bg-neutral-50 shadow-inner">
                                    {saveStatus === "saving" && (
                                        <>
                                            <OrbixLoader size="xs" />
                                            <span className="text-amber-800">Saving...</span>
                                        </>
                                    )}
                                    {saveStatus === "saved" && (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                            <span className="text-neutral-600">Saved to cloud</span>
                                        </>
                                    )}
                                    {saveStatus === "unsaved" && (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-amber-700">Changes not saved</span>
                                        </>
                                    )}
                                    {saveStatus === "error" && (
                                        <button
                                            type="button"
                                            onClick={handleSaveForm}
                                            className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            <span>Save failed — Retry</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Upper Toolbar: Undo, Redo, Theme, Preview, Share, Save, Publish */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {/* Undo / Redo */}
                        <div className="flex items-center p-0.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                            <button
                                type="button"
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 className="w-4 h-4 text-black" />
                            </button>
                            <button
                                type="button"
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <Redo2 className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        {/* Theme Button */}
                        <button
                            type="button"
                            onClick={() => setIsThemeDrawerOpen(true)}
                            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                            title="Theme & Colors"
                        >
                            <Palette className="w-4 h-4 text-black" />
                            <span className="hidden sm:inline">Theme</span>
                        </button>

                        {/* Preview Simulator Action */}
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                            className={`p-2 sm:px-3 sm:py-2 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-colors ${
                                isPreviewOpen ? "bg-black text-white" : "bg-white hover:bg-neutral-100 text-black"
                            }`}
                            title="Preview form as student"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">{isPreviewOpen ? "Exit Preview" : "Preview"}</span>
                        </button>

                        {/* Share Student Link */}
                        <button
                            type="button"
                            onClick={handleCopyShareLink}
                            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                            title="Copy link"
                        >
                            {copiedShareLink ? (
                                <Check className="w-4 h-4 text-emerald-800 stroke-[3]" />
                            ) : (
                                <Share2 className="w-4 h-4 text-black" />
                            )}
                            <span className="hidden sm:inline">Share</span>
                        </button>

                        {/* Save Draft */}
                        <button
                            type="button"
                            onClick={handleSaveForm}
                            disabled={saving || isPublishing}
                            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            title="Save working draft"
                        >
                            {saving ? (
                                <>
                                    <OrbixLoader size="xs" />
                                    <span className="hidden sm:inline">Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 stroke-[2.5]" />
                                    <span className="hidden sm:inline">Save Draft</span>
                                </>
                            )}
                        </button>

                        {/* Publish Live */}
                        <button
                            type="button"
                            onClick={handlePublishForm}
                            disabled={saving || isPublishing}
                            className="px-3.5 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            title="Publish live snapshot for students"
                        >
                            {isPublishing ? (
                                <>
                                    <OrbixLoader size="xs" />
                                    <span>Publishing...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Publish Live</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 3 Main Navigation Tabs: Questions | Responses | Settings */}
                <div className="flex items-center justify-center pt-2">
                    <div className="flex items-center p-1 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("questions");
                                setIsPreviewOpen(false);
                            }}
                            className={`px-6 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all ${
                                activeTab === "questions" && !isPreviewOpen
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-black hover:bg-neutral-100"
                            }`}
                        >
                            Questions
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("responses");
                                setIsPreviewOpen(false);
                            }}
                            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all flex items-center gap-2 ${
                                activeTab === "responses" && !isPreviewOpen
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-black hover:bg-neutral-100"
                            }`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span>Responses</span>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    activeTab === "responses" && !isPreviewOpen
                                        ? "bg-white text-black border-white"
                                        : "bg-neutral-200 text-black border-black/30"
                                }`}
                            >
                                {registeredCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("settings");
                                setIsPreviewOpen(false);
                            }}
                            className={`px-6 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all flex items-center gap-2 ${
                                activeTab === "settings" && !isPreviewOpen
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-black hover:bg-neutral-100"
                            }`}
                        >
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Branching Warning Banner if broken links exist */}
            {branchingWarnings.length > 0 && activeTab === "questions" && (
                <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-amber-100 border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs font-bold text-amber-950 space-y-1">
                        <span className="font-black block">Branching Logic Alert:</span>
                        {branchingWarnings.map((w, idx) => (
                            <p key={idx}>• {w}</p>
                        ))}
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* PREVIEW SIMULATOR OVERLAY */}
            {/* ---------------------------------------------------------------- */}
            {isPreviewOpen && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="p-4 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3 text-xs font-black">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-black" />
                            <span>Previewing form as a student. Submissions here are simulated locally.</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            Exit Preview
                        </button>
                    </div>

                    <StudentFormRenderer
                        form={form}
                        event={event}
                        club={club}
                        isPreview={true}
                        studentProfile={{
                            id: "preview-user",
                            fullName: "Alex Mercer",
                            firstName: "Alex",
                            lastName: "Mercer",
                            username: "alexmercer",
                            email: "alex.mercer@campus.edu",
                            avatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png",
                            college: "School of Engineering & Technology",
                            collegeId: "inst_123",
                            rollNumber: "2024CS0142",
                            department: "Computer Science & Engineering",
                            yearOfStudy: "3rd Year",
                            phoneNumber: "+91 98765 43210",
                            github: "alexmercer",
                            linkedin: "alex-mercer",
                            website: "https://alexmercer.dev",
                            resumeUrl: "https://res.cloudinary.com/dj0ivep44/raw/upload/sample_resume.pdf",
                            resumeFilename: "Alex_Mercer_Resume_2026.pdf",
                            isVerifiedCampus: true,
                        }}
                    />
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 1: QUESTIONS (GOOGLE FORMS BUILDER CANVAS) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "questions" && !isPreviewOpen && (
                <div className="relative max-w-3xl mx-auto space-y-6 pb-24">
                    {/* Header Image Banner */}
                    {form.headerImageUrl && (
                        <div className="relative rounded-3xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] group">
                            <img
                                src={form.headerImageUrl}
                                alt="Form Header Banner"
                                className="w-full h-36 sm:h-48 object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => setIsThemeDrawerOpen(true)}
                                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-neutral-100"
                            >
                                Change Banner
                            </button>
                        </div>
                    )}

                    {/* Master Form Title & Description Card */}
                    <div
                        className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 sm:p-7 space-y-3 relative overflow-hidden"
                        style={{ borderTopWidth: "6px", borderTopColor: accentColor }}
                    >
                        <div className="flex items-center justify-between">
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Form Title..."
                                className="w-full text-xl sm:text-2xl font-black text-black border-b-2 border-black/30 hover:border-black focus:border-black focus:outline-none bg-transparent py-1 placeholder:text-neutral-400"
                            />
                        </div>
                        <textarea
                            value={form.description || ""}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Form Description (guidelines, rules, prerequisites, prizes)..."
                            rows={2}
                            className="w-full text-xs sm:text-sm font-medium text-neutral-700 border-b border-black/20 focus:border-black focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 resize-none"
                        />
                    </div>

                    {/* Verified Identity Notice Card */}
                    <div className="rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#a2ff86] border border-black flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-black text-black flex items-center gap-1.5">
                                    Orbix Verified Identity Integration
                                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        Active
                                    </span>
                                </h4>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Orbix pre-fills and binds student name, campus email, college, roll number, and verified profile credentials automatically upon submission.
                                </p>
                            </div>
                        </div>

                        {/* Quick-Add Event Question Templates */}
                        <div className="pt-2 border-t border-black/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black text-neutral-700">
                                    + Quick Add Common Event Questions:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="text-[11px] font-black text-neutral-600 hover:text-black flex items-center gap-1 cursor-pointer underline"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    <span>Browse Question Bank</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_TEMPLATES.map((tmpl) => {
                                    const IconComp = tmpl.icon;
                                    return (
                                        <button
                                            key={tmpl.key}
                                            type="button"
                                            onClick={() => {
                                                const targetSecIdx = (form?.structure?.sections?.length || 1) - 1;
                                                const newQ = tmpl.build();
                                                updateSections((secs) => {
                                                    if (secs[targetSecIdx]) secs[targetSecIdx].questions.push(newQ);
                                                    return secs;
                                                });
                                                setActiveQuestionId(newQ.id);
                                                toast.success(`Added question: "${tmpl.label}"`);
                                            }}
                                            className={`px-2.5 py-1.5 rounded-xl border border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] hover:shadow-[0.5px_0.5px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] cursor-pointer flex items-center gap-1.5 transition-all ${tmpl.color}`}
                                            title={`Add "${tmpl.label}"`}
                                        >
                                            <IconComp className="w-3.5 h-3.5" />
                                            <span>+ {tmpl.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Sections & Questions Matrix */}
                    {sections.map((section, sIdx) => (
                        <div key={section.id} className="space-y-4">
                            {/* Section Card */}
                            <SectionCard
                                section={section}
                                index={sIdx}
                                totalSections={sections.length}
                                allSections={sections}
                                accentColor={accentColor}
                                onChange={(updatedSec) => {
                                    updateSections((secs) => {
                                        secs[sIdx] = updatedSec;
                                        return secs;
                                    });
                                }}
                                onDelete={() => {
                                    updateSections((secs) => secs.filter((_, idx) => idx !== sIdx));
                                }}
                                onDuplicate={() => {
                                    const duplicated: FormSection = {
                                        ...section,
                                        id: `sec_${Date.now()}`,
                                        title: `${section.title} (Copy)`,
                                        questions: section.questions.map((q) => ({
                                            ...q,
                                            id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                                        })),
                                    };
                                    updateSections((secs) => {
                                        secs.splice(sIdx + 1, 0, duplicated);
                                        return secs;
                                    });
                                }}
                                onMoveUp={() => {
                                    if (sIdx === 0) return;
                                    updateSections((secs) => {
                                        const temp = secs[sIdx - 1];
                                        secs[sIdx - 1] = secs[sIdx];
                                        secs[sIdx] = temp;
                                        return secs;
                                    });
                                }}
                                onMoveDown={() => {
                                    if (sIdx === sections.length - 1) return;
                                    updateSections((secs) => {
                                        const temp = secs[sIdx + 1];
                                        secs[sIdx + 1] = secs[sIdx];
                                        secs[sIdx] = temp;
                                        return secs;
                                    });
                                }}
                            />

                            {/* Questions belonging to this section */}
                            <div className="space-y-4 pl-0 sm:pl-3">
                                {section.questions.map((question, qIdx) => (
                                    <QuestionCard
                                        key={question.id}
                                        question={question}
                                        index={qIdx}
                                        totalQuestions={section.questions.length}
                                        sections={sections}
                                        currentSectionId={section.id}
                                        accentColor={accentColor}
                                        eventId={eventId}
                                        isActive={activeQuestionId === question.id}
                                        isQuiz={Boolean(form.settings.quiz?.isQuiz)}
                                        defaultPoints={
                                            form.settings.quiz?.defaultPointsPerQuestion ??
                                            form.settings.questionDefaults?.defaultPointValue ??
                                            1
                                        }
                                        onSelect={() => setActiveQuestionId(question.id)}
                                        onChange={(updatedQ) => {
                                            updateSections((secs) => {
                                                secs[sIdx].questions[qIdx] = updatedQ;
                                                return secs;
                                            });
                                        }}
                                        onDelete={() => {
                                            updateSections((secs) => {
                                                secs[sIdx].questions = secs[sIdx].questions.filter(
                                                    (_, idx) => idx !== qIdx
                                                );
                                                return secs;
                                            });
                                        }}
                                        onDuplicate={() => {
                                            const dupQ: FormQuestion = {
                                                ...question,
                                                id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                                                title: `${question.title} (Copy)`,
                                            };
                                            updateSections((secs) => {
                                                secs[sIdx].questions.splice(qIdx + 1, 0, dupQ);
                                                return secs;
                                            });
                                        }}
                                        onMoveUp={() => {
                                            if (qIdx === 0) return;
                                            updateSections((secs) => {
                                                const temp = secs[sIdx].questions[qIdx - 1];
                                                secs[sIdx].questions[qIdx - 1] = secs[sIdx].questions[qIdx];
                                                secs[sIdx].questions[qIdx] = temp;
                                                return secs;
                                            });
                                        }}
                                        onMoveDown={() => {
                                            if (qIdx === section.questions.length - 1) return;
                                            updateSections((secs) => {
                                                const temp = secs[sIdx].questions[qIdx + 1];
                                                secs[sIdx].questions[qIdx + 1] = secs[sIdx].questions[qIdx];
                                                secs[sIdx].questions[qIdx] = temp;
                                                return secs;
                                            });
                                        }}
                                    />
                                ))}

                                {/* Add Question / Blocks to this Section Action Bar */}
                                <div className="flex items-center gap-2.5 flex-wrap pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleAddQuestion(sIdx)}
                                        className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black font-black text-xs text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Add Question</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddTitleBlock(sIdx)}
                                        className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-black font-bold text-xs text-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                                        title="Add Title & Description block"
                                    >
                                        <Heading className="w-3.5 h-3.5" />
                                        <span>Title Block</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddImageBlock(sIdx)}
                                        className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-black font-bold text-xs text-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                                        title="Add Image block"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        <span>Image</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddVideoBlock(sIdx)}
                                        className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-black font-bold text-xs text-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                                        title="Add Video block"
                                    >
                                        <Video className="w-3.5 h-3.5" />
                                        <span>Video</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Bottom Actions: Add Section & Clear Form */}
                    <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={handleAddSection}
                            className="px-6 py-3 rounded-2xl bg-white hover:bg-neutral-50 border-2 border-black font-black text-xs sm:text-sm text-black shadow-[4px_4px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <Split className="w-4 h-4 stroke-[2.5]" />
                            <span>Add New Section (Multi-Step Page)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsClearConfirmOpen(true)}
                            className="px-4 py-2.5 rounded-xl border border-black/40 hover:border-black font-bold text-xs text-neutral-600 hover:text-rose-600 cursor-pointer flex items-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear Form</span>
                        </button>
                    </div>

                    {/* Floating Quick-Add Toolbar (Google Forms style on the right side) */}
                    <div className="fixed bottom-6 right-6 lg:bottom-auto lg:top-44 lg:right-6 bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_#000] p-1.5 flex lg:flex-col items-center gap-1.5 z-40">
                        <button
                            type="button"
                            onClick={() => handleAddQuestion()}
                            className="p-2.5 rounded-xl hover:bg-[#FFE566] text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Add Question (+)"
                        >
                            <Plus className="w-5 h-5 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Import Questions (Clipboard)"
                        >
                            <ClipboardList className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddTitleBlock()}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Add Title and description (Tt)"
                        >
                            <Heading className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddImageBlock()}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Add Image block"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddVideoBlock()}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Add Video block"
                        >
                            <Video className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleAddSection}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 text-black border border-transparent hover:border-black cursor-pointer transition-transform active:scale-95"
                            title="Add Section Break (=)"
                        >
                            <Split className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 2: RESPONSES (LIVE ANALYTICS & INSPECTOR) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "responses" && !isPreviewOpen && (
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Accepting Responses Bar */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-black">
                                    {registeredCount} {registeredCount === 1 ? "Response" : "Responses"} Received
                                </h3>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                        form.settings.isOpen
                                            ? "bg-emerald-300 text-black border-black"
                                            : "bg-rose-300 text-black border-black"
                                    }`}
                                >
                                    {form.settings.isOpen ? "Accepting Responses" : "Not Accepting Responses"}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                Toggle response intake on or off. Students will be notified when submissions close.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-neutral-700">Accepting Responses</span>
                            <NeoToggle
                                checked={form.settings.isOpen}
                                onChange={(val) => {
                                    const updatedSettings: FormSettingsType = {
                                        ...form.settings,
                                        isOpen: val,
                                    };
                                    setForm({ ...form, settings: updatedSettings });
                                    toast.success(
                                        val
                                            ? "Registrations reopened for students!"
                                            : "Registrations closed."
                                    );
                                }}
                            />
                        </div>
                    </div>

                    <FormResponsesAnalyticsView
                        eventId={eventId}
                        eventTitle={form.title}
                    />
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 3: SETTINGS (FIRST-CLASS FORM SETTINGS VIEW) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "settings" && !isPreviewOpen && (
                <FormSettingsTab
                    form={form}
                    event={event}
                    accentColor={accentColor}
                    onUpdateSettings={(newSettings) => {
                        setForm((prev) => (prev ? { ...prev, settings: newSettings } : null));
                    }}
                />
            )}

            {/* Theme Drawer */}
            <FormThemeDrawer
                isOpen={isThemeDrawerOpen}
                onClose={() => setIsThemeDrawerOpen(false)}
                theme={form.themeSettings}
                headerImageUrl={form.headerImageUrl}
                eventId={eventId}
                onChangeTheme={(themeSettings) => setForm({ ...form, themeSettings })}
                onChangeHeaderImage={(url, publicId) =>
                    setForm({ ...form, headerImageUrl: url, headerImagePublicId: publicId })
                }
            />

            {/* Import Questions Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-xl bg-white rounded-3xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-black" />
                                <h3 className="text-base font-black text-black">Import Questions</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="p-1 rounded-lg border border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <p className="text-xs text-neutral-600 font-medium">
                            Select questions from the template bank to append directly to the active section.
                        </p>

                        <div className="space-y-2.5">
                            {QUICK_TEMPLATES.map((tmpl) => (
                                <div
                                    key={tmpl.key}
                                    className="p-3.5 rounded-2xl border-2 border-black bg-neutral-50 hover:bg-[#FAF6EE] flex items-center justify-between gap-3 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <h5 className="text-xs sm:text-sm font-black text-black truncate">
                                            {tmpl.label}
                                        </h5>
                                        <p className="text-[11px] text-neutral-500 font-medium truncate">
                                            Preconfigured question with validation
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetSecIdx = (form?.structure?.sections?.length || 1) - 1;
                                            const newQ = tmpl.build();
                                            updateSections((secs) => {
                                                if (secs[targetSecIdx]) secs[targetSecIdx].questions.push(newQ);
                                                return secs;
                                            });
                                            setActiveQuestionId(newQ.id);
                                            toast.success(`Imported: "${tmpl.label}"`);
                                            setIsImportModalOpen(false);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-black hover:text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-colors"
                                    >
                                        + Import
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Form Confirmation Modal */}
            {isClearConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-rose-100 border-2 border-black mx-auto flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Trash2 className="w-6 h-6 text-rose-600" />
                        </div>
                        <h4 className="text-base font-black text-black">Clear All Questions?</h4>
                        <p className="text-xs text-neutral-600 font-medium">
                            This will remove all current questions from the draft. You can undo this action with Ctrl+Z.
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsClearConfirmOpen(false)}
                                className="px-4 py-2 rounded-xl border-2 border-black text-xs font-black hover:bg-neutral-100 cursor-pointer shadow-[2px_2px_0px_#000]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleClearForm}
                                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Yes, Clear Form
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
