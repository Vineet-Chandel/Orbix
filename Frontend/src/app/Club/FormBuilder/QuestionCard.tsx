import React, { useState } from "react";
import {
    Trash2,
    Copy,
    Image,
    MoreVertical,
    Plus,
    X,
    Check,
    CheckSquare,
    Radio,
    AlignLeft,
    Type,
    ListFilter,
    Sliders,
    UploadCloud,
    Grid3X3,
    Calendar,
    Clock,
    FileText,
    Star,
    Heart,
    ThumbsUp,
    Video,
    Heading,
    GripVertical,
    SlidersHorizontal,
    Lightbulb,
} from "lucide-react";
import { NeoToggle } from "../../../components/NeoToggle";
import { NeoSelect } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import {
    type FormQuestion,
    type FormQuestionType,
    type FormSection,
    requestFormMediaSignature,
    uploadFileToCloudinary,
} from "../../../api/clubEventFormApi";
import {
    getOptimizedCloudinaryUrl,
    getCloudinaryThumbnailUrl,
} from "../../../utils/cloudinaryDelivery";
import { useToast } from "../../../context/ToastContext";

export interface QuestionCardProps {
    question: FormQuestion;
    index: number;
    totalQuestions: number;
    sections: FormSection[];
    currentSectionId: string;
    accentColor: string;
    cardSurfaceColor?: string;
    cardShadowStyle?: "crisp" | "bold" | "soft";
    eventId: string;
    isActive: boolean;
    isQuiz?: boolean;
    defaultPoints?: number;
    onSelect: () => void;
    onChange: (updated: FormQuestion) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

const QUESTION_TYPE_CATEGORIES: {
    category: string;
    types: { value: FormQuestionType; label: string; icon: any }[];
}[] = [
    {
        category: "Standard Questions",
        types: [
            { value: "short_answer", label: "Short Answer", icon: Type },
            { value: "paragraph", label: "Paragraph", icon: AlignLeft },
            { value: "multiple_choice", label: "Multiple Choice", icon: Radio },
            { value: "checkboxes", label: "Checkboxes", icon: CheckSquare },
            { value: "dropdown", label: "Dropdown", icon: ListFilter },
            { value: "file_upload", label: "File Upload", icon: UploadCloud },
        ],
    },
    {
        category: "Rating & Scale",
        types: [
            { value: "linear_scale", label: "Linear Scale", icon: Sliders },
            { value: "rating", label: "Rating (Stars/Hearts)", icon: Star },
        ],
    },
    {
        category: "Grids & Dates",
        types: [
            { value: "multiple_choice_grid", label: "Multiple-Choice Grid", icon: Grid3X3 },
            { value: "checkbox_grid", label: "Checkbox Grid", icon: Grid3X3 },
            { value: "date", label: "Date", icon: Calendar },
            { value: "time", label: "Time / Duration", icon: Clock },
        ],
    },
    {
        category: "Content Blocks",
        types: [
            { value: "title_card", label: "Title & Description", icon: Heading },
            { value: "image_block", label: "Standalone Image", icon: Image },
            { value: "video_block", label: "YouTube Video", icon: Video },
            { value: "markdown_card", label: "Guide / Notice Card", icon: FileText },
        ],
    },
];

const QUESTION_TYPES = QUESTION_TYPE_CATEGORIES.flatMap((c) => c.types);

export const QuestionCard: React.FC<QuestionCardProps> = React.memo(({
    question,
    index: _index,
    totalQuestions: _totalQuestions,
    sections,
    currentSectionId: _currentSectionId,
    accentColor,
    cardSurfaceColor,
    cardShadowStyle: _cardShadowStyle,
    eventId,
    isActive,
    isQuiz = false,
    defaultPoints = 1,
    onSelect,
    onChange,
    onDelete,
    onDuplicate,
    onMoveUp: _onMoveUp,
    onMoveDown: _onMoveDown,
}) => {
    const toast = useToast();

    // Menu and conditional UI toggles
    const [showMenu, setShowMenu] = useState(false);
    const [showDescription, setShowDescription] = useState(Boolean(question.description));
    const [showValidation, setShowValidation] = useState(
        Boolean(
            question.validation?.minLength ||
                question.validation?.maxLength ||
                question.validation?.pattern ||
                question.validation?.minSelected ||
                question.validation?.maxSelected ||
                question.validation?.exactSelected ||
                question.validation?.numberType ||
                question.validation?.textValidationType
        )
    );
    const [showRouting, setShowRouting] = useState(
        Boolean(question.options?.some((o) => o.goToSectionId))
    );

    // Phase 3 Answer Key states
    const [isAnswerKeyMode, setIsAnswerKeyMode] = useState(false);
    const [newShortAnswerCorrect, setNewShortAnswerCorrect] = useState("");
    const [showAddFeedbackLink, setShowAddFeedbackLink] = useState(false);
    const [newFeedbackTitle, setNewFeedbackTitle] = useState("");
    const [newFeedbackUrl, setNewFeedbackUrl] = useState("");

    // Uploading states
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadingOptionIdx, setUploadingOptionIdx] = useState<number | null>(null);

    const isContentBlock =
        question.type === "title_card" ||
        question.type === "image_block" ||
        question.type === "video_block" ||
        question.type === "image_card" ||
        question.type === "markdown_card";

    // Handle Type Change
    const handleTypeChange = (newType: FormQuestionType) => {
        let updated: FormQuestion = {
            ...question,
            type: newType,
        };

        if (
            (newType === "multiple_choice" || newType === "checkboxes" || newType === "dropdown") &&
            (!updated.options || updated.options.length === 0)
        ) {
            updated.options = [
                { id: `opt_${Date.now()}_1`, text: "Option 1" },
                { id: `opt_${Date.now()}_2`, text: "Option 2" },
            ];
        } else if (newType === "linear_scale" && !updated.scaleConfig) {
            updated.scaleConfig = {
                min: 1,
                max: 5,
                minLabel: "Poor",
                maxLabel: "Excellent",
            };
        } else if (newType === "rating" && !updated.ratingConfig) {
            updated.ratingConfig = {
                icon: "star",
                levels: 5,
            };
        } else if ((newType === "multiple_choice_grid" || newType === "checkbox_grid") && !updated.gridConfig) {
            updated.gridConfig = {
                rows: ["Row 1", "Row 2"],
                columns: ["Column 1", "Column 2", "Column 3"],
                requireEachRow: false,
                limitOnePerColumn: false,
            };
        } else if (newType === "date" && !updated.dateConfig) {
            updated.dateConfig = {
                includeYear: true,
                includeTime: false,
            };
        } else if (newType === "time" && !updated.timeConfig) {
            updated.timeConfig = {
                mode: "time",
            };
        } else if (newType === "file_upload" && !updated.validation) {
            updated.validation = {
                allowedFileTypes: ["pdf", "image", "document", "zip"],
                maxFileSizeMb: 10,
                maxFiles: 1,
            };
        }

        onChange(updated);
    };

    // Question Image Upload
    const handleUploadQuestionImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploadingImage(true);
            const signatureConfig = await requestFormMediaSignature(eventId, "question", question.id);
            const result = await uploadFileToCloudinary(signatureConfig, file);
            onChange({
                ...question,
                imageUrl: result.secureUrl,
                imagePublicId: result.publicId,
            });
            toast.success("Image uploaded successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload image.");
        } finally {
            setIsUploadingImage(false);
            e.target.value = "";
        }
    };

    // Option Image Upload
    const handleUploadOptionImage = async (optIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingOptionIdx(optIdx);
            const signatureConfig = await requestFormMediaSignature(eventId, "question", `${question.id}_opt_${optIdx}`);
            const result = await uploadFileToCloudinary(signatureConfig, file);
            const newOptions = [...(question.options || [])];
            newOptions[optIdx] = {
                ...newOptions[optIdx],
                imageUrl: result.secureUrl,
                imagePublicId: result.publicId,
            };
            onChange({
                ...question,
                options: newOptions,
            });
            toast.success("Option image attached!");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload option image.");
        } finally {
            setUploadingOptionIdx(null);
            e.target.value = "";
        }
    };

    // Options Management
    const handleAddOption = () => {
        const newOptions = [...(question.options || [])];
        newOptions.push({
            id: `opt_${Date.now()}_${newOptions.length + 1}`,
            text: `Option ${newOptions.length + 1}`,
        });
        onChange({ ...question, options: newOptions });
    };

    const handleAddOtherOption = () => {
        const newOptions = [...(question.options || [])];
        if (newOptions.some((o) => o.isOther)) return;
        newOptions.push({
            id: `opt_other_${Date.now()}`,
            text: "Other...",
            isOther: true,
        });
        onChange({ ...question, options: newOptions });
    };

    const handleUpdateOption = (optIdx: number, text: string) => {
        const newOptions = [...(question.options || [])];
        newOptions[optIdx] = { ...newOptions[optIdx], text };
        onChange({ ...question, options: newOptions });
    };

    const handleRemoveOption = (optIdx: number) => {
        const newOptions = (question.options || []).filter((_, idx) => idx !== optIdx);
        onChange({ ...question, options: newOptions });
    };

    const handleOptionBranching = (optIdx: number, goToSectionId: string) => {
        const newOptions = [...(question.options || [])];
        newOptions[optIdx] = {
            ...newOptions[optIdx],
            goToSectionId: goToSectionId || undefined,
        };
        onChange({ ...question, options: newOptions });
    };

    // YouTube Embed Link Parser
    const extractYoutubeEmbedUrl = (rawUrl?: string): string | null => {
        if (!rawUrl) return null;
        try {
            const trimmed = rawUrl.trim();
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = trimmed.match(regExp);
            if (match && match[2].length === 11) {
                return `https://www.youtube.com/embed/${match[2]}`;
            }
            return trimmed.startsWith("http") ? trimmed : null;
        } catch {
            return null;
        }
    };

    return (
        <div
            onClick={onSelect}
            className={`group relative rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0A0A0A] border-2 sm:border-[3px] transition-all cursor-pointer ${
                isActive
                    ? "shadow-[5px_5px_0px_#000] ring-2 ring-black/20 dark:ring-white/20 translate-x-[-1px] translate-y-[-1px]"
                    : "shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]"
            }`}
            style={{
                borderColor: accentColor,
                backgroundColor: cardSurfaceColor || undefined,
            }}
        >
            {/* Active Left Indicator Bar */}
            {isActive && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl sm:rounded-l-3xl"
                    style={{ backgroundColor: accentColor }}
                />
            )}

            {/* Drag Handle at Top */}
            <div className="pt-2 pb-1 flex justify-center items-center text-neutral-400 hover:text-black dark:hover:text-white cursor-grab active:cursor-grabbing transition-colors">
                <GripVertical className="w-4 h-4 rotate-90 stroke-[2.5]" />
            </div>

            <div className="p-5 sm:p-6 sm:pl-7 space-y-4">
                {/* Header: Title / Prompt + Type Selector */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                        <input
                            type="text"
                            value={question.title}
                            onChange={(e) => onChange({ ...question, title: e.target.value })}
                            placeholder={isContentBlock ? "Section / Block Title..." : "Question Prompt..."}
                            className="w-full text-base sm:text-lg font-black text-neutral-900 dark:text-white border-b-2 border-transparent hover:border-black/20 focus:border-black dark:focus:border-white focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 transition-colors"
                        />
                        {showDescription && (
                            <textarea
                                value={question.description || ""}
                                onChange={(e) => onChange({ ...question, description: e.target.value })}
                                placeholder="Add helpful hints, instructions, or prerequisites..."
                                rows={2}
                                className="w-full text-xs font-normal text-neutral-600 dark:text-neutral-400 border-b border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 focus:border-neutral-900 dark:focus:border-white focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 resize-none transition-colors"
                            />
                        )}
                    </div>

                    {/* Question Type Selector Dropdown */}
                    <div className="shrink-0 flex items-center gap-2">
                        {/* Image attach icon button */}
                        <label
                            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-600 dark:text-neutral-400 shadow-sm transition-colors"
                            title="Attach Image"
                        >
                            <Image className="w-4 h-4" />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUploadQuestionImage}
                                className="hidden"
                                disabled={isUploadingImage}
                            />
                        </label>

                        <NeoSelect
                            value={question.type}
                            onChange={(val) => handleTypeChange(val as FormQuestionType)}
                            size="sm"
                            options={QUESTION_TYPES.map((t) => ({
                                value: t.value,
                                label: t.label,
                                icon: <t.icon className="w-3.5 h-3.5" />,
                            }))}
                            triggerClassName="text-xs font-semibold min-w-[150px]"
                        />
                    </div>
                </div>

                {/* Uploaded Question Image Preview */}
                {question.imageUrl && (
                    <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-900 max-w-md group/img">
                        <img
                            src={getOptimizedCloudinaryUrl(question.imageUrl, { width: 800, quality: "auto" })}
                            alt="Question Illustration"
                            loading="lazy"
                            className="w-full max-h-60 object-cover"
                        />
                        <button
                            type="button"
                            onClick={() => onChange({ ...question, imageUrl: null, imagePublicId: null })}
                            className="absolute top-2 right-2 p-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 text-rose-600 shadow-sm cursor-pointer hover:bg-rose-50"
                            title="Remove image"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* ------------------------------------------------------------------------- */}
                {/* CONFIGURATION BODY BY QUESTION TYPE OR ANSWER KEY MODE */}
                {/* ------------------------------------------------------------------------- */}
                {isAnswerKeyMode && !isContentBlock ? (
                    <div className="space-y-5 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                        {/* Answer Key Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                </span>
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Answer Key & Scoring</h4>
                                    <p className="text-[11px] text-neutral-500 font-medium">Select the correct answer and set points</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Points:</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={question.points ?? defaultPoints ?? 1}
                                    onChange={(e) => onChange({ ...question, points: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-16 text-center text-xs font-semibold border-b border-neutral-300 dark:border-neutral-700 bg-transparent focus:outline-none focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                                />
                            </div>
                        </div>

                        {/* Multiple Choice & Dropdown */}
                        {(question.type === "multiple_choice" || question.type === "dropdown") && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Choose the correct answer:</p>
                                <div className="space-y-1.5">
                                    {(question.options || []).map((opt) => {
                                        const isCorrect = (question.correctAnswers || []).includes(opt.text);
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => {
                                                    const next = isCorrect ? [] : [opt.text];
                                                    onChange({ ...question, correctAnswers: next });
                                                }}
                                                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                                    isCorrect
                                                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold shadow-sm"
                                                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 text-neutral-700 dark:text-neutral-300 font-medium"
                                                }`}
                                            >
                                                <span className="text-xs sm:text-sm">{opt.text}</span>
                                                {isCorrect && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        Correct
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Checkboxes */}
                        {question.type === "checkboxes" && (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Choose all correct answers:</p>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        <NeoToggle
                                            checked={Boolean(question.allowPartialCredit)}
                                            onChange={(checked) => onChange({ ...question, allowPartialCredit: checked })}
                                            size="sm"
                                        />
                                        <span>Allow partial credit</span>
                                    </label>
                                </div>
                                <div className="space-y-1.5">
                                    {(question.options || []).map((opt) => {
                                        const isCorrect = (question.correctAnswers || []).includes(opt.text);
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => {
                                                    const current = question.correctAnswers || [];
                                                    const next = isCorrect
                                                        ? current.filter((c) => c !== opt.text)
                                                        : [...current, opt.text];
                                                    onChange({ ...question, correctAnswers: next });
                                                }}
                                                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                                    isCorrect
                                                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold shadow-sm"
                                                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 text-neutral-700 dark:text-neutral-300 font-medium"
                                                }`}
                                            >
                                                <span className="text-xs sm:text-sm">{opt.text}</span>
                                                {isCorrect && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        Correct
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Short Answer */}
                        {question.type === "short_answer" && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Accepted correct answers (evaluated case-insensitively):</p>
                                <div className="space-y-2">
                                    {(question.correctAnswers || []).map((ans, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                            <span className="flex-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">{ans}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = (question.correctAnswers || []).filter((_, i) => i !== idx);
                                                    onChange({ ...question, correctAnswers: next });
                                                }}
                                                className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add acceptable correct answer..."
                                            value={newShortAnswerCorrect}
                                            onChange={(e) => setNewShortAnswerCorrect(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && newShortAnswerCorrect.trim()) {
                                                    e.preventDefault();
                                                    onChange({
                                                        ...question,
                                                        correctAnswers: [...(question.correctAnswers || []), newShortAnswerCorrect.trim()],
                                                    });
                                                    setNewShortAnswerCorrect("");
                                                }
                                            }}
                                            className="flex-1 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newShortAnswerCorrect.trim()) {
                                                    onChange({
                                                        ...question,
                                                        correctAnswers: [...(question.correctAnswers || []), newShortAnswerCorrect.trim()],
                                                    });
                                                    setNewShortAnswerCorrect("");
                                                }
                                            }}
                                            className="px-3.5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-xl cursor-pointer hover:bg-neutral-800 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other question types notice */}
                        {question.type !== "multiple_choice" &&
                            question.type !== "dropdown" &&
                            question.type !== "checkboxes" &&
                            question.type !== "short_answer" && (
                                <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1.5">
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span><strong>Manual evaluation:</strong> This question type does not support automated grading. Points will be assigned by organizers during review.</span>
                                </div>
                            )}

                        {/* Written Explanation / Feedback */}
                        <div className="space-y-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
                            <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                Answer Explanation (shown to student after grades are released)
                            </label>
                            <textarea
                                value={question.answerExplanation || ""}
                                onChange={(e) => onChange({ ...question, answerExplanation: e.target.value })}
                                placeholder="Explain why this answer is correct, provide learning tips or problem steps..."
                                rows={2}
                                className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                            />
                        </div>

                        {/* Feedback Resource Links */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Learning Resource Links</span>
                                <button
                                    type="button"
                                    onClick={() => setShowAddFeedbackLink((prev) => !prev)}
                                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                    + Add Link
                                </button>
                            </div>
                            {(question.feedbackLinks || []).map((link, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                                    <div>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">{link.title}</span>
                                        <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 truncate block max-w-xs">{link.url}</a>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = (question.feedbackLinks || []).filter((_, i) => i !== idx);
                                            onChange({ ...question, feedbackLinks: next });
                                        }}
                                        className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {showAddFeedbackLink && (
                                <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Link title (e.g. Documentation, Tutorial)"
                                        value={newFeedbackTitle}
                                        onChange={(e) => setNewFeedbackTitle(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium bg-transparent focus:outline-none focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                                    />
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={newFeedbackUrl}
                                        onChange={(e) => setNewFeedbackUrl(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium bg-transparent focus:outline-none focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddFeedbackLink(false)}
                                            className="px-2.5 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newFeedbackTitle.trim() && newFeedbackUrl.trim()) {
                                                    onChange({
                                                        ...question,
                                                        feedbackLinks: [
                                                            ...(question.feedbackLinks || []),
                                                            { title: newFeedbackTitle.trim(), url: newFeedbackUrl.trim() },
                                                        ],
                                                    });
                                                    setNewFeedbackTitle("");
                                                    setNewFeedbackUrl("");
                                                    setShowAddFeedbackLink(false);
                                                }
                                            }}
                                            className="px-3 py-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-lg cursor-pointer"
                                        >
                                            Add Link
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Done Button */}
                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsAnswerKeyMode(false)}
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                {/* 1. Short Answer */}
                {question.type === "short_answer" && (
                    <div className="space-y-3 pt-2">
                        <div className="p-3.5 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 bg-neutral-50/80 dark:bg-neutral-900/60 text-xs font-bold text-neutral-500">
                            Short-answer text (Single-line input)
                        </div>
                    </div>
                )}

                {/* 2. Paragraph */}
                {question.type === "paragraph" && (
                    <div className="space-y-3 pt-2">
                        <div className="p-4 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 bg-neutral-50/80 dark:bg-neutral-900/60 text-xs font-bold text-neutral-500">
                            Long-answer text (Multi-line paragraph input)
                        </div>
                    </div>
                )}

                {/* 3. Multiple Choice */}
                {question.type === "multiple_choice" && (
                    <div className="space-y-2.5 pt-2">
                        {(question.options || []).map((opt, optIdx) => (
                            <div key={opt.id} className="flex items-center gap-2 group/opt">
                                <div className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 shrink-0" />
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                                    placeholder={`Option ${optIdx + 1}`}
                                    disabled={opt.isOther}
                                    className={`flex-1 text-xs font-bold py-1 px-2 border-b border-black/20 focus:border-black focus:outline-none bg-transparent ${
                                        opt.isOther ? "italic text-neutral-500" : "text-black"
                                    }`}
                                />

                                {/* Option Image Preview */}
                                {opt.imageUrl && (
                                    <div className="relative shrink-0">
                                        <img
                                            src={getCloudinaryThumbnailUrl(opt.imageUrl, 100)}
                                            alt=""
                                            loading="lazy"
                                            className="w-7 h-7 rounded-lg border border-black object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newOpts = [...(question.options || [])];
                                                newOpts[optIdx] = { ...newOpts[optIdx], imageUrl: null, imagePublicId: null };
                                                onChange({ ...question, options: newOpts });
                                            }}
                                            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white border border-black text-rose-600"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                )}

                                {/* Attach image to option button */}
                                <label
                                    className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black cursor-pointer"
                                    title="Attach image to option"
                                >
                                    <Image className="w-3.5 h-3.5" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleUploadOptionImage(optIdx, e)}
                                        className="hidden"
                                        disabled={uploadingOptionIdx === optIdx}
                                    />
                                </label>

                                {/* Conditional Section Routing dropdown */}
                                {showRouting && (
                                    <NeoSelect
                                        value={opt.goToSectionId || "next_section"}
                                        onChange={(val) => handleOptionBranching(optIdx, val)}
                                        size="sm"
                                        triggerClassName="text-[11px] font-bold max-w-[170px]"
                                    >
                                        <option value="next_section">Continue to next section</option>
                                        <option value="submit_form">Submit form directly</option>
                                        {sections.map((sec, sIdx) => (
                                            <option key={sec.id} value={sec.id}>
                                                Go to section {sIdx + 1} ({sec.title || "Untitled"})
                                            </option>
                                        ))}
                                    </NeoSelect>
                                )}

                                {(question.options || []).length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(optIdx)}
                                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                                        title="Remove option"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="flex items-center gap-3 pt-2 text-xs font-black">
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="text-black hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Option</span>
                            </button>
                            {!(question.options || []).some((o) => o.isOther) && (
                                <>
                                    <span className="text-neutral-400">or</span>
                                    <button
                                        type="button"
                                        onClick={handleAddOtherOption}
                                        className="text-sky-700 hover:underline cursor-pointer"
                                    >
                                        Add "Other"
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Checkboxes */}
                {question.type === "checkboxes" && (
                    <div className="space-y-2.5 pt-2">
                        {(question.options || []).map((opt, optIdx) => (
                            <div key={opt.id} className="flex items-center gap-2 group/opt">
                                <div className="w-4 h-4 rounded border border-neutral-300 dark:border-neutral-600 shrink-0" />
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                                    placeholder={`Option ${optIdx + 1}`}
                                    disabled={opt.isOther}
                                    className={`flex-1 text-xs font-bold py-1 px-2 border-b border-black/20 focus:border-black focus:outline-none bg-transparent ${
                                        opt.isOther ? "italic text-neutral-500" : "text-black"
                                    }`}
                                />

                                {/* Option Image Preview */}
                                {opt.imageUrl && (
                                    <div className="relative shrink-0">
                                        <img
                                            src={getCloudinaryThumbnailUrl(opt.imageUrl, 100)}
                                            alt=""
                                            loading="lazy"
                                            className="w-7 h-7 rounded-lg border border-black object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newOpts = [...(question.options || [])];
                                                newOpts[optIdx] = { ...newOpts[optIdx], imageUrl: null, imagePublicId: null };
                                                onChange({ ...question, options: newOpts });
                                            }}
                                            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white border border-black text-rose-600"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                )}

                                <label
                                    className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-black cursor-pointer"
                                    title="Attach image to option"
                                >
                                    <Image className="w-3.5 h-3.5" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleUploadOptionImage(optIdx, e)}
                                        className="hidden"
                                        disabled={uploadingOptionIdx === optIdx}
                                    />
                                </label>

                                {(question.options || []).length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(optIdx)}
                                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="flex items-center gap-3 pt-2 text-xs font-black">
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="text-black hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Option</span>
                            </button>
                            {!(question.options || []).some((o) => o.isOther) && (
                                <>
                                    <span className="text-neutral-400">or</span>
                                    <button
                                        type="button"
                                        onClick={handleAddOtherOption}
                                        className="text-sky-700 hover:underline cursor-pointer"
                                    >
                                        Add "Other"
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. Dropdown */}
                {question.type === "dropdown" && (
                    <div className="space-y-2.5 pt-2">
                        {(question.options || []).map((opt, optIdx) => (
                            <div key={opt.id} className="flex items-center gap-2">
                                <span className="text-xs font-black text-neutral-400 w-5 text-right">{optIdx + 1}.</span>
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                                    placeholder={`Item ${optIdx + 1}`}
                                    className="flex-1 text-xs font-bold py-1 px-2 border-b border-black/20 focus:border-black focus:outline-none bg-transparent"
                                />

                                {showRouting && (
                                    <NeoSelect
                                        value={opt.goToSectionId || "next_section"}
                                        onChange={(val) => handleOptionBranching(optIdx, val)}
                                        size="sm"
                                        triggerClassName="text-[11px] font-bold max-w-[170px]"
                                    >
                                        <option value="next_section">Continue to next section</option>
                                        <option value="submit_form">Submit form directly</option>
                                        {sections.map((sec, sIdx) => (
                                            <option key={sec.id} value={sec.id}>
                                                Go to section {sIdx + 1} ({sec.title || "Untitled"})
                                            </option>
                                        ))}
                                    </NeoSelect>
                                )}

                                {(question.options || []).length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(optIdx)}
                                        className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="pt-2 text-xs font-black">
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="text-black hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Dropdown Item</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 6. File Upload */}
                {question.type === "file_upload" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black text-neutral-800">
                            <UploadCloud className="w-4 h-4 text-sky-600" />
                            <span>File Upload Configuration</span>
                        </div>

                        {/* Allowed File Types */}
                        <div className="space-y-2">
                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">Allowed File Formats:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {[
                                    { id: "pdf", label: "PDF Document" },
                                    { id: "image", label: "Images (JPG, PNG)" },
                                    { id: "document", label: "Word / DOCX / TXT" },
                                    { id: "spreadsheet", label: "Excel / Spreadsheet" },
                                    { id: "zip", label: "ZIP / Tarball Archive" },
                                ].map((type) => {
                                    const currentAllowed = question.validation?.allowedFileTypes || [];
                                    const isChecked = currentAllowed.includes(type.id as any);

                                    return (
                                        <NeoCheckbox
                                            key={type.id}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                                const updatedTypes = checked
                                                    ? [...currentAllowed, type.id as any]
                                                    : currentAllowed.filter((t) => t !== type.id);
                                                onChange({
                                                    ...question,
                                                    validation: {
                                                        ...question.validation,
                                                        allowedFileTypes: updatedTypes,
                                                    },
                                                });
                                            }}
                                            size="sm"
                                            label={type.label}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* File Size & Max Files Restrictions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                            <div>
                                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">Max File Size Limit:</label>
                                <NeoSelect
                                    value={question.validation?.maxFileSizeMb ?? 10}
                                    onChange={(val) =>
                                        onChange({
                                            ...question,
                                            validation: {
                                                ...question.validation,
                                                maxFileSizeMb: Number(val),
                                            },
                                        })
                                    }
                                    size="sm"
                                >
                                    <option value="1">1 MB</option>
                                    <option value="5">5 MB</option>
                                    <option value="10">10 MB (Recommended)</option>
                                    <option value="25">25 MB</option>
                                    <option value="50">50 MB</option>
                                    <option value="100">100 MB</option>
                                </NeoSelect>
                            </div>

                            <div>
                                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">Max Number of Files:</label>
                                <NeoSelect
                                    value={question.validation?.maxFiles ?? 1}
                                    onChange={(val) =>
                                        onChange({
                                            ...question,
                                            validation: {
                                                ...question.validation,
                                                maxFiles: Number(val),
                                            },
                                        })
                                    }
                                    size="sm"
                                >
                                    <option value="1">1 file</option>
                                    <option value="2">2 files</option>
                                    <option value="3">3 files</option>
                                    <option value="5">5 files</option>
                                </NeoSelect>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. Linear Scale */}
                {question.type === "linear_scale" && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 text-xs font-semibold">
                            <NeoSelect
                                value={question.scaleConfig?.min ?? 1}
                                onChange={(val) =>
                                    onChange({
                                        ...question,
                                        scaleConfig: {
                                            min: Number(val),
                                            max: question.scaleConfig?.max ?? 5,
                                            minLabel: question.scaleConfig?.minLabel,
                                            maxLabel: question.scaleConfig?.maxLabel,
                                        },
                                    })
                                }
                                size="sm"
                                triggerClassName="w-20"
                            >
                                <option value="0">0</option>
                                <option value="1">1</option>
                            </NeoSelect>
                            <span className="text-neutral-500">to</span>
                            <NeoSelect
                                value={question.scaleConfig?.max ?? 5}
                                onChange={(val) =>
                                    onChange({
                                        ...question,
                                        scaleConfig: {
                                            min: question.scaleConfig?.min ?? 1,
                                            max: Number(val),
                                            minLabel: question.scaleConfig?.minLabel,
                                            maxLabel: question.scaleConfig?.maxLabel,
                                        },
                                    })
                                }
                                size="sm"
                                triggerClassName="w-20"
                            >
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <option key={num} value={num}>
                                        {num}
                                    </option>
                                ))}
                            </NeoSelect>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="font-bold text-neutral-500 block mb-1">
                                    Label for {question.scaleConfig?.min ?? 1} (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={question.scaleConfig?.minLabel || ""}
                                    onChange={(e) =>
                                        onChange({
                                            ...question,
                                            scaleConfig: {
                                                min: question.scaleConfig?.min ?? 1,
                                                max: question.scaleConfig?.max ?? 5,
                                                minLabel: e.target.value,
                                                maxLabel: question.scaleConfig?.maxLabel,
                                            },
                                        })
                                    }
                                    placeholder="e.g. Strongly Disagree / Poor"
                                    className="w-full text-xs font-bold p-2 border border-black/30 rounded-xl focus:border-black focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-neutral-500 block mb-1">
                                    Label for {question.scaleConfig?.max ?? 5} (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={question.scaleConfig?.maxLabel || ""}
                                    onChange={(e) =>
                                        onChange({
                                            ...question,
                                            scaleConfig: {
                                                min: question.scaleConfig?.min ?? 1,
                                                max: question.scaleConfig?.max ?? 5,
                                                minLabel: question.scaleConfig?.minLabel,
                                                maxLabel: e.target.value,
                                            },
                                        })
                                    }
                                    placeholder="e.g. Strongly Agree / Excellent"
                                    className="w-full text-xs font-bold p-2 border border-black/30 rounded-xl focus:border-black focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 8. Rating (Stars, Hearts, Thumbs Up) */}
                {question.type === "rating" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-4">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-black">
                            <div className="flex items-center gap-2">
                                <span className="text-neutral-600">Rating Icon:</span>
                                <div className="flex items-center gap-1">
                                    {[
                                        { id: "star", icon: Star, label: "Stars" },
                                        { id: "heart", icon: Heart, label: "Hearts" },
                                        { id: "thumb", icon: ThumbsUp, label: "Thumbs" },
                                    ].map((style) => {
                                        const IconComp = style.icon;
                                        const isSelected = (question.ratingConfig?.icon || "star") === style.id;
                                        return (
                                            <button
                                                key={style.id}
                                                type="button"
                                                onClick={() =>
                                                    onChange({
                                                        ...question,
                                                        ratingConfig: {
                                                            icon: style.id as any,
                                                            levels: question.ratingConfig?.levels || 5,
                                                        },
                                                    })
                                                }
                                                className={`p-2 rounded-xl border flex items-center gap-1 cursor-pointer transition-all ${
                                                    isSelected
                                                        ? "border-neutral-900 dark:border-white bg-white dark:bg-neutral-800 shadow-sm"
                                                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 bg-transparent text-neutral-600 dark:text-neutral-400"
                                                }`}
                                            >
                                                <IconComp className="w-4 h-4 fill-amber-400 text-amber-500" />
                                                <span>{style.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-neutral-600 dark:text-neutral-400">Scale Levels:</span>
                                <NeoSelect
                                    value={question.ratingConfig?.levels || 5}
                                    onChange={(val) =>
                                        onChange({
                                            ...question,
                                            ratingConfig: {
                                                icon: question.ratingConfig?.icon || "star",
                                                levels: Number(val),
                                            },
                                        })
                                    }
                                    size="sm"
                                    triggerClassName="w-28 text-xs font-semibold"
                                >
                                    {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                        <option key={num} value={num}>
                                            {num} Levels
                                        </option>
                                    ))}
                                </NeoSelect>
                            </div>
                        </div>

                        {/* Visual rating scale preview */}
                        <div className="flex items-center gap-2 pt-2">
                            {Array.from({ length: question.ratingConfig?.levels || 5 }, (_, i) => i + 1).map((lvl) => {
                                const iconType = question.ratingConfig?.icon || "star";
                                const IconComp = iconType === "heart" ? Heart : iconType === "thumb" ? ThumbsUp : Star;
                                return (
                                    <div
                                        key={lvl}
                                        className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center bg-white dark:bg-neutral-900 shadow-sm"
                                    >
                                        <IconComp className="w-5 h-5 text-amber-500 fill-amber-400" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 9 & 10. Multiple Choice Grid & Checkbox Grid */}
                {(question.type === "multiple_choice_grid" || question.type === "checkbox_grid") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Rows */}
                        <div className="space-y-2 p-3 rounded-2xl border border-black/20 bg-neutral-50">
                            <span className="text-xs font-black text-black block">Rows (Items / Criteria)</span>
                            {(question.gridConfig?.rows || []).map((row, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-400 w-4">{rIdx + 1}.</span>
                                    <input
                                        type="text"
                                        value={row}
                                        onChange={(e) => {
                                            const newRows = [...(question.gridConfig?.rows || [])];
                                            newRows[rIdx] = e.target.value;
                                            onChange({
                                                ...question,
                                                gridConfig: {
                                                    ...question.gridConfig,
                                                    rows: newRows,
                                                    columns: question.gridConfig?.columns || [],
                                                },
                                            });
                                        }}
                                        className="flex-1 text-xs font-bold py-1 px-2 border-b border-black/20 focus:border-black focus:outline-none bg-white rounded"
                                    />
                                    {(question.gridConfig?.rows || []).length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newRows = (question.gridConfig?.rows || []).filter((_, idx) => idx !== rIdx);
                                                onChange({
                                                    ...question,
                                                    gridConfig: {
                                                        ...question.gridConfig,
                                                        rows: newRows,
                                                        columns: question.gridConfig?.columns || [],
                                                    },
                                                });
                                            }}
                                            className="text-neutral-400 hover:text-rose-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    const newRows = [...(question.gridConfig?.rows || [])];
                                    newRows.push(`Row ${newRows.length + 1}`);
                                    onChange({
                                        ...question,
                                        gridConfig: {
                                            ...question.gridConfig,
                                            rows: newRows,
                                            columns: question.gridConfig?.columns || [],
                                        },
                                    });
                                }}
                                className="text-xs font-black text-black hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Row</span>
                            </button>
                        </div>

                        {/* Columns */}
                        <div className="space-y-2 p-3 rounded-2xl border border-black/20 bg-neutral-50">
                            <span className="text-xs font-black text-black block">Columns (Rating / Choices)</span>
                            {(question.gridConfig?.columns || []).map((col, cIdx) => (
                                <div key={cIdx} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-400 w-4">{cIdx + 1}.</span>
                                    <input
                                        type="text"
                                        value={col}
                                        onChange={(e) => {
                                            const newCols = [...(question.gridConfig?.columns || [])];
                                            newCols[cIdx] = e.target.value;
                                            onChange({
                                                ...question,
                                                gridConfig: {
                                                    ...question.gridConfig,
                                                    rows: question.gridConfig?.rows || [],
                                                    columns: newCols,
                                                },
                                            });
                                        }}
                                        className="flex-1 text-xs font-bold py-1 px-2 border-b border-black/20 focus:border-black focus:outline-none bg-white rounded"
                                    />
                                    {(question.gridConfig?.columns || []).length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newCols = (question.gridConfig?.columns || []).filter((_, idx) => idx !== cIdx);
                                                onChange({
                                                    ...question,
                                                    gridConfig: {
                                                        ...question.gridConfig,
                                                        rows: question.gridConfig?.rows || [],
                                                        columns: newCols,
                                                    },
                                                });
                                            }}
                                            className="text-neutral-400 hover:text-rose-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    const newCols = [...(question.gridConfig?.columns || [])];
                                    newCols.push(`Column ${newCols.length + 1}`);
                                    onChange({
                                        ...question,
                                        gridConfig: {
                                            ...question.gridConfig,
                                            rows: question.gridConfig?.rows || [],
                                            columns: newCols,
                                        },
                                    });
                                }}
                                className="text-xs font-black text-black hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Column</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 11. Date */}
                {question.type === "date" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-neutral-800">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            <span>Date Selection Configuration</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-neutral-700">
                            <NeoCheckbox
                                checked={question.dateConfig?.includeYear ?? true}
                                onCheckedChange={(checked) =>
                                    onChange({
                                        ...question,
                                        dateConfig: {
                                            includeYear: checked,
                                            includeTime: question.dateConfig?.includeTime ?? false,
                                        },
                                    })
                                }
                                label="Include Year (YYYY-MM-DD)"
                                size="sm"
                            />
                            <NeoCheckbox
                                checked={question.dateConfig?.includeTime ?? false}
                                onCheckedChange={(checked) =>
                                    onChange({
                                        ...question,
                                        dateConfig: {
                                            includeYear: question.dateConfig?.includeYear ?? true,
                                            includeTime: checked,
                                        },
                                    })
                                }
                                label="Include Time (hh:mm)"
                                size="sm"
                            />
                        </div>
                    </div>
                )}

                {/* 12. Time / Duration */}
                {question.type === "time" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-neutral-800">
                            <Clock className="w-4 h-4 text-purple-600" />
                            <span>Time Mode Selection</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-black">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name={`time_mode_${question.id}`}
                                    checked={(question.timeConfig?.mode || "time") === "time"}
                                    onChange={() => onChange({ ...question, timeConfig: { mode: "time" } })}
                                    className="accent-black"
                                />
                                <span>Time of day (e.g. 02:30 PM)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name={`time_mode_${question.id}`}
                                    checked={question.timeConfig?.mode === "duration"}
                                    onChange={() => onChange({ ...question, timeConfig: { mode: "duration" } })}
                                    className="accent-black"
                                />
                                <span>Duration (Hours, minutes, seconds)</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Content Block: Standalone Image */}
                {question.type === "image_block" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-neutral-700">Image Alignment:</span>
                            <div className="flex items-center gap-1 text-xs font-black">
                                {(["left", "center", "right"] as const).map((align) => (
                                    <button
                                        key={align}
                                        type="button"
                                        onClick={() => onChange({ ...question, imageAlignment: align })}
                                        className={`px-2.5 py-1 rounded-lg border capitalize cursor-pointer ${
                                            (question.imageAlignment || "center") === align
                                                ? "bg-black text-white border-black"
                                                : "bg-white border-black/30 hover:bg-neutral-100 text-black"
                                        }`}
                                    >
                                        {align}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            value={question.imageCaption || ""}
                            onChange={(e) => onChange({ ...question, imageCaption: e.target.value })}
                            placeholder="Add optional image caption..."
                            className="w-full text-xs font-bold p-2 border border-black/20 rounded-xl bg-white"
                        />
                    </div>
                )}

                {/* Content Block: YouTube Video */}
                {question.type === "video_block" && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-black/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-neutral-800">
                            <Video className="w-4 h-4 text-rose-600" />
                            <span>Embed YouTube Video</span>
                        </div>
                        <input
                            type="text"
                            value={question.videoUrl || ""}
                            onChange={(e) => onChange({ ...question, videoUrl: e.target.value })}
                            placeholder="Paste YouTube video link (e.g. https://www.youtube.com/watch?v=...)"
                            className="w-full text-xs font-bold p-2.5 border border-black/30 rounded-xl bg-white focus:outline-none"
                        />
                        {extractYoutubeEmbedUrl(question.videoUrl) && (
                            <div className="aspect-video w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 max-w-md shadow-sm">
                                <iframe
                                    src={extractYoutubeEmbedUrl(question.videoUrl)!}
                                    title="YouTube Video Preview"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full h-full border-0"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Content Block: Markdown / Guide */}
                {(question.type === "title_card" || question.type === "markdown_card") && (
                    <div className="space-y-2 pt-1">
                        <textarea
                            value={question.content || ""}
                            onChange={(e) => onChange({ ...question, content: e.target.value })}
                            placeholder="Enter rich details, announcement text, guidelines, or Markdown content..."
                            rows={3}
                            className="w-full text-xs font-medium text-neutral-700 border border-black/20 focus:border-black focus:outline-none bg-white p-2.5 rounded-xl resize-none"
                        />
                    </div>
                )}

                {/* ------------------------------------------------------------------------- */}
                {/* RESPONSE VALIDATION DRAWER (Inline expandable) */}
                {/* ------------------------------------------------------------------------- */}
                {showValidation && (
                    <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-dashed border-amber-300 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Response Validation Rules</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowValidation(false);
                                    onChange({ ...question, validation: undefined });
                                }}
                                className="text-[11px] font-black text-neutral-500 hover:text-black cursor-pointer"
                            >
                                Remove validation
                            </button>
                        </div>

                        {/* Number Validation for Short Answer */}
                        {question.type === "short_answer" && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <NeoSelect
                                    value={question.validation?.numberType || "greater_than"}
                                    onChange={(val) =>
                                        onChange({
                                            ...question,
                                            validation: {
                                                ...question.validation,
                                                numberType: val as any,
                                            },
                                        })
                                    }
                                    size="sm"
                                >
                                    <option value="greater_than">Greater than</option>
                                    <option value="greater_or_equal">Greater than or equal to</option>
                                    <option value="less_than">Less than</option>
                                    <option value="less_or_equal">Less than or equal to</option>
                                    <option value="equal">Equal to</option>
                                    <option value="between">Between</option>
                                    <option value="is_number">Is number</option>
                                    <option value="whole_number">Whole number</option>
                                </NeoSelect>
                                <input
                                    type="number"
                                    value={question.validation?.numberValue ?? ""}
                                    onChange={(e) =>
                                        onChange({
                                            ...question,
                                            validation: {
                                                ...question.validation,
                                                numberValue: e.target.value ? Number(e.target.value) : undefined,
                                            },
                                        })
                                    }
                                    placeholder="Threshold value..."
                                    className="border border-black rounded-xl p-2 bg-white font-bold"
                                />
                                <input
                                    type="text"
                                    value={question.validation?.patternError || ""}
                                    onChange={(e) =>
                                        onChange({
                                            ...question,
                                            validation: {
                                                ...question.validation,
                                                patternError: e.target.value,
                                            },
                                        })
                                    }
                                    placeholder="Custom error message..."
                                    className="border border-black rounded-xl p-2 bg-white font-bold"
                                />
                            </div>
                        )}

                        {/* Length & Regex Validation for Paragraph / Short Answer */}
                        {(question.type === "paragraph" || question.type === "short_answer") && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Min Characters</label>
                                    <input
                                        type="number"
                                        value={question.validation?.minLength ?? ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    minLength: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })
                                        }
                                        placeholder="e.g. 10"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Max Characters</label>
                                    <input
                                        type="number"
                                        value={question.validation?.maxLength ?? ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    maxLength: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })
                                        }
                                        placeholder="e.g. 500"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Regex Pattern</label>
                                    <input
                                        type="text"
                                        value={question.validation?.pattern || ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    pattern: e.target.value,
                                                },
                                            })
                                        }
                                        placeholder="^[A-Z0-9]+$"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold font-mono text-[11px]"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Checkbox Selection Limits */}
                        {question.type === "checkboxes" && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Select at least</label>
                                    <input
                                        type="number"
                                        value={question.validation?.minSelected ?? ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    minSelected: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })
                                        }
                                        placeholder="Min selections"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Select at most</label>
                                    <input
                                        type="number"
                                        value={question.validation?.maxSelected ?? ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    maxSelected: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })
                                        }
                                        placeholder="Max selections"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Select exactly</label>
                                    <input
                                        type="number"
                                        value={question.validation?.exactSelected ?? ""}
                                        onChange={(e) =>
                                            onChange({
                                                ...question,
                                                validation: {
                                                    ...question.validation,
                                                    exactSelected: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })
                                        }
                                        placeholder="Exact selections"
                                        className="w-full border border-black rounded-xl p-2 bg-white font-bold"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                </>
            )}

                {/* ------------------------------------------------------------------------- */}
                {/* BOTTOM TOOLBAR */}
                {/* ------------------------------------------------------------------------- */}
                <div className="pt-3 border-t-2 border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        {/* Quiz Answer Key Trigger Button */}
                        {isQuiz && !isContentBlock && (
                            <div className="flex items-center gap-2 mr-1">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAnswerKeyMode((prev) => !prev);
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                                        isAnswerKeyMode
                                            ? "bg-emerald-600 text-white border-emerald-700"
                                            : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                    }`}
                                    title="Configure correct answers and scoring"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>
                                        Answer key ({question.points ?? defaultPoints ?? 1} pt
                                        {(question.points ?? defaultPoints ?? 1) === 1 ? "" : "s"})
                                    </span>
                                </button>
                                {question.correctAnswers && question.correctAnswers.length > 0 && !isAnswerKeyMode && (
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                        <Check className="w-3 h-3" />
                                        {question.correctAnswers.length} set
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Duplicate Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicate();
                            }}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                            title="Duplicate question"
                        >
                            <Copy className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                            title="Delete question"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Required Toggle (Not applicable for standalone notice blocks) */}
                        {!isContentBlock && (
                            <div className="flex items-center gap-2 pr-3 border-r-2 border-black/10 dark:border-white/10">
                                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Required</span>
                                <NeoToggle
                                    checked={question.required}
                                    onChange={(checked) => onChange({ ...question, required: checked })}
                                    size="sm"
                                />
                            </div>
                        )}

                        {/* More Options Dropdown (...) */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu((prev) => !prev);
                                }}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 cursor-pointer transition-colors"
                                title="More options"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>

                            {showMenu && (
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg p-1.5 z-30 text-xs font-medium space-y-0.5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDescription((prev) => !prev);
                                            setShowMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer transition-colors text-neutral-800 dark:text-neutral-200"
                                    >
                                        <span>Description</span>
                                        {showDescription && <Check className="w-4 h-4 text-emerald-600" />}
                                    </button>

                                    {!isContentBlock && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowValidation((prev) => !prev);
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer transition-colors text-neutral-800 dark:text-neutral-200"
                                        >
                                            <span>Response validation</span>
                                            {showValidation && <Check className="w-4 h-4 text-emerald-600" />}
                                        </button>
                                    )}

                                    {(question.type === "multiple_choice" || question.type === "dropdown") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowRouting((prev) => !prev);
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer transition-colors text-neutral-800 dark:text-neutral-200"
                                        >
                                            <span>Go to section based on answer</span>
                                            {showRouting && <Check className="w-4 h-4 text-emerald-600" />}
                                        </button>
                                    )}

                                    {(question.type === "multiple_choice" || question.type === "checkboxes") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange({ ...question, shuffleOptions: !question.shuffleOptions });
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer transition-colors text-neutral-800 dark:text-neutral-200"
                                        >
                                            <span>Shuffle option order</span>
                                            {question.shuffleOptions && <Check className="w-4 h-4 text-emerald-600" />}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
