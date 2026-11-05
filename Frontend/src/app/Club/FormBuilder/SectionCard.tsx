import React from "react";
import {
    Copy,
    Trash2,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import type { FormSection } from "../../../api/clubEventFormApi";

export interface SectionCardProps {
    section: FormSection;
    index: number;
    totalSections: number;
    allSections: FormSection[];
    accentColor: string;
    onChange: (updated: FormSection) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

export const SectionCard: React.FC<SectionCardProps> = React.memo(({
    section,
    index,
    totalSections,
    allSections,
    accentColor: _accentColor,
    onChange,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
}) => {
    return (
        <div className="rounded-2xl bg-white border border-neutral-200 dark:border-neutral-800 shadow-sm p-5 sm:p-6 space-y-4">
            {/* Top Section Header Row */}
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 font-semibold text-xs uppercase tracking-wider">
                        Section {index + 1} of {totalSections}
                    </span>
                    <span className="text-xs font-medium text-neutral-500">
                        {section.questions.length} {section.questions.length === 1 ? "question" : "questions"}
                    </span>
                </div>

                {/* Section Action Icons */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                        title="Move Section Up"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={index === totalSections - 1}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                        title="Move Section Down"
                    >
                        <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicate}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                        title="Duplicate Section"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    {totalSections > 1 && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                            title="Delete Section (with Undo)"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Section Title & Description Inputs */}
            <div className="space-y-1.5">
                <input
                    type="text"
                    value={section.title}
                    onChange={(e) => onChange({ ...section, title: e.target.value })}
                    placeholder="Section Title..."
                    className="w-full text-base sm:text-lg font-bold text-neutral-900 dark:text-white border-b border-transparent hover:border-neutral-200 focus:border-neutral-900 dark:focus:border-white focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 transition-colors"
                />
                <textarea
                    value={section.description || ""}
                    onChange={(e) => onChange({ ...section, description: e.target.value })}
                    placeholder="Description (optional guidelines or context for this step)..."
                    rows={2}
                    className="w-full text-xs sm:text-sm font-normal text-neutral-600 dark:text-neutral-300 border-b border-transparent hover:border-neutral-200 focus:border-neutral-900 dark:focus:border-white focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 resize-none transition-colors"
                />
            </div>

            {/* After Section Navigation Flow */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-medium text-neutral-500">After section {index + 1}:</span>
                <select
                    value={section.afterSectionAction}
                    onChange={(e) => onChange({ ...section, afterSectionAction: e.target.value })}
                    className="font-medium bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-400 cursor-pointer transition-colors"
                >
                    <option value="next_section">Continue to next section</option>
                    {allSections.map((s, sIdx) => {
                        if (sIdx === index) return null;
                        return (
                            <option key={s.id} value={s.id}>
                                Go to section {sIdx + 1} ({s.title.slice(0, 24)})
                            </option>
                        );
                    })}
                    <option value="submit_form">Submit form</option>
                </select>
            </div>
        </div>
    );
});
