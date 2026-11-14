import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    Plus,
    Split,
    Palette,
    Settings,
    Eye,
    BarChart3,
    ArrowLeft,
    FileText,
    Code2,
    Trophy,
    Users,
    Layers,
    UploadCloud,
    Sparkles,
    Undo2,
    Redo2,
    AlertTriangle,
    Image as ImageIcon,
    Video,
    Heading,
    ClipboardList,
    Trash2,
    X,
    LayoutTemplate,
    Wand2,
    CheckSquare,
    Square,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Lightbulb,
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
    fetchClubQuestionLibrary,
    requestAiQuestionSuggestions,
} from "../../../api/clubEventFormApi";
import {
    ORBIX_FORM_TEMPLATES,
    instantiateTemplate,
    type FormTemplateDefinition,
} from "./formTemplates";
import { QuestionCard } from "./QuestionCard";
import { SectionCard } from "./SectionCard";
import { NeoToggle } from "../../../components/NeoToggle";
import { NeoSelect } from "../../../components/NeoSelect";
import { OrbixLoader } from "../../../components/ui/loader";
import { useToast } from "../../../context/ToastContext";

// Lazy-loaded heavy views for performance (Phase 4.1)
const FormThemeDrawer = React.lazy(() =>
    import("./FormThemeDrawer").then((m) => ({ default: m.FormThemeDrawer }))
);
const FormSettingsTab = React.lazy(() =>
    import("./FormSettingsTab").then((m) => ({ default: m.FormSettingsTab }))
);
const FormResponsesAnalyticsView = React.lazy(() =>
    import("./FormResponsesAnalyticsView").then((m) => ({ default: m.FormResponsesAnalyticsView }))
);
const StudentFormRenderer = React.lazy(() =>
    import("./StudentFormRenderer").then((m) => ({ default: m.StudentFormRenderer }))
);

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
            description: "Accepts PDF or presentation slide decks up to 25 MB.",
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
    eventId?: string;
    club?: any;
    onBack?: () => void;
    isWizardMode?: boolean;
    initialFormRecord?: ClubEventFormRecord | null;
    initialEventData?: any;
    onWizardChange?: (form: ClubEventFormRecord) => void;
    onWizardBack?: () => void;
    onWizardSubmit?: () => void;
}

type MainTab = "questions" | "responses" | "settings";
type SaveBadgeStatus = "saved" | "saving" | "unsaved" | "error";

