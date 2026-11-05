import React, { useState } from "react";
import {
    Award,
    Mail,
    Sliders,
    ChevronDown,
    ChevronUp,
    Bookmark,
    Shield,
    Settings,
} from "lucide-react";
import { NeoToggle } from "../../../components/NeoToggle";
import type { ClubEventFormRecord, FormSettings } from "../../../api/clubEventFormApi";
import { useToast } from "../../../context/ToastContext";

export interface FormSettingsTabProps {
    form: ClubEventFormRecord;
    event?: any;
    accentColor?: string;
    onUpdateSettings: (newSettings: FormSettings) => void;
}

export const FormSettingsTab: React.FC<FormSettingsTabProps> = ({
    form,
    event,
    accentColor: _accentColor,
    onUpdateSettings,
}) => {
    const toast = useToast();

    // Accordion state
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

    // Deep merge helper
    const updateSettings = (partial: Partial<FormSettings>) => {
        const merged: FormSettings = {
            ...s,
            ...partial,
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
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                <Settings className="w-4 h-4 text-neutral-500 shrink-0" />
                <div className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                    Configure registration rules, automated quiz grading, respondent visibility, and event capacity.
                </div>
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 1: QUIZ SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                {/* Header with Master Switch */}
                <div className="p-5 sm:p-6 bg-white dark:bg-[#0A0A0A] border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                            <Award className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">Make this a quiz</h3>
                            <p className="text-xs text-neutral-500 font-normal">
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
                            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
                        >
                            {openSections.quiz ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Expanded Quiz Options */}
                {s.quiz?.isQuiz && openSections.quiz && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {/* 1. Release Grades */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Release Grades
                            </span>
                            <div className="space-y-2">
                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/50 bg-white dark:bg-neutral-950">
                                    <input
                                        type="radio"
                                        name="releaseGrades"
                                        checked={s.quiz?.releaseGrades !== "after_review"}
                                        onChange={() =>
                                            updateSettings({
                                                quiz: { ...s.quiz, releaseGrades: "immediately" },
                                            })
                                        }
                                        className="mt-0.5 accent-black dark:accent-white"
                                    />
                                    <div>
                                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                            Immediately after each submission
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-normal block">
                                            Respondents instantly see their calculated score upon submitting the form.
                                        </span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/50 bg-white dark:bg-neutral-950">
                                    <input
                                        type="radio"
                                        name="releaseGrades"
                                        checked={s.quiz?.releaseGrades === "after_review"}
                                        onChange={() =>
                                            updateSettings({
                                                quiz: { ...s.quiz, releaseGrades: "after_review" },
                                            })
                                        }
                                        className="mt-0.5 accent-black dark:accent-white"
                                    />
                                    <div>
                                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                            Later, after manual review
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-normal block">
                                            Club staff can review text questions, adjust scores, and release grades from the Responses tab.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 2. Respondent Settings */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Respondent Settings
                            </span>

                            {/* Missed questions toggle */}
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Missed questions
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Correct answers
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Point values
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                                <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                    Default question point value
                                </span>
                                <span className="text-[11px] text-neutral-500 font-normal">
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
                                className="w-20 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center text-xs font-semibold bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 2: RESPONSES SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div
                    onClick={() => toggleSection("responses")}
                    className="p-5 sm:p-6 bg-white dark:bg-[#0A0A0A] border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                            <Mail className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">Responses</h3>
                            <p className="text-xs text-neutral-500 font-normal">
                                Manage identity collection, participant limits, response editing, and receipts.
                            </p>
                        </div>
                    </div>
                    {openSections.responses ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {openSections.responses && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {/* 1. Identity Collection */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Identity & Account Collection
                            </span>

                            {/* Collect Orbix Identity */}
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Collect verified Orbix account & student email
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Pre-fill profile information
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Submission Control
                            </span>

                            {/* Limit to 1 response */}
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Limit to 1 response per student
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Allow response editing
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Require Orbix student login
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                                <Shield className="w-4 h-4 text-neutral-500 shrink-0" />
                                <span>
                                    <strong>Campus Eligibility:</strong> Synchronized with Event settings (
                                    {event?.eligibility === "college_only" ? "Restricted to host college students" : "Open to all verified students"}
                                    ).
                                </span>
                            </div>
                        </div>

                        {/* 3. Response Receipts & Notifications */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Receipts & Notifications
                            </span>

                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Send registration confirmation email
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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

                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Notify club administrators on new submissions
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Response Availability & Limits
                            </span>

                            {/* Accepting Responses Master Toggle */}
                            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between gap-4">
                                <div>
                                    <span className="font-semibold text-sm text-neutral-900 dark:text-white block">Accepting Responses</span>
                                    <span className="text-xs text-neutral-500 font-normal">
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
                                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
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
                                        className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 text-xs sm:text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400"
                                    />
                                    {s.responses?.closingDateTime && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateSettings({
                                                    responses: { ...s.responses, closingDateTime: null },
                                                })
                                            }
                                            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <span className="text-[11px] text-neutral-500 font-normal block">
                                    Forms will automatically stop accepting responses past this date.
                                </span>
                            </div>

                            {/* Maximum Responses Cap */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
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
                                    className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 text-xs sm:text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400"
                                />
                                <span className="text-[11px] text-neutral-500 font-normal block">
                                    {event?.capacity
                                        ? `Event seat limit is currently set to ${event.capacity} in event settings.`
                                        : "Leave blank to accept registrations up to total event capacity."}
                                </span>
                            </div>

                            {/* Custom Closed Form Message */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
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
                                    className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 text-xs sm:text-sm font-normal focus:outline-none focus:border-neutral-400 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white resize-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------------- */}
            {/* GROUP 3: PRESENTATION SETTINGS */}
            {/* ------------------------------------------------------------------------- */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div
                    onClick={() => toggleSection("presentation")}
                    className="p-5 sm:p-6 bg-white dark:bg-[#0A0A0A] border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                            <Sliders className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">Presentation</h3>
                            <p className="text-xs text-neutral-500 font-normal">
                                Configure progress indicator, shuffling, confirmation messages, and autosave.
                            </p>
                        </div>
                    </div>
                    {openSections.presentation ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {openSections.presentation && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {/* 1. Form Presentation */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Form Layout & Ordering
                            </span>

                            {/* Progress bar */}
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Show progress bar
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Shuffle question order
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Shuffle answer options globally
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                After Submission
                            </span>

                            {/* Confirmation message */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
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
                                    className="w-full border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 text-xs sm:text-sm font-normal focus:outline-none focus:border-neutral-400 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white resize-none"
                                />
                            </div>

                            {/* Submit another response link */}
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Show link to submit another response
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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

                            {/* View results summary toggle */}
                            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                            View results summary
                                        </span>
                                        <span className="text-[11px] text-neutral-500 font-normal">
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
                                <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 font-normal flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>
                                        <strong>Privacy Guard Active:</strong> Individual answers, personal identification, and files of other students are never exposed to respondents.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Autosave respondent progress */}
                        <div className="space-y-3 pt-5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Autosave Progress
                            </span>
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Autosave respondent answers locally
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div
                    onClick={() => toggleSection("defaults")}
                    className="p-5 sm:p-6 bg-white dark:bg-[#0A0A0A] border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                            <Bookmark className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">Defaults & Presets</h3>
                            <p className="text-xs text-neutral-500 font-normal">
                                Default rules applied to all new questions and form templates for your club.
                            </p>
                        </div>
                    </div>
                    {openSections.defaults ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>

                {openSections.defaults && (
                    <div className="p-5 sm:p-6 space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800">
                        {/* Question Defaults */}
                        <div className="space-y-3 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                Question Defaults
                            </span>

                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Make questions required by default
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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

                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                <div>
                                    <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                        Enable response validation by default
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-normal">
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
                                <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white block">
                                    Club Default Form Settings
                                </span>
                                <span className="text-[11px] text-neutral-500 font-normal">
                                    Save current settings configuration as the club standard for future events.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveClubDefaults}
                                className="px-4 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer shadow-sm transition-colors"
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
