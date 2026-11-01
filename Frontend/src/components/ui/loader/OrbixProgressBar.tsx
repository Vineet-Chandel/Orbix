import React from "react";
import { motion } from "framer-motion";
import { ACCENT_COLOR } from "./loader.constants";
import { clampProgress } from "./loader.utils";

interface OrbixProgressBarProps {
    progress: number;
    showPercentage?: boolean;
    accentColor?: string;
    className?: string;
}

export const OrbixProgressBar: React.FC<OrbixProgressBarProps> = ({
    progress,
    showPercentage = true,
    accentColor = ACCENT_COLOR,
    className = "",
}) => {
    const clamped = clampProgress(progress) ?? 0;

    return (
        <div className={`w-full max-w-[200px] flex flex-col items-center gap-1.5 ${className}`}>
            {/* Track Container */}
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/20 relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                <motion.div
                    className="h-full rounded-full"
                    style={{
                        backgroundColor: accentColor,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${clamped}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                />
            </div>

            {/* Percentage Label */}
            {showPercentage && (
                <div className="flex items-center justify-between w-full text-[10px] font-mono text-neutral-400 font-bold px-0.5">
                    <span>PROGRESS</span>
                    <span className="text-white">{clamped}%</span>
                </div>
            )}
        </div>
    );
};
