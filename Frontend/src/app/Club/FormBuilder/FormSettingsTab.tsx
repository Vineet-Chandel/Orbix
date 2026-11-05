import React, { useState } from "react";
import {
    Award,
    Mail,
    Sliders,
    Eye,
    Clock,
    Users,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Bookmark,
    Shield,
    Calendar,
    Settings,
    FileCheck,
    AlertTriangle,
} from "lucide-react";
import { NeoToggle } from "../../../components/NeoToggle";
import type { ClubEventFormRecord, FormSettings } from "../../../api/clubEventFormApi";
import { useToast } from "../../../context/ToastContext";

export interface FormSettingsTabProps {
    form: ClubEventFormRecord;
    event?: any;
    accentColor: string;
    onUpdateSettings: (newSettings: FormSettings) => void;
}

export const FormSettingsTab: React.FC<FormSettingsTabProps> = ({
    form,
    event,
    accentColor,
    onUpdateSettings,
}) => {
    const toast = useToast();

    // Accordion state (Google Forms expandable sections)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        quiz: true,
        responses: true,
        presentation: false,
        defaults: false,
    });

    const toggleSection = (key: string) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const s = form.settings;

    // Helper to deeply merge updates and sync top-level flat compatibility fields
    const updateSettings = (partial: Partial<FormSettings>) => {
        const merged: FormSettings = {
            ...s,
            ...partial,
            // Ensure nested models exist
            quiz: {
                isQuiz: false,
                releaseGrades: "immediately",
                showMissedQuestions: true,
                showCorrectAnswers: true,
                showPointValues: true,
                defaultPointsPerQuestion: 1,
                ...s.quiz,
                ...partial.quiz,
            },
            responses: {
                collectOrbixIdentity: true,
                collectVerifiedEmail: true,
                allowAdditionalEmail: false,
                useStudentProfile: true,
                limitOneResponse: true,
                allowEditResponse: false,
                requireLogin: true,
                sendConfirmationEmail: true,
                responseReceipts: "when_requested",
                notifyAdminsOnSubmission: true,
                isOpen: true,
                closedMessage: "Registrations are currently closed for this event.",
                maxResponses: null,
                autoCloseOnLimit: true,
                ...s.responses,
                ...partial.responses,
            },
            presentation: {
                showProgressBar: true,
                shuffleQuestionOrder: false,
                shuffleOptionOrder: false,
                confirmationMessage: "Thank you! Your registration has been submitted successfully.",
                showSubmitAnotherLink: false,
                autosaveProgress: true,
                disableAutosave: false,
                viewResultsSummary: false,
                ...s.presentation,
                ...partial.presentation,
            },
            questionDefaults: {
                defaultRequired: false,
                defaultValidation: false,
                defaultPointValue: 1,
                ...s.questionDefaults,
                ...partial.questionDefaults,
            },
        };

        // Sync legacy/flat fields
        if (partial.responses?.isOpen !== undefined) merged.isOpen = partial.responses.isOpen;
        if (partial.responses?.closedMessage !== undefined) merged.closedMessage = partial.responses.closedMessage;
        if (partial.responses?.maxResponses !== undefined) merged.maxResponses = partial.responses.maxResponses;
        if (partial.responses?.limitOneResponse !== undefined) merged.limitOneResponse = partial.responses.limitOneResponse;
        if (partial.responses?.allowEditResponse !== undefined) merged.allowEditResponse = partial.responses.allowEditResponse;
        if (partial.responses?.requireLogin !== undefined) merged.requireLogin = partial.responses.requireLogin;
        if (partial.responses?.notifyAdminsOnSubmission !== undefined) merged.notifyOnRegistration = partial.responses.notifyAdminsOnSubmission;
        if (partial.presentation?.showProgressBar !== undefined) merged.showProgressBar = partial.presentation.showProgressBar;
        if (partial.presentation?.confirmationMessage !== undefined) merged.confirmationMessage = partial.presentation.confirmationMessage;

        onUpdateSettings(merged);
    };

    const handleSaveClubDefaults = () => {
        toast.success("Current settings saved as default template for new club event forms!");
    };

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-16">
            {/* Page Header Notice */}
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                <Settings className="w-5 h-5 text-amber-700 shrink-0" />
                <div className="text-xs font-bold text-amber-900">
                    Settings configured here apply to registrations, quiz grading, respondent visibility, and event availability.
                </div>
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 1: QUIZ SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                {/* Header with Master Switch */}
                <div className="p-5 sm:p-6 bg-neutral-50 border-b-2 border-black flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-[#A3E635] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Award className="w-5 h-5 text-black" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">Make this a quiz</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Assign point values, set answer keys, and automatically grade student submissions.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <NeoToggle
                            checked={Boolean(s.quiz?.isQuiz)}
                            onChange={(val) => {
                                updateSettings({
                                    quiz: { ...s.quiz, isQuiz: val },
                                });
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => toggleSection("quiz")}
                            className="p-1 rounded-xl text-neutral-500 hover:text-black cursor-pointer"
                        >
                            {openSections.quiz ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Expanded Quiz Options */}
                {s.quiz?.isQuiz && openSections.quiz && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y-2 divide-black/10">
                        {/* 1. Release Grades */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Release Grades
                            </span>
                            <div className="space-y-2.5">
                                <label className="flex items-start gap-3 p-3 rounded-2xl border-2 border-black cursor-pointer transition-all hover:bg-neutral-50 bg-white">
                                    <input
                                        type="radio"
                                        name="releaseGrades"
                                        checked={s.quiz?.releaseGrades !== "after_review"}
                                        onChange={() =>
                                            updateSettings({
                                                quiz: { ...s.quiz, releaseGrades: "immediately" },
                                            })
                                        }
                                        className="mt-0.5 accent-black"
                                    />
                                    <div>
                                        <span className="text-xs sm:text-sm font-black text-black block">
                                            Immediately after each submission
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-medium block">
                                            Respondents instantly see their calculated score upon submitting the form.
                                        </span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 rounded-2xl border-2 border-black cursor-pointer transition-all hover:bg-neutral-50 bg-white">
                                    <input
                                        type="radio"
                                        name="releaseGrades"
                                        checked={s.quiz?.releaseGrades === "after_review"}
                                        onChange={() =>
                                            updateSettings({
                                                quiz: { ...s.quiz, releaseGrades: "after_review" },
                                            })
                                        }
                                        className="mt-0.5 accent-black"
                                    />
                                    <div>
                                        <span className="text-xs sm:text-sm font-black text-black block">
                                            Later, after manual review
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-medium block">
                                            Club staff can review text questions, adjust scores, and release grades from the Responses tab.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 2. Respondent Settings */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Respondent Settings
                            </span>

                            {/* Missed questions toggle */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Missed questions
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Respondents can see which questions were answered incorrectly.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.quiz?.showMissedQuestions ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            quiz: { ...s.quiz, showMissedQuestions: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Correct answers toggle */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Correct answers
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Respondents can see correct answers after grades are released.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.quiz?.showCorrectAnswers ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            quiz: { ...s.quiz, showCorrectAnswers: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Point values toggle */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Point values
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Respondents can see total points and points received for each question.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.quiz?.showPointValues ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            quiz: { ...s.quiz, showPointValues: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* 3. Default question points */}
                        <div className="pt-5 flex items-center justify-between gap-4">
                            <div>
                                <span className="text-xs sm:text-sm font-black text-black block">
                                    Default question point value
                                </span>
                                <span className="text-[11px] text-neutral-500 font-medium">
                                    Points automatically assigned to newly added questions.
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                max="1000"
                                value={s.quiz?.defaultPointsPerQuestion ?? 1}
                                onChange={(e) =>
                                    updateSettings({
                                        quiz: {
                                            ...s.quiz,
                                            defaultPointsPerQuestion: Math.max(0, parseInt(e.target.value) || 0),
                                        },
                                        questionDefaults: {
                                            ...s.questionDefaults,
                                            defaultPointValue: Math.max(0, parseInt(e.target.value) || 0),
                                        },
                                    })
                                }
                                className="w-20 p-2 rounded-xl border-2 border-black text-center text-xs font-black bg-white focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 2: RESPONSES SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("responses")}
                    className="p-5 sm:p-6 bg-neutral-50 border-b-2 border-black flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-[#38BDF8] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Mail className="w-5 h-5 text-black" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">Responses</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Manage identity collection, participant limits, response editing, and receipts.
                            </p>
                        </div>
                    </div>
                    {openSections.responses ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>

                {openSections.responses && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y-2 divide-black/10">
                        {/* 1. Identity Collection */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Identity & Account Collection
                            </span>

                            {/* Collect Orbix Identity */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Collect verified Orbix account & student email
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Automatically links registration to the student's campus profile.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.collectOrbixIdentity ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            responses: { ...s.responses, collectOrbixIdentity: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Use existing student profile information */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Pre-fill profile information
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Pre-populates verified student name, college, roll number, and department.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.useStudentProfile ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            responses: { ...s.responses, useStudentProfile: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* 2. Submission Control */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Submission Control
                            </span>

                            {/* Limit to 1 response */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Limit to 1 response per student
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Requires login and enforces single entry per student account.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.limitOneResponse ?? s.limitOneResponse ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            limitOneResponse: val,
                                            responses: { ...s.responses, limitOneResponse: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Allow response editing */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Allow response editing
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Students can revisit and modify their answers after submission.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.allowEditResponse ?? s.allowEditResponse ?? false}
                                    onChange={(val) =>
                                        updateSettings({
                                            allowEditResponse: val,
                                            responses: { ...s.responses, allowEditResponse: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Require Orbix login */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Require Orbix student login
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Prevents anonymous submissions and validates campus credentials.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.requireLogin ?? s.requireLogin ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            requireLogin: val,
                                            responses: { ...s.responses, requireLogin: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Campus Eligibility Notice */}
                            <div className="p-3 bg-neutral-100 rounded-xl border border-black/20 flex items-center gap-2.5 text-xs text-neutral-700 font-medium">
                                <Shield className="w-4 h-4 text-neutral-600 shrink-0" />
                                <span>
                                    <strong>Campus Eligibility:</strong> Synchronized with Event settings (
                                    {event?.eligibility === "college_only" ? "Restricted to host college students" : "Open to all verified students"}
                                    ).
                                </span>
                            </div>
                        </div>

                        {/* 3. Response Receipts & Notifications */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Response Receipts & Notifications
                            </span>

                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Send registration confirmation email
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Emails confirmation and registration ticket code to the respondent.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.sendConfirmationEmail ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            responses: { ...s.responses, sendConfirmationEmail: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Notify club administrators on new submissions
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Sends notification to club team members when a student completes registration.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.notifyAdminsOnSubmission ?? s.notifyOnRegistration ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            notifyOnRegistration: val,
                                            responses: { ...s.responses, notifyAdminsOnSubmission: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* 4. Response Availability & Closing */}
                        <div className="space-y-4 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Response Availability & Deadlines
                            </span>

                            {/* Accepting Responses Master Toggle */}
                            <div className="p-4 rounded-2xl border-2 border-black bg-neutral-50 flex items-center justify-between gap-4 shadow-[2px_2px_0px_#000]">
                                <div>
                                    <span className="font-black text-sm text-black block">Accepting Responses</span>
                                    <span className="text-xs text-neutral-500 font-medium">
                                        When turned off, respondents see the custom closed message.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.responses?.isOpen ?? s.isOpen ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            isOpen: val,
                                            responses: { ...s.responses, isOpen: val },
                                        })
                                    }
                                />
                            </div>

                            {/* Scheduled Closing Date & Time */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black">
                                    Scheduled Closing Date & Time (Optional)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="datetime-local"
                                        value={s.responses?.closingDateTime || ""}
                                        onChange={(e) =>
                                            updateSettings({
                                                responses: {
                                                    ...s.responses,
                                                    closingDateTime: e.target.value || null,
                                                },
                                            })
                                        }
                                        className="w-full border-2 border-black rounded-xl p-2.5 text-xs sm:text-sm font-bold bg-white focus:outline-none"
                                    />
                                    {s.responses?.closingDateTime && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateSettings({
                                                    responses: { ...s.responses, closingDateTime: null },
                                                })
                                            }
                                            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl text-xs font-black cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <span className="text-[11px] text-neutral-500 font-medium block">
                                    Forms will automatically stop accepting responses past this date.
                                </span>
                            </div>

                            {/* Maximum Responses Cap */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black">
                                    Maximum Response Capacity Limit
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={s.responses?.maxResponses ?? s.maxResponses ?? ""}
                                    onChange={(e) =>
                                        updateSettings({
                                            maxResponses: e.target.value ? Number(e.target.value) : null,
                                            responses: {
                                                ...s.responses,
                                                maxResponses: e.target.value ? Number(e.target.value) : null,
                                            },
                                        })
                                    }
                                    placeholder="Leave empty for unlimited participants"
                                    className="w-full border-2 border-black rounded-xl p-2.5 text-xs sm:text-sm font-bold bg-white focus:outline-none"
                                />
                                <span className="text-[11px] text-neutral-500 font-medium block">
                                    {event?.capacity
                                        ? `Event seat limit is currently set to ${event.capacity} in event settings.`
                                        : "Leave blank to accept registrations up to total event capacity."}
                                </span>
                            </div>

                            {/* Custom Closed Form Message */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black">
                                    Message for Respondents when Form is Closed
                                </label>
                                <textarea
                                    value={s.responses?.closedMessage || s.closedMessage || ""}
                                    onChange={(e) =>
                                        updateSettings({
                                            closedMessage: e.target.value,
                                            responses: { ...s.responses, closedMessage: e.target.value },
                                        })
                                    }
                                    placeholder="Registrations are currently closed for this event."
                                    rows={2}
                                    className="w-full border-2 border-black rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none bg-white"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 3: PRESENTATION SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("presentation")}
                    className="p-5 sm:p-6 bg-neutral-50 border-b-2 border-black flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-[#C084FC] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Sliders className="w-5 h-5 text-black" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">Presentation</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Configure progress indicator, shuffling, confirmation messages, and autosave.
                            </p>
                        </div>
                    </div>
                    {openSections.presentation ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>

                {openSections.presentation && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y-2 divide-black/10">
                        {/* 1. Form Presentation */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Form Layout & Ordering
                            </span>

                            {/* Progress bar */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Show progress bar
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Display step and page indicators on multi-section registration forms.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.presentation?.showProgressBar ?? s.showProgressBar ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            showProgressBar: val,
                                            presentation: { ...s.presentation, showProgressBar: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Shuffle question order */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Shuffle question order
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Randomizes question sequence for each respondent (ideal for quizzes).
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={Boolean(s.presentation?.shuffleQuestionOrder)}
                                    onChange={(val) =>
                                        updateSettings({
                                            presentation: { ...s.presentation, shuffleQuestionOrder: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* Shuffle answer options */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Shuffle answer options globally
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Randomizes multiple-choice and checkbox choices for all questions.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={Boolean(s.presentation?.shuffleOptionOrder)}
                                    onChange={(val) =>
                                        updateSettings({
                                            presentation: { ...s.presentation, shuffleOptionOrder: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* 2. Post-Submission Experience */}
                        <div className="space-y-4 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                After Submission
                            </span>

                            {/* Confirmation message */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-black">
                                    Confirmation Message
                                </label>
                                <textarea
                                    value={s.presentation?.confirmationMessage || s.confirmationMessage || ""}
                                    onChange={(e) =>
                                        updateSettings({
                                            confirmationMessage: e.target.value,
                                            presentation: { ...s.presentation, confirmationMessage: e.target.value },
                                        })
                                    }
                                    placeholder="Thank you! Your registration has been submitted successfully."
                                    rows={3}
                                    className="w-full border-2 border-black rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none bg-white"
                                />
                            </div>

                            {/* Submit another response link */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Show link to submit another response
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Applicable when multiple responses per student are permitted.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={Boolean(s.presentation?.showSubmitAnotherLink)}
                                    onChange={(val) =>
                                        updateSettings({
                                            presentation: { ...s.presentation, showSubmitAnotherLink: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            {/* View results summary toggle with privacy note */}
                            <div className="p-4 rounded-2xl border-2 border-black bg-neutral-50 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-xs sm:text-sm font-black text-black block">
                                            View results summary
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-medium">
                                            Allow respondents to view aggregate charts after submitting.
                                        </span>
                                    </div>
                                    <NeoToggle
                                        checked={Boolean(s.presentation?.viewResultsSummary)}
                                        onChange={(val) =>
                                            updateSettings({
                                                presentation: { ...s.presentation, viewResultsSummary: val },
                                            })
                                        }
                                        size="sm"
                                    />
                                </div>
                                <div className="p-2.5 rounded-xl bg-white border border-black/20 text-[11px] text-neutral-600 font-medium flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>
                                        <strong>Privacy Guard Active:</strong> Individual answers, personal identification, and files of other students are never exposed to respondents.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Autosave respondent progress */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Autosave Progress
                            </span>
                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Autosave respondent answers locally
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Automatically saves student progress in their browser to prevent loss if closed.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={s.presentation?.autosaveProgress ?? true}
                                    onChange={(val) =>
                                        updateSettings({
                                            presentation: { ...s.presentation, autosaveProgress: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 4: FORM & QUESTION DEFAULTS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("defaults")}
                    className="p-5 sm:p-6 bg-neutral-50 border-b-2 border-black flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-[#FB7185] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Bookmark className="w-5 h-5 text-black" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">Defaults & Presets</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Default rules applied to all new questions and form templates for your club.
                            </p>
                        </div>
                    </div>
                    {openSections.defaults ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>

                {openSections.defaults && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y-2 divide-black/10">
                        {/* Question Defaults */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-black uppercase tracking-wider text-black block">
                                Question Defaults
                            </span>

                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Make questions required by default
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        New questions will automatically be toggled as required.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={Boolean(s.questionDefaults?.defaultRequired)}
                                    onChange={(val) =>
                                        updateSettings({
                                            questionDefaults: { ...s.questionDefaults, defaultRequired: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-black/20 hover:border-black transition-colors">
                                <div>
                                    <span className="text-xs sm:text-sm font-black text-black block">
                                        Enable response validation by default
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium">
                                        Suggests standard length and format validation when creating text questions.
                                    </span>
                                </div>
                                <NeoToggle
                                    checked={Boolean(s.questionDefaults?.defaultValidation)}
                                    onChange={(val) =>
                                        updateSettings({
                                            questionDefaults: { ...s.questionDefaults, defaultValidation: val },
                                        })
                                    }
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* Save Club Defaults */}
                        <div className="pt-5 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <span className="text-xs sm:text-sm font-black text-black block">
                                    Club Default Form Settings
                                </span>
                                <span className="text-[11px] text-neutral-500 font-medium">
                                    Save current settings configuration as the club standard for future events.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveClubDefaults}
                                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-black shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer"
                            >
                                Save as Club Default
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
