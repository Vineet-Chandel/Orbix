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

export const SectionCard: React.FC<SectionCardProps> = ({
    section,
    index,
    totalSections,
    allSections,
    accentColor,
    onChange,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
}) => {
    return (
        <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-5 sm:p-6 space-y-4">
            {/* Top Section Header Row */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-black/10 pb-3">
                <div className="flex items-center gap-2">
                    <span
                        className="px-2.5 py-1 rounded-xl text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                        style={{ backgroundColor: accentColor }}
                    >
                        Section {index + 1} of {totalSections}
                    </span>
                    <span className="text-xs font-bold text-neutral-500">
                        ({section.questions.length} questions)
                    </span>
                </div>

                {/* Section Action Icons */}
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg border border-black/20 hover:border-black hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                        title="Move Section Up"
                    >
                        <ArrowUp className="w-3.5 h-3.5 text-black" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={index === totalSections - 1}
                        className="p-1.5 rounded-lg border border-black/20 hover:border-black hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                        title="Move Section Down"
                    >
                        <ArrowDown className="w-3.5 h-3.5 text-black" />
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicate}
                        className="p-1.5 rounded-lg border border-black/20 hover:border-black hover:bg-neutral-100 cursor-pointer"
                        title="Duplicate Section"
                    >
                        <Copy className="w-3.5 h-3.5 text-black" />
                    </button>
                    {totalSections > 1 && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-lg border border-black/20 hover:border-rose-600 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 cursor-pointer"
                            title="Delete Section"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Section Title & Description Inputs */}
            <div className="space-y-2">
                <input
                    type="text"
                    value={section.title}
                    onChange={(e) => onChange({ ...section, title: e.target.value })}
                    placeholder="Section Title..."
                    className="w-full text-lg sm:text-xl font-black text-black border-b-2 border-black/20 focus:border-black focus:outline-none bg-transparent py-1 placeholder:text-neutral-400"
                />
                <textarea
                    value={section.description || ""}
                    onChange={(e) => onChange({ ...section, description: e.target.value })}
                    placeholder="Description (optional guidelines or context for this step)..."
                    rows={2}
                    className="w-full text-xs sm:text-sm font-medium text-neutral-600 border-b border-black/15 focus:border-black focus:outline-none bg-transparent py-1 placeholder:text-neutral-400 resize-none"
                />
            </div>

            {/* After Section Navigation Flow */}
            <div className="pt-2 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-neutral-700">After section {index + 1}:</span>
                <select
                    value={section.afterSectionAction}
                    onChange={(e) => onChange({ ...section, afterSectionAction: e.target.value })}
                    className="font-black bg-neutral-50 border-2 border-black rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                >
                    <option value="next_section">Continue to next section</option>
                    {allSections.map((s, sIdx) => {
                        if (sIdx === index) return null;
                        return (
                            <option key={s.id} value={s.id}>
                                Go to section {sIdx + 1} ({s.title.slice(0, 20)})
                            </option>
                        );
                    })}
                    <option value="submit_form">Submit form</option>
                </select>
            </div>
        </div>
    );
};
