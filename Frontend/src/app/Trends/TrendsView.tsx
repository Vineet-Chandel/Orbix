import React, { useState, useEffect } from "react";
import { Code2, GitBranch, Sparkles } from "lucide-react";
import { PracticeTrendsSection } from "./PracticeTrendsSection";
import { DevelopmentTrendsSection } from "./DevelopmentTrendsSection";
import { useAppDispatch, fetchContestPerformance } from "../../store";

interface TrendsViewProps {
    connectedPortals: Record<string, any>;
    username?: string;
    onOpenMobileSidebar?: () => void;
}

export const TrendsView: React.FC<TrendsViewProps> = ({
    connectedPortals,
    username = "",
    onOpenMobileSidebar,
}) => {
    const [activeSection, setActiveSection] = useState<"practice" | "development">("practice");
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (username) {
            dispatch(
                fetchContestPerformance({
                    username,
                    portals: connectedPortals,
                })
            );
        }
    }, [username, connectedPortals, dispatch]);

    return (
        <div className="w-full flex-1 space-y-6 text-neutral-900 font-sans select-none">
            {/* Top Navigation & Sub-Section Switcher Header Bar */}
            <div className="pb-5 border-b-2 border-black/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        {onOpenMobileSidebar && (
                            <button
                                type="button"
                                onClick={onOpenMobileSidebar}
                                className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                aria-label="Open sidebar"
                            >
                                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Trends & Analytics
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                            <Sparkles className="w-3 h-3 text-black" />
                            <span>Performance Trajectory & Reports</span>
                        </span>
                        <span className="text-xs font-bold text-neutral-700 hidden sm:inline">
                            · Continuous Multi-Platform Tracking
                        </span>
                    </div>
                </div>

                {/* Switcher: Practice vs Development */}
                <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveSection("practice")}
                        className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            activeSection === "practice"
                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                        }`}
                    >
                        <Code2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Practice</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection("development")}
                        className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            activeSection === "development"
                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                        }`}
                    >
                        <GitBranch className="w-4 h-4 stroke-[2.5]" />
                        <span>Development</span>
                    </button>
                </div>
            </div>

            {/* Active Content Body */}
            {activeSection === "practice" ? (
                <PracticeTrendsSection
                    connectedPortals={connectedPortals}
                    username={username}
                />
            ) : (
                <DevelopmentTrendsSection
                    connectedPortals={connectedPortals}
                    username={username}
                />
            )}
        </div>
    );
};
