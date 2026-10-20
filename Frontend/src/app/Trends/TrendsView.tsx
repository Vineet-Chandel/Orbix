import React, { useState, useEffect } from "react";
import { Code2, GitBranch, Sparkles } from "lucide-react";
import { PracticeTrendsSection } from "./PracticeTrendsSection";
import { DevelopmentTrendsSection } from "./DevelopmentTrendsSection";
import { useAppDispatch, fetchContestPerformance } from "../../store";

interface TrendsViewProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

export const TrendsView: React.FC<TrendsViewProps> = ({
    connectedPortals,
    username = "",
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
        <div className="w-full flex-1 rounded-3xl bg-black border border-neutral-800 p-5 sm:p-8 text-white font-sans select-none shadow-2xl space-y-6">
            {/* Top Navigation & Sub-Section Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-amber-400">
                        <Sparkles className="w-3 h-3" />
                        <span>Performance Trajectory & Reports</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                        Trends & Analytics
                    </h1>
                </div>

                {/* Switcher: Practice vs Development (matching dashboard pattern with pure black design) */}
                <div className="inline-flex items-center p-1 rounded-2xl bg-neutral-950 border border-neutral-800 self-start sm:self-auto shadow-inner">
                    <button
                        type="button"
                        onClick={() => setActiveSection("practice")}
                        className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                            activeSection === "practice"
                                ? "bg-white text-black shadow-md shadow-white/10"
                                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                        }`}
                    >
                        <Code2 className="w-4 h-4" />
                        <span>Practice</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection("development")}
                        className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                            activeSection === "development"
                                ? "bg-white text-black shadow-md shadow-white/10"
                                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                        }`}
                    >
                        <GitBranch className="w-4 h-4" />
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
