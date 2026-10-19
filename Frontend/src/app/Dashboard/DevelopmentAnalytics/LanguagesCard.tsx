import React from "react";
import { Languages as LanguagesIcon } from "lucide-react";
import type { LanguageItem } from "../../../store/developmentAnalyticsSlice";

interface LanguagesCardProps {
    languages?: LanguageItem[];
    isLoading?: boolean;
}

const DEFAULT_LANGUAGES: LanguageItem[] = [
    { name: "TypeScript", percentage: 75.8, color: "#3178c6", bytes: 2253975 },
    { name: "JavaScript", percentage: 21.4, color: "#f1e05a", bytes: 178931 },
    { name: "Java", percentage: 1.3, color: "#b07219", bytes: 40545 },
    { name: "C++", percentage: 0.8, color: "#f34b7d", bytes: 25000 },
    { name: "HTML", percentage: 0.4, color: "#e34c26", bytes: 12000 },
    { name: "EJS", percentage: 0.3, color: "#8b949e", bytes: 9000 },
];

export const LanguagesCard: React.FC<LanguagesCardProps> = ({
    languages,
    isLoading: _isLoading = false,
}) => {
    const list = languages && languages.length > 0 ? languages : DEFAULT_LANGUAGES;

    // Helper to format language name to match the screenshot style (e.g. TypeSc... or full)
    const formatName = (name: string) => {
        if (name === "TypeScript") return "TypeSc...";
        if (name === "JavaScript") return "JavaSc...";
        if (name.length > 9) return name.slice(0, 7) + "...";
        return name;
    };

    // Split list into 2 columns (alternating or left/right half)
    // In screenshot:
    // Left: TypeScript, Java, HTML
    // Right: JavaScript, C++, EJS
    // This is alternating indices: [0, 2, 4] on left, [1, 3, 5] on right!
    const leftColumn: LanguageItem[] = [];
    const rightColumn: LanguageItem[] = [];

    list.forEach((item, idx) => {
        if (idx % 2 === 0) {
            leftColumn.push(item);
        } else {
            rightColumn.push(item);
        }
    });

    return (
        <div className="w-full text-white select-none flex flex-col justify-between h-full">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 shadow-sm flex-shrink-0">
                        <LanguagesIcon className="w-5 h-5 text-neutral-300" />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-none">
                        Languages
                    </h3>
                </div>
                <span className="text-xs sm:text-sm font-normal text-neutral-400">
                    by code size
                </span>
            </div>

            {/* Horizontal Progress Bar */}
            <div className="w-full my-6">
                <div className="w-full h-2.5 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden flex">
                    {list.map((lang, idx) => (
                        <div
                            key={idx}
                            title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                            style={{
                                width: `${Math.max(1, lang.percentage)}%`,
                                backgroundColor: lang.color,
                            }}
                            className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-85"
                        />
                    ))}
                </div>
            </div>

            {/* Two Column Legend */}
            <div className="grid grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-3.5 pt-1">
                {/* Column 1 */}
                <div className="space-y-3.5">
                    {leftColumn.map((lang, idx) => (
                        <div
                            key={idx}
                            title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                            className="flex items-center justify-between group cursor-default"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: lang.color }}
                                />
                                <span className="text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
                                    {formatName(lang.name)}
                                </span>
                            </div>
                            <span className="text-xs sm:text-sm font-mono text-neutral-400 font-medium tabular-nums ml-2 flex-shrink-0">
                                {lang.percentage.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>

                {/* Column 2 */}
                <div className="space-y-3.5">
                    {rightColumn.map((lang, idx) => (
                        <div
                            key={idx}
                            title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                            className="flex items-center justify-between group cursor-default"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: lang.color }}
                                />
                                <span className="text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
                                    {formatName(lang.name)}
                                </span>
                            </div>
                            <span className="text-xs sm:text-sm font-mono text-neutral-400 font-medium tabular-nums ml-2 flex-shrink-0">
                                {lang.percentage.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
