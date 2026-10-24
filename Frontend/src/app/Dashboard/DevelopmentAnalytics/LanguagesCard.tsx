import React from "react";
import { Languages as LanguagesIcon } from "lucide-react";
import type { LanguageItem } from "../../../store/developmentAnalyticsSlice";

interface LanguagesCardProps {
    languages?: LanguageItem[];
    isLoading?: boolean;
}

export const LanguagesCard: React.FC<LanguagesCardProps> = ({
    languages,
    isLoading = false,
}) => {
    const list = languages && languages.length > 0 ? languages : [];

    // Helper to format language name to match the screenshot style (e.g. TypeSc... or full)
    const formatName = (name: string) => {
        if (name === "TypeScript") return "TypeSc...";
        if (name === "JavaScript") return "JavaSc...";
        if (name.length > 9) return name.slice(0, 7) + "...";
        return name;
    };

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
        <div className="w-full text-black select-none flex flex-col justify-between h-full">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                        <LanguagesIcon className="w-5 h-5 text-black" />
                    </div>
                    <h3 className="text-lg font-black text-black tracking-tight leading-none">
                        Languages
                    </h3>
                </div>
                <span className="text-xs sm:text-sm font-bold text-neutral-600">
                    by code size
                </span>
            </div>

            {isLoading && list.length === 0 ? (
                <div className="space-y-4 my-6">
                    <div className="w-full h-4 rounded-xl bg-[#FAF6EE] border-2 border-black/30 animate-pulse" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="w-24 h-3 bg-neutral-200 rounded-md animate-pulse" />
                            <div className="w-20 h-3 bg-neutral-100 rounded-md animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="w-24 h-3 bg-neutral-200 rounded-md animate-pulse" />
                            <div className="w-20 h-3 bg-neutral-100 rounded-md animate-pulse" />
                        </div>
                    </div>
                </div>
            ) : list.length === 0 ? (
                <div className="py-12 text-center max-w-xs mx-auto space-y-2">
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        No language data detected on connected GitHub repositories.
                    </p>
                </div>
            ) : (
                <>
                    {/* Horizontal Progress Bar */}
                    <div className="w-full my-6">
                        <div className="w-full h-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] overflow-hidden flex">
                            {list.map((lang, idx) => (
                                <div
                                    key={idx}
                                    title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                                    style={{
                                        width: `${Math.max(1, lang.percentage)}%`,
                                        backgroundColor: lang.color,
                                    }}
                                    className="h-full border-r border-black last:border-r-0 transition-all duration-300 hover:opacity-80 cursor-pointer"
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
                                            className="w-3 h-3 rounded-full flex-shrink-0 border border-black shadow-[1px_1px_0px_#000]"
                                            style={{ backgroundColor: lang.color }}
                                        />
                                        <span className="text-xs sm:text-sm font-bold text-black truncate">
                                            {formatName(lang.name)}
                                        </span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-mono font-black text-black px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black/30 tabular-nums ml-2 flex-shrink-0">
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
                                            className="w-3 h-3 rounded-full flex-shrink-0 border border-black shadow-[1px_1px_0px_#000]"
                                            style={{ backgroundColor: lang.color }}
                                        />
                                        <span className="text-xs sm:text-sm font-bold text-black truncate">
                                            {formatName(lang.name)}
                                        </span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-mono font-black text-black px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black/30 tabular-nums ml-2 flex-shrink-0">
                                        {lang.percentage.toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