export const EventFormBuilderWorkspace: React.FC<EventFormBuilderWorkspaceProps> = ({
    eventId,
    club,
    onBack: _onBack,
    isWizardMode = false,
    initialFormRecord,
    initialEventData,
    onWizardChange,
    onWizardBack: _onWizardBack,
    onWizardSubmit,
}) => {
    const toast = useToast();
    const safeEventId = eventId || "create-draft";

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
    const [isTemplatesHubModalOpen, setIsTemplatesHubModalOpen] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

    // Phase 6.1 Question Library State
    const [isQuestionLibraryOpen, setIsQuestionLibraryOpen] = useState(false);
    const [loadingLibrary, setLoadingLibrary] = useState(false);
    const [pastEventsLibrary, setPastEventsLibrary] = useState<any[]>([]);
    const [selectedLibQuestionIds, setSelectedLibQuestionIds] = useState<Set<string>>(new Set());
    const [libTargetSectionId, setLibTargetSectionId] = useState<string>("");
    const [expandedLibEventId, setExpandedLibEventId] = useState<string | null>(null);

    // Phase 6.2 Form Templates State
    const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<FormTemplateDefinition | null>(null);
    const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("All");

    // Phase 6.3 AI Assistant State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiSuggestedQuestions, setAiSuggestedQuestions] = useState<FormQuestion[]>([]);
    const [selectedAiIndices, setSelectedAiIndices] = useState<Set<number>>(new Set());
    const [aiTargetSectionId, setAiTargetSectionId] = useState<string>("");
    const [aiEngineLabel, setAiEngineLabel] = useState<string | null>(null);

    // Section Deletion with Undo Behaviour
    const [deletedSectionNotice, setDeletedSectionNotice] = useState<{
        section: FormSection;
        index: number;
    } | null>(null);
    const deleteNoticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleDeleteSection = (sIdx: number) => {
        if (!form?.structure?.sections) return;
        const targetSec = form.structure.sections[sIdx];
        if (!targetSec) return;

        if (deleteNoticeTimeoutRef.current) clearTimeout(deleteNoticeTimeoutRef.current);
        setDeletedSectionNotice({
            section: JSON.parse(JSON.stringify(targetSec)),
            index: sIdx,
        });
        deleteNoticeTimeoutRef.current = setTimeout(() => {
            setDeletedSectionNotice(null);
        }, 9000);

        updateSections((secs) => secs.filter((_, idx) => idx !== sIdx));
        toast.info(`Deleted "${targetSec.title || `Section ${sIdx + 1}`}". Click Undo to restore.`);
    };

    const handleRestoreDeletedSection = () => {
        if (!deletedSectionNotice) return;
        const { section, index } = deletedSectionNotice;
        updateSections((secs) => {
            const next = [...secs];
            const restoreIdx = Math.min(index, next.length);
            next.splice(restoreIdx, 0, section);
            return next;
        });
        toast.success(`Restored "${section.title}"`);
        setDeletedSectionNotice(null);
        if (deleteNoticeTimeoutRef.current) clearTimeout(deleteNoticeTimeoutRef.current);
    };

    // Load initial form definition
    const loadForm = async () => {
        setLoading(true);
        try {
            if (isWizardMode && initialFormRecord) {
                setForm(initialFormRecord);
                setEvent(initialEventData || { title: initialFormRecord.title || "New Event" });
                setRegisteredCount(0);

                if (initialFormRecord.structure) {
                    setHistory([JSON.parse(JSON.stringify(initialFormRecord.structure))]);
                    setHistoryIndex(0);
                }

                if (initialFormRecord.structure?.sections?.[0]?.questions?.[0]) {
                    setActiveQuestionId(initialFormRecord.structure.sections[0].questions[0].id);
                }
                setSaveStatus("saved");
                setLoading(false);
                isInitialLoad.current = false;
                return;
            }

            if (!eventId || eventId === "create-draft") {
                setLoading(false);
                isInitialLoad.current = false;
                return;
            }

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
    }, [eventId, isWizardMode]);

    // Bubble form modifications up in wizard mode
    useEffect(() => {
        if (isWizardMode && form && onWizardChange) {
            onWizardChange(form);
        }
    }, [form, isWizardMode, onWizardChange]);

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
            if (isWizardMode) {
                if (form && onWizardChange) onWizardChange(form);
                setSaveStatus("saved");
                return;
            }

            if (!eventId || eventId === "create-draft") {
                setSaveStatus("saved");
                return;
            }

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
    }, [form?.structure, form?.title, form?.description, form?.settings, form?.themeSettings, isWizardMode]);

    // Explicit Save Draft Button Click
    const handleSaveForm = async () => {
        if (!form) return;
        if (isWizardMode) {
            if (onWizardChange) onWizardChange(form);
            setSaveStatus("saved");
            toast.success("Draft saved to wizard draft!", { title: "Draft Saved" });
            return;
        }

        if (!eventId || eventId === "create-draft") return;
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
        if (isWizardMode) {
            if (onWizardSubmit) onWizardSubmit();
            return;
        }

        if (!eventId || eventId === "create-draft") return;
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
            videoUrl: "",
            videoTitle: "",
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

    // -------------------------------------------------------------------------
    // PHASE 6.1: QUESTION LIBRARY HANDLERS
    // -------------------------------------------------------------------------
    const handleOpenQuestionLibrary = async () => {
        setIsQuestionLibraryOpen(true);
        if (pastEventsLibrary.length === 0) {
            setLoadingLibrary(true);
            try {
                const res = await fetchClubQuestionLibrary(safeEventId, club?.id);
                setPastEventsLibrary(res.library || []);
                if (res.library && res.library.length > 0) {
                    setExpandedLibEventId(res.library[0].eventId);
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to load question library.");
            } finally {
                setLoadingLibrary(false);
            }
        }
        if (form?.structure?.sections?.length) {
            setLibTargetSectionId(form.structure.sections[form.structure.sections.length - 1].id);
        }
    };

    const handleToggleSelectLibQuestion = (qId: string) => {
        setSelectedLibQuestionIds((prev) => {
            const next = new Set(prev);
            if (next.has(qId)) next.delete(qId);
            else next.add(qId);
            return next;
        });
    };

    const handleToggleSelectAllInEvent = (questions: FormQuestion[]) => {
        const allIds = questions.map((q) => q.id);
        const allSelected = allIds.every((id) => selectedLibQuestionIds.has(id));
        setSelectedLibQuestionIds((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                allIds.forEach((id) => next.delete(id));
            } else {
                allIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const handleInsertLibraryQuestions = () => {
        if (selectedLibQuestionIds.size === 0) {
            toast.error("Please select at least one question from the library.");
            return;
        }

        const chosenQuestions: FormQuestion[] = [];
        pastEventsLibrary.forEach((evt) => {
            evt.questions.forEach((q: FormQuestion) => {
                if (selectedLibQuestionIds.has(q.id)) {
                    chosenQuestions.push({
                        ...JSON.parse(JSON.stringify(q)),
                        id: `q_lib_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    });
                }
            });
        });

        if (chosenQuestions.length === 0) return;

        updateSections((secs) => {
            let targetIdx = secs.findIndex((s) => s.id === libTargetSectionId);
            if (targetIdx === -1) targetIdx = secs.length - 1;
            if (targetIdx >= 0) {
                secs[targetIdx].questions.push(...chosenQuestions);
            } else {
                secs.push({
                    id: `sec_${Date.now()}`,
                    title: "Imported Questions",
                    afterSectionAction: "submit_form",
                    questions: chosenQuestions,
                });
            }
            return secs;
        });

        toast.success(`Inserted ${chosenQuestions.length} questions from Question Library!`);
        setSelectedLibQuestionIds(new Set());
        setIsQuestionLibraryOpen(false);
    };

    // -------------------------------------------------------------------------
    // PHASE 6.2: FORM TEMPLATES HANDLERS
    // -------------------------------------------------------------------------
    const handleApplyTemplate = (tmpl: FormTemplateDefinition, mode: "replace" | "append") => {
        if (!form) return;
        const instantiated = instantiateTemplate(tmpl);

        if (mode === "replace") {
            const updatedStructure: FormStructure = {
                sections: instantiated.sections,
            };
            const updatedTheme = {
                ...form.themeSettings,
                ...instantiated.themeSettings,
            };
            const updatedSettings: FormSettingsType = {
                ...form.settings,
                ...(instantiated.settings || {}),
            };

            setForm((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    title: instantiated.title,
                    description: instantiated.description,
                    structure: updatedStructure,
                    themeSettings: updatedTheme,
                    settings: updatedSettings,
                };
            });
            pushHistory(updatedStructure);
            toast.success(`Applied template: "${tmpl.title}"`);
        } else {
            updateSections((secs) => [...secs, ...instantiated.sections]);
            toast.success(`Appended ${instantiated.sections.length} sections from "${tmpl.title}"`);
        }

        setIsTemplatesModalOpen(false);
        setPreviewTemplate(null);
    };

    // -------------------------------------------------------------------------
    // PHASE 6.3: AI ASSISTANT HANDLERS
    // -------------------------------------------------------------------------
    const handleGenerateAiQuestions = async () => {
        if (!aiPrompt.trim()) {
            toast.error("Please enter a brief description or prompt for the AI questionnaire.");
            return;
        }

        setIsAiGenerating(true);
        try {
            const res = await requestAiQuestionSuggestions(safeEventId, {
                prompt: aiPrompt.trim(),
                eventType: form?.title,
                eventDescription: form?.description || undefined,
                eventTitle: form?.title,
                clubId: club?.id,
            });

            const questions = res.suggestedQuestions || [];
            setAiSuggestedQuestions(questions);
            setSelectedAiIndices(new Set(questions.map((_, idx) => idx)));
            setAiEngineLabel(
                res.generatedBy === "gemini" ? "Orbix AI Engine" : "Orbix Domain Knowledge"
            );
            toast.success(`Generated ${questions.length} customized questions!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to generate AI question suggestions.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleToggleSelectAiIndex = (idx: number) => {
        setSelectedAiIndices((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const handleInsertAiQuestions = () => {
        if (selectedAiIndices.size === 0) {
            toast.error("Please select at least one question to insert.");
            return;
        }

        const chosenQuestions: FormQuestion[] = [];
        aiSuggestedQuestions.forEach((q, idx) => {
            if (selectedAiIndices.has(idx)) {
                chosenQuestions.push({
                    ...JSON.parse(JSON.stringify(q)),
                    id: `q_ai_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                });
            }
        });

        updateSections((secs) => {
            let targetIdx = secs.findIndex((s) => s.id === aiTargetSectionId);
            if (targetIdx === -1) targetIdx = secs.length - 1;
            if (targetIdx >= 0) {
                secs[targetIdx].questions.push(...chosenQuestions);
            } else {
                secs.push({
                    id: `sec_${Date.now()}`,
                    title: "AI Suggested Questions",
                    afterSectionAction: "submit_form",
                    questions: chosenQuestions,
                });
            }
            return secs;
        });

        toast.success(`Inserted ${chosenQuestions.length} AI questions into working draft! (Not published)`);
        setIsAiModalOpen(false);
        setAiSuggestedQuestions([]);
        setSelectedAiIndices(new Set());
    };

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
        <div className="space-y-6 text-neutral-900 dark:text-neutral-100">
            {/* Top Workspace Navigation Bar */}
            <div className="pb-4 border-b-2 border-black/10 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: 3 Main Navigation Tabs + Saved/Unsaved Status Indicator */}
                <div className="flex items-center gap-3.5 flex-wrap">
                    {/* Unified Neo-Brutalist Toggler Capsule: Questions | Responses | Settings | Save Status */}
                    <div className="flex items-center p-1.5 bg-[#FAF6EE] dark:bg-[#121212] rounded-2xl border-2 sm:border-[2.5px] border-black shadow-[3.5px_3.5px_0px_#000] gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("questions");
                                setIsPreviewOpen(false);
                            }}
                            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                                activeTab === "questions" && !isPreviewOpen
                                    ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                    : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                            }`}
                        >
                            <span>Questions</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("responses");
                                setIsPreviewOpen(false);
                            }}
                            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 ${
                                activeTab === "responses" && !isPreviewOpen
                                    ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                    : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                            }`}
                        >
                            <BarChart3 className="w-4 h-4 stroke-[2.5]" />
                            <span>Responses</span>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-black shadow-[1px_1px_0px_#000] ${
                                    activeTab === "responses" && !isPreviewOpen
                                        ? "bg-[#FFE566] text-black"
                                        : "bg-white text-black"
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
                            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                                activeTab === "settings" && !isPreviewOpen
                                    ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                    : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                            }`}
                        >
                            <Settings className="w-4 h-4 stroke-[2.5]" />
                            <span>Settings</span>
                        </button>

                        {/* Brutalist Divider */}
                        <div className="hidden sm:block h-6 w-[2px] bg-black/15 dark:bg-white/15 mx-1" />

                        {/* Save Status Badge Integrated Directly Inside the Capsule */}
                        <div className="flex items-center shrink-0">
                            {saveStatus === "saving" && (
                                <span className="px-3 py-1.5 rounded-xl bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-xs font-black inline-flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full border-2 border-black border-t-transparent animate-spin shrink-0" />
                                    <span>Saving...</span>
                                </span>
                            )}
                            {saveStatus === "saved" && (
                                <span className="px-3 py-1.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-xs font-black inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-black shrink-0" />
                                    <span>Saved</span>
                                </span>
                            )}
                            {saveStatus === "unsaved" && (
                                <span className="px-3 py-1.5 rounded-xl bg-[#FF9933] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-xs font-black inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                                    <span>Unsaved</span>
                                </span>
                            )}
                            {saveStatus === "error" && (
                                <button
                                    type="button"
                                    onClick={handleSaveForm}
                                    className="px-3 py-1.5 rounded-xl bg-[#FB7185] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                    title="Click to retry saving"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                                    <span>Save failed · Retry</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Upper Toolbar: Undo, Redo */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Undo / Redo */}
                    <div className="flex items-center bg-white dark:bg-[#121212] border-2 border-black shadow-[2.5px_2.5px_0px_#000] rounded-xl divide-x-2 divide-black overflow-hidden">
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-black dark:text-white transition-colors"
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-black dark:text-white transition-colors"
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <Redo2 className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Branching Warning Banner if broken links exist */}
            {branchingWarnings.length > 0 && activeTab === "questions" && (
                <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <span className="font-semibold block">Branching Logic Alert:</span>
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
                <div className="w-full space-y-4 animate-in fade-in duration-200">
                    <div className="p-3.5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border border-neutral-800 dark:border-neutral-200 shadow-sm flex items-center justify-between gap-3 text-xs font-medium">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-neutral-300 dark:text-neutral-700" />
                            <span>Previewing form as a student. Submissions here are simulated locally.</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(false)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 dark:bg-neutral-900/10 hover:bg-white/20 dark:hover:bg-neutral-900/20 text-white dark:text-neutral-900 font-semibold cursor-pointer transition-colors"
                        >
                            Exit Preview
                        </button>
                    </div>

                    <React.Suspense fallback={<div className="p-8 flex justify-center"><OrbixLoader size="md" /></div>}>
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
                    </React.Suspense>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 1: QUESTIONS (GOOGLE FORMS BUILDER CANVAS) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "questions" && !isPreviewOpen && (
                <div className={`relative w-full lg:pr-20 space-y-6 ${isWizardMode ? "pb-6" : "pb-36"}`}>
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
                                cardSurfaceColor={form.themeSettings?.cardSurfaceColor}
                                cardShadowStyle={form.themeSettings?.cardShadowStyle}
                                onChange={(updatedSec) => {
                                    updateSections((secs) => {
                                        secs[sIdx] = updatedSec;
                                        return secs;
                                    });
                                }}
                                onDelete={() => handleDeleteSection(sIdx)}
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
                                        cardSurfaceColor={form.themeSettings?.cardSurfaceColor}
                                        cardShadowStyle={form.themeSettings?.cardShadowStyle}
                                        eventId={safeEventId}
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
                                <div className="flex items-center gap-2 flex-wrap pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleAddQuestion(sIdx)}
                                        className="px-3.5 py-2 rounded-xl border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] cursor-pointer flex items-center gap-1.5 transition-all"
                                        style={{ backgroundColor: accentColor, color: "#000" }}
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Add Question</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddTitleBlock(sIdx)}
                                        className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] cursor-pointer flex items-center gap-1.5 transition-all"
                                        title="Add Title & Description block"
                                    >
                                        <Heading className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Title Block</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddImageBlock(sIdx)}
                                        className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] cursor-pointer flex items-center gap-1.5 transition-all"
                                        title="Add Image block"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Image</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddVideoBlock(sIdx)}
                                        className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] cursor-pointer flex items-center gap-1.5 transition-all"
                                        title="Add Video block"
                                    >
                                        <Video className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Video</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Floating Vertical Canvas Tools Palette (Desktop docked right) */}
                    <div className="hidden sm:flex flex-col fixed top-44 right-3 sm:right-4 xl:right-6 w-fit bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-2 border-black shadow-[3px_3px_0px_#000] rounded-2xl p-1.5 items-center gap-1.5 z-30">
                        <button
                            type="button"
                            onClick={() => handleAddQuestion()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-black cursor-pointer transition-colors"
                            title="Add Question (+)"
                        >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddTitleBlock()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-black cursor-pointer transition-colors"
                            title="Add Title and description (Tt)"
                        >
                            <Heading className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddImageBlock()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-black cursor-pointer transition-colors"
                            title="Add Image block"
                        >
                            <ImageIcon className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAddVideoBlock()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-black cursor-pointer transition-colors"
                            title="Add Video block"
                        >
                            <Video className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                            type="button"
                            onClick={handleAddSection}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-black cursor-pointer transition-colors"
                            title="Add Section Break (=)"
                        >
                            <Split className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Section Deletion with Instant Undo Banner */}
                    {deletedSectionNotice && (
                        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-neutral-800 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-xs font-medium">
                                Section &ldquo;{deletedSectionNotice.section.title}&rdquo; deleted.
                            </span>
                            <button
                                type="button"
                                onClick={handleRestoreDeletedSection}
                                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer transition-colors"
                            >
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeletedSectionNotice(null)}
                                className="p-1 text-neutral-400 hover:text-white cursor-pointer ml-1"
                                title="Dismiss"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 2: RESPONSES (LIVE ANALYTICS & INSPECTOR) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "responses" && !isPreviewOpen && (
                <div className="w-full space-y-6 pb-24">
                    {/* Accepting Responses Bar */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                                    {registeredCount} {registeredCount === 1 ? "Response" : "Responses"} Received
                                </h3>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${form.settings.isOpen
                                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                        : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                        }`}
                                >
                                    {form.settings.isOpen ? "Accepting Responses" : "Not Accepting Responses"}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-500 font-normal mt-0.5">
                                Toggle response intake on or off. Students will be notified when submissions close.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Accepting Responses</span>
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

                    <React.Suspense fallback={<div className="p-8 flex justify-center"><OrbixLoader size="md" /></div>}>
                        <FormResponsesAnalyticsView
                            eventId={safeEventId}
                            eventTitle={form.title}
                        />
                    </React.Suspense>
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* TAB 3: SETTINGS (FIRST-CLASS FORM SETTINGS VIEW) */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "settings" && !isPreviewOpen && (
                <React.Suspense fallback={<div className="p-8 flex justify-center"><OrbixLoader size="md" /></div>}>
                    <FormSettingsTab
                        form={form}
                        event={event}
                        accentColor={accentColor}
                        onUpdateSettings={(newSettings) => {
                            setForm((prev) => (prev ? { ...prev, settings: newSettings } : null));
                        }}
                    />
                </React.Suspense>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* FLOATING BOTTOM ACTION BAR */}
            {/* Unified & Non-duplicated: AI Assistant, Templates, Theme, Preview, Save Draft, Publish Live */}
            {/* ---------------------------------------------------------------- */}
            {activeTab !== "responses" && (
                <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-fit w-auto">
                    <div className="bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-2 sm:border-[3px] border-black shadow-[3px_3px_0px_#000] sm:shadow-[4px_4px_0px_#000] rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        {/* Circular AI Assistant Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab !== "questions") setActiveTab("questions");
                                if (form?.structure?.sections?.length) {
                                    setAiTargetSectionId(form.structure.sections[form.structure.sections.length - 1].id);
                                }
                                setIsAiModalOpen(true);
                            }}
                            className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] sm:shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center shrink-0 select-none text-black"
                            style={{ backgroundColor: accentColor, color: "#000" }}
                            title="AI Assistant: Generate questions with AI"
                            aria-label="AI Assistant"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" aria-hidden="true">
                                <path fill="currentColor" d="M16.4 21h-2.154l-2-5H5.754l-2 5H1.6L8 5h2zm4.6-9v9h-2v-9zM6.554 14h4.892L9 7.885zM19.529 2.32a.507.507 0 0 1 .942 0l.253.61a4.37 4.37 0 0 0 2.25 2.327l.717.32a.53.53 0 0 1 0 .962l-.758.338a4.36 4.36 0 0 0-2.22 2.25l-.246.566a.506.506 0 0 1-.934 0l-.247-.565a4.36 4.36 0 0 0-2.219-2.251l-.76-.338a.53.53 0 0 1 0-.963l.718-.32a4.37 4.37 0 0 0 2.251-2.325z"/>
                            </svg>
                        </button>

                        {/* Templates Button (Merged with Question Bank & Past Questions) */}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab !== "questions") setActiveTab("questions");
                                setIsTemplatesHubModalOpen(true);
                            }}
                            className="h-8 sm:h-8.5 px-2 sm:px-2.5 md:px-3 rounded-xl bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white font-bold text-[11px] sm:text-xs transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 border-0 shadow-none whitespace-nowrap"
                            title="Templates, Question Bank & Past Questions"
                        >
                            <LayoutTemplate className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                            <span>Templates</span>
                        </button>

                        {/* Theme Button (Icon only, Borderless) */}
                        <button
                            type="button"
                            onClick={() => setIsThemeDrawerOpen(true)}
                            className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 border-0 shadow-none"
                            title="Theme & Colors"
                            aria-label="Theme & Colors"
                        >
                            <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                        </button>

                        {/* Preview Simulator Action (Text only, Borderless) */}
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                            className={`h-8 sm:h-8.5 px-2 sm:px-2.5 md:px-3 rounded-xl font-black text-[11px] sm:text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 border-0 shadow-none whitespace-nowrap ${isPreviewOpen
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white"
                                }`}
                            title="Preview form as student"
                        >
                            <span>{isPreviewOpen ? "Exit Preview" : "Preview"}</span>
                        </button>

                        {/* Add Section Break */}
                        <button
                            type="button"
                            onClick={handleAddSection}
                            className="h-8 sm:h-8.5 px-2 sm:px-2.5 md:px-3 rounded-xl bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white font-bold text-[11px] sm:text-xs transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 border-0 shadow-none whitespace-nowrap"
                            title="Add Section Break (=)"
                        >
                            <Split className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                            <span className="hidden sm:inline">Add Section Break</span>
                            <span className="sm:hidden">Section</span>
                        </button>

                        {/* Clear Form */}
                        <button
                            type="button"
                            onClick={() => setIsClearConfirmOpen(true)}
                            className="h-8 sm:h-8.5 px-2 sm:px-2.5 md:px-3 rounded-xl bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold text-[11px] sm:text-xs transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 border-0 shadow-none whitespace-nowrap"
                            title="Clear Form and reset to a clean section"
                        >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0 text-rose-600 dark:text-rose-400" />
                            <span className="hidden sm:inline">Clear Form</span>
                            <span className="sm:hidden">Clear</span>
                        </button>

                        {/* Divider */}
                        <div className="h-4 sm:h-5 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-0.5 shrink-0" />

                        {/* Save Draft (Text only, Borderless) */}
                        <button
                            type="button"
                            onClick={handleSaveForm}
                            disabled={saving || isPublishing}
                            className="h-8 sm:h-8.5 px-2 sm:px-2.5 md:px-3 rounded-xl bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white font-bold text-[11px] sm:text-xs transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-50 shrink-0 border-0 shadow-none whitespace-nowrap"
                            title="Save working draft"
                        >
                            {saving ? (
                                <>
                                    <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Save Draft</span>
                            )}
                        </button>

                        {/* Publish (Only in Standalone Mode) */}
                        {!isWizardMode && (
                            <button
                                type="button"
                                onClick={handlePublishForm}
                                disabled={saving || isPublishing}
                                className="h-8 sm:h-8.5 px-2.5 sm:px-3 md:px-3.5 rounded-xl font-black text-[11px] sm:text-xs transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-50 shrink-0 whitespace-nowrap bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 border-0 shadow-none"
                                title="Publish"
                            >
                                {isPublishing ? (
                                    <>
                                        <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
                                        <span>Publishing...</span>
                                    </>
                                ) : (
                                    <span>Publish</span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Theme Drawer */}
            <React.Suspense fallback={null}>
                <FormThemeDrawer
                    isOpen={isThemeDrawerOpen}
                    onClose={() => setIsThemeDrawerOpen(false)}
                    theme={form.themeSettings}
                    headerImageUrl={form.headerImageUrl}
                    eventId={safeEventId}
                    onChangeTheme={(themeSettings) => setForm({ ...form, themeSettings })}
                    onChangeHeaderImage={(url, publicId) =>
                        setForm({ ...form, headerImageUrl: url, headerImagePublicId: publicId })
                    }
                />
            </React.Suspense>

            {/* ---------------------------------------------------------------- */}
            {/* TEMPLATES & QUESTION HUB CHOOSER MODAL (Templates vs Question Bank vs Past Questions) */}
            {/* ---------------------------------------------------------------- */}
            {isTemplatesHubModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    onClick={() => setIsTemplatesHubModalOpen(false)}
                    className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-3xl lg:max-w-4xl bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 space-y-6 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl border-2 border-black bg-[#FFE566] flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                    <LayoutTemplate className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                        Templates & Questions Hub
                                    </h3>
                                    <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                        Choose how you want to build your form: full templates, curated questions, or club history.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTemplatesHubModalOpen(false)}
                                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Options Grid (3 Columns: Templates, Question Bank, Past Questions) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Option 1: Form Templates */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsTemplatesHubModalOpen(false);
                                    setIsTemplatesModalOpen(true);
                                }}
                                className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-0.5 active:translate-y-0.5 text-left flex flex-col justify-between space-y-4 transition-all cursor-pointer group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <LayoutTemplate className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-[#FFE566] border border-black">
                                            Templates
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-black group-hover:underline leading-tight">
                                            Form Templates
                                        </h4>
                                        <p className="text-xs font-bold text-neutral-600 mt-1 leading-relaxed">
                                            Pre-built full questionnaires for Hackathons, Workshops, Recruitments, and Competitions.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs font-black text-black">
                                    <span>Browse Templates</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* Option 2: Browse Question Bank */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsTemplatesHubModalOpen(false);
                                    setIsImportModalOpen(true);
                                }}
                                className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-0.5 active:translate-y-0.5 text-left flex flex-col justify-between space-y-4 transition-all cursor-pointer group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#A6E3E9] flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <ClipboardList className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black">
                                            Question Bank
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-black group-hover:underline leading-tight">
                                            Question Bank
                                        </h4>
                                        <p className="text-xs font-bold text-neutral-600 mt-1 leading-relaxed">
                                            Import curated questions for tech stacks, hackathon experience, pitch decks, and GitHub profiles.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs font-black text-black">
                                    <span>Browse Bank</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>

                            {/* Option 3: Past Questions */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsTemplatesHubModalOpen(false);
                                    handleOpenQuestionLibrary();
                                }}
                                className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-0.5 active:translate-y-0.5 text-left flex flex-col justify-between space-y-4 transition-all cursor-pointer group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <FileText className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black">
                                            Club History
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-black group-hover:underline leading-tight">
                                            Past Questions
                                        </h4>
                                        <p className="text-xs font-bold text-neutral-600 mt-1 leading-relaxed">
                                            Reuse questions and sections from previous event forms created by your club chapter.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs font-black text-black">
                                    <span>Open Library</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Import Questions Modal (Browse Question Bank) */}
            {isImportModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    onClick={() => setIsImportModalOpen(false)}
                    className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-xl bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 space-y-4 max-h-[85vh] overflow-y-auto"
                    >
                        <div className="flex items-start justify-between pb-3 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#A6E3E9] flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                    <ClipboardList className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black tracking-tight">Browse Question Bank</h3>
                                    <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                        Select questions from the template bank to append directly to the active section.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="space-y-2.5 pt-1">
                            {QUICK_TEMPLATES.map((tmpl) => (
                                <div
                                    key={tmpl.key}
                                    className="p-4 rounded-2xl border-2 border-black bg-white hover:bg-neutral-50 flex items-center justify-between gap-3 shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                                >
                                    <div className="min-w-0">
                                        <h5 className="text-xs sm:text-sm font-black text-black truncate">
                                            {tmpl.label}
                                        </h5>
                                        <p className="text-[11px] text-neutral-500 font-bold truncate">
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
                                        className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer shrink-0 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        + Import
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Clear Form Confirmation Modal */}
            {isClearConfirmOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none">
                    <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border-3 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl border-2 border-black bg-rose-200 text-rose-800 shadow-[2px_2px_0px_#000] mx-auto flex items-center justify-center">
                            <Trash2 className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h4 className="text-base font-black text-black dark:text-white">Clear All Questions?</h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 font-bold">
                            This will remove all current questions from the draft. You can undo this action with Ctrl+Z.
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsClearConfirmOpen(false)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleClearForm}
                                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform"
                            >
                                Yes, Clear Form
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ---------------------------------------------------------------- */}
            {/* PHASE 6.1: QUESTION LIBRARY MODAL (Past Questions) */}
            {/* ---------------------------------------------------------------- */}
            {isQuestionLibraryOpen && typeof document !== "undefined" && createPortal(
                <div
                    onClick={() => setIsQuestionLibraryOpen(false)}
                    className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-3xl bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 space-y-4 max-h-[88vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between pb-3 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                    <FileText className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">Past Events Question Library</h3>
                                    <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                        Select and reuse questions from previous forms created by your club.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsQuestionLibraryOpen(false)}
                                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Destination section selector */}
                        {sections.length > 0 && (
                            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-bold">
                                <span className="text-black font-black shrink-0">Insert Selected Into:</span>
                                <NeoSelect
                                    value={libTargetSectionId}
                                    onChange={(val) => setLibTargetSectionId(val)}
                                    size="sm"
                                    className="flex-1"
                                    options={sections.map((sec, idx) => ({
                                        value: sec.id,
                                        label: `Section ${idx + 1}: ${sec.title || "Untitled Section"} (${sec.questions.length} questions)`
                                    }))}
                                />
                            </div>
                        )}

                        {/* Library List Body */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {loadingLibrary ? (
                                <div className="p-12 flex flex-col items-center justify-center space-y-2">
                                    <OrbixLoader size="md" />
                                    <span className="text-xs font-black text-black">
                                        Retrieving past club questionnaires...
                                    </span>
                                </div>
                            ) : pastEventsLibrary.length === 0 ? (
                                <div className="p-10 text-center rounded-2xl border-2 border-dashed border-black bg-white shadow-[3px_3px_0px_#000] space-y-2">
                                    <ClipboardList className="w-10 h-10 text-neutral-400 mx-auto" />
                                    <h4 className="text-sm font-black text-black">No Past Questions Found</h4>
                                    <p className="text-xs font-bold text-neutral-600 max-w-md mx-auto">
                                        As your club creates and publishes more event forms in Orbix, their questions will automatically appear here for one-click reuse!
                                    </p>
                                </div>
                            ) : (
                                pastEventsLibrary.map((evt) => {
                                    const isExpanded = expandedLibEventId === evt.eventId;
                                    const allQuestions = evt.questions || [];
                                    const allSelected =
                                        allQuestions.length > 0 &&
                                        allQuestions.every((q: FormQuestion) => selectedLibQuestionIds.has(q.id));

                                    return (
                                        <div
                                            key={evt.eventId}
                                            className="rounded-2xl border-2 border-black overflow-hidden bg-white shadow-[3px_3px_0px_#000]"
                                        >
                                            {/* Event Accordion Header */}
                                            <div className="p-3.5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedLibEventId(isExpanded ? null : evt.eventId)
                                                    }
                                                    className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer flex-1"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-black stroke-[3] shrink-0" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-black stroke-[3] shrink-0" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs sm:text-sm font-black text-black truncate">
                                                            {evt.eventTitle || evt.formTitle}
                                                        </h4>
                                                        <span className="text-[11px] font-bold text-neutral-500">
                                                            {evt.sectionsCount || 1} sections • {allQuestions.length} questions
                                                        </span>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSelectAllInEvent(allQuestions)}
                                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                >
                                                    {allSelected ? "Deselect All" : "Select All"}
                                                </button>
                                            </div>

                                            {/* Questions Checklist */}
                                            {isExpanded && (
                                                <div className="p-3 space-y-2 bg-white divide-y divide-black/10">
                                                    {allQuestions.map((q: FormQuestion) => {
                                                        const isSelected = selectedLibQuestionIds.has(q.id);
                                                        return (
                                                            <div
                                                                key={q.id}
                                                                onClick={() => handleToggleSelectLibQuestion(q.id)}
                                                                className={`pt-2.5 pb-2.5 px-3 rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                                                                    isSelected ? "bg-[#FAF6EE] border border-black" : "hover:bg-neutral-50"
                                                                }`}
                                                            >
                                                                <div className="pt-0.5 shrink-0">
                                                                    <div
                                                                        className={`w-5 h-5 rounded-lg border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000] transition-colors ${
                                                                            isSelected ? "bg-[#a2ff86]" : "bg-white"
                                                                        }`}
                                                                    >
                                                                        {isSelected && (
                                                                            <CheckSquare className="w-3.5 h-3.5 text-black stroke-[3]" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-xs font-black text-black">
                                                                            {q.title || "Untitled Question"}
                                                                        </span>
                                                                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-white border border-black shadow-[1px_1px_0px_#000] text-black">
                                                                            {q.type.replace("_", " ")}
                                                                        </span>
                                                                        {q.required && (
                                                                            <span className="text-[10px] font-black text-rose-600">
                                                                                * Required
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {q.description && (
                                                                        <p className="text-[11px] font-medium text-neutral-600 truncate mt-0.5">
                                                                            {q.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-black">
                                {selectedLibQuestionIds.size}{" "}
                                {selectedLibQuestionIds.size === 1 ? "question" : "questions"} selected
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsQuestionLibraryOpen(false)}
                                    className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInsertLibraryQuestions}
                                    disabled={selectedLibQuestionIds.size === 0}
                                    className="px-4 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-black text-xs font-black shadow-[3px_3px_0px_#000] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Insert Selected ({selectedLibQuestionIds.size})</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ---------------------------------------------------------------- */}
            {/* PHASE 6.2: FORM TEMPLATES CATALOG MODAL */}
            {/* ---------------------------------------------------------------- */}
            {isTemplatesModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    onClick={() => {
                        setIsTemplatesModalOpen(false);
                        setPreviewTemplate(null);
                    }}
                    className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-4xl bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 space-y-5 max-h-[85vh] flex flex-col"
                    >
                        <div className="flex items-start justify-between pb-3 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                                    <LayoutTemplate className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Orbix Form Templates Catalog ({ORBIX_FORM_TEMPLATES.length})
                                    </h3>
                                    <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                        Battle-tested, fully editable starting questionnaires designed for college events.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsTemplatesModalOpen(false);
                                    setPreviewTemplate(null);
                                }}
                                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* If previewing a single template */}
                        {previewTemplate ? (
                            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                                <button
                                    type="button"
                                    onClick={() => setPreviewTemplate(null)}
                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Back to all templates</span>
                                </button>

                                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-sm font-black text-black">{previewTemplate.title}</h4>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black">
                                            {previewTemplate.category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-600 font-bold">{previewTemplate.description || previewTemplate.summary}</p>
                                    <div className="flex items-center gap-3 pt-1 text-[11px] font-black text-black">
                                        <span>• {previewTemplate.structure.sections.length} Sections</span>
                                        <span>
                                            •{" "}
                                            {previewTemplate.structure.sections.reduce(
                                                (acc, s) => acc + s.questions.length,
                                                0
                                            )}{" "}
                                            Questions
                                        </span>
                                        <span className="text-neutral-500 font-bold">• Includes Conditional Logic & File Uploads</span>
                                    </div>
                                </div>

                                {/* Preview sections & questions */}
                                <div className="space-y-3">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                        Template Questionnaire Structure:
                                    </h5>
                                    {previewTemplate.structure.sections.map((sec, sIdx) => (
                                        <div
                                            key={sec.id || sIdx}
                                            className="p-4 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_#000] space-y-2"
                                        >
                                            <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                                                <h6 className="text-xs font-black text-black">
                                                    Section {sIdx + 1}: {sec.title}
                                                </h6>
                                                <span className="text-[10px] text-neutral-600 font-bold">
                                                    {sec.questions.length} questions
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 pl-2">
                                                {sec.questions.map((q, qIdx) => (
                                                    <div key={q.id || qIdx} className="text-xs font-bold text-neutral-700 flex items-center gap-2">
                                                        <span className="text-neutral-400 font-black">{qIdx + 1}.</span>
                                                        <span className="font-black text-black">{q.title}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 border border-black/20 text-black font-bold">
                                                            {q.type}
                                                        </span>
                                                        {q.required && <span className="text-[10px] text-rose-500 font-black">*</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Template Action Bar */}
                                <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="text-xs font-bold text-neutral-600">
                                        <span className="font-black text-black block">Choose how to apply this template:</span>
                                        Replace wipes your current draft, while Append adds these sections below existing questions.
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleApplyTemplate(previewTemplate, "append")}
                                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black text-black cursor-pointer shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            Append to Form
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyTemplate(previewTemplate, "replace")}
                                            className="px-3.5 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] border-2 border-black text-xs font-black text-black cursor-pointer shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            Replace Entire Form
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Templates Grid */
                            <>
                                {/* Category Filter Pills */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {["All", "Hackathon", "Workshop", "Recruitment", "Competition", "Careers"].map(
                                        (cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setTemplateCategoryFilter(cat)}
                                                className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer transition-all border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 ${templateCategoryFilter === cat
                                                    ? "bg-black text-white"
                                                    : "bg-white text-black hover:bg-neutral-100"
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        )
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {ORBIX_FORM_TEMPLATES.filter(
                                            (t) =>
                                                templateCategoryFilter === "All" ||
                                                t.category.toLowerCase().includes(templateCategoryFilter.toLowerCase())
                                        ).map((tmpl) => {
                                            const totalQuestions = tmpl.structure.sections.reduce(
                                                (acc, s) => acc + s.questions.length,
                                                0
                                            );
                                            return (
                                                <div
                                                    key={tmpl.id}
                                                    className="p-4 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between space-y-3"
                                                >
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black">
                                                                {tmpl.category}
                                                            </span>
                                                            <span className="text-[11px] font-black text-black">
                                                                {tmpl.structure.sections.length} sec • {totalQuestions} Qs
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs sm:text-sm font-black text-black">{tmpl.title}</h4>
                                                        <p className="text-xs text-neutral-600 font-bold line-clamp-2">
                                                            {tmpl.description || tmpl.summary}
                                                        </p>
                                                    </div>

                                                    <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewTemplate(tmpl)}
                                                            className="text-xs font-black text-black hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                                            <span>Preview</span>
                                                        </button>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApplyTemplate(tmpl, "append")}
                                                                className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-[11px] font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                                title="Append sections to current form"
                                                            >
                                                                + Append
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApplyTemplate(tmpl, "replace")}
                                                                className="px-2.5 py-1 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] border-2 border-black text-[11px] font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                                title="Replace entire form with template"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* ---------------------------------------------------------------- */}
            {/* PHASE 6.3: AI-ASSISTED FORM CREATION MODAL */}
            {/* ---------------------------------------------------------------- */}
            {isAiModalOpen && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none">
                    <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">AI-Assisted Form Creation</h3>
                                    <p className="text-[11px] text-neutral-500 font-normal">
                                        Suggest customized questions based on your event description and campus tracks.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Prompt Input Form */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                                Describe your event or enter specific question requirements:
                            </label>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g. Generate a registration questionnaire for a 24-hour inter-college AI hackathon with hardware tracks, dietary requirements, GitHub links, and pitch deck uploads..."
                                rows={3}
                                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-normal text-neutral-900 dark:text-white bg-white dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 placeholder:text-neutral-400 resize-none transition-colors"
                            />

                            {/* Quick Starter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] font-semibold text-neutral-500">Quick Starters:</span>
                                {[
                                    "24-Hour AI Hackathon",
                                    "Web Dev Hands-on Workshop",
                                    "Core Club Recruitment",
                                    "Competitive Coding Contest",
                                    "Project Showcase & Pitch Deck",
                                ].map((starter) => (
                                    <button
                                        key={starter}
                                        type="button"
                                        onClick={() =>
                                            setAiPrompt(`Generate a comprehensive registration questionnaire for: ${starter}. Include screening questions, participant background, and requirements.`)
                                        }
                                        className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer transition-colors"
                                    >
                                        {starter}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Action Button */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="text-[11px] text-neutral-500 font-normal flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Questions are added to your draft only. You can edit them before publishing.</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateAiQuestions}
                                disabled={isAiGenerating || !aiPrompt.trim()}
                                className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
                            >
                                {isAiGenerating ? (
                                    <>
                                        <OrbixLoader size="xs" />
                                        <span>Synthesizing Questions...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-3.5 h-3.5" />
                                        <span>Generate Questions</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Generated Questions Checklist */}
                        {aiSuggestedQuestions.length > 0 && (
                            <div className="flex-1 overflow-y-auto space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 pr-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                                            Suggested Questions ({aiSuggestedQuestions.length}):
                                        </span>
                                        {aiEngineLabel && (
                                            <span className="px-2 py-0.2 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                                {aiEngineLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedAiIndices(
                                                    new Set(aiSuggestedQuestions.map((_, idx) => idx))
                                                )
                                            }
                                            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedAiIndices(new Set())}
                                            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Target Section Selector */}
                                {sections.length > 0 && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-medium">
                                        <span className="text-neutral-600 dark:text-neutral-400 shrink-0">Insert Into:</span>
                                        <NeoSelect
                                            value={aiTargetSectionId}
                                            onChange={(val) => setAiTargetSectionId(val)}
                                            size="sm"
                                            className="flex-1"
                                            options={sections.map((sec, idx) => ({
                                                value: sec.id,
                                                label: `Section ${idx + 1}: ${sec.title || "Untitled Section"}`
                                            }))}
                                        />
                                    </div>
                                )}

                                {/* Question Cards */}
                                <div className="space-y-2">
                                    {aiSuggestedQuestions.map((q, idx) => {
                                        const isSelected = selectedAiIndices.has(idx);
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => handleToggleSelectAiIndex(idx)}
                                                className={`p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-start gap-3 cursor-pointer transition-colors ${isSelected ? "bg-neutral-50 dark:bg-neutral-800/60" : "bg-white dark:bg-neutral-900 hover:bg-neutral-50"
                                                    }`}
                                            >
                                                <div className="pt-0.5 shrink-0">
                                                    {isSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-neutral-900 dark:text-white" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-neutral-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h5 className="text-xs font-semibold text-neutral-900 dark:text-white">{q.title}</h5>
                                                        <span className="px-2 py-0.2 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                                            {q.type.replace("_", " ")}
                                                        </span>
                                                        {q.required && (
                                                            <span className="text-[10px] font-semibold text-rose-500">
                                                                * Required
                                                            </span>
                                                        )}
                                                    </div>
                                                    {q.description && (
                                                        <p className="text-[11px] text-neutral-500 font-normal">
                                                            {q.description}
                                                        </p>
                                                    )}
                                                    {q.options && q.options.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                            {q.options.map((opt) => (
                                                                <span
                                                                    key={opt.id}
                                                                    className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-700 dark:text-neutral-300"
                                                                >
                                                                    {opt.text}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer Insertion Button */}
                        {aiSuggestedQuestions.length > 0 && (
                            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-neutral-500">
                                    {selectedAiIndices.size} of {aiSuggestedQuestions.length} selected
                                </span>
                                <button
                                    type="button"
                                    onClick={handleInsertAiQuestions}
                                    disabled={selectedAiIndices.size === 0}
                                    className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Insert Selected ({selectedAiIndices.size})</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
