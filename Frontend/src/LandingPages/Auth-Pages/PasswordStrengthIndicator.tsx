import { motion } from "framer-motion";
import type { PasswordStrengthResult } from "./passwordValidator";

interface PasswordStrengthIndicatorProps {
    result: PasswordStrengthResult;
    hasInput: boolean;
}

export const PasswordStrengthIndicator = ({
    result,
    hasInput,
}: PasswordStrengthIndicatorProps) => {
    return (
        <div className="mt-3 space-y-3 rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000]">
            {/* Header: Label & Status Indicator */}
            <div className="flex items-center justify-between text-xs">
                <span className="font-black uppercase tracking-wider text-black">Password Strength</span>
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border-2 border-black transition-colors duration-200 ${
                        hasInput && result.isValid
                            ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000]"
                            : hasInput
                            ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000]"
                            : "bg-neutral-100 text-neutral-500 border-neutral-300"
                    }`}
                >
                    {hasInput ? result.label : "Required"}
                </span>
            </div>

            {/* Situation Progress Bar */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 border-2 border-black shadow-[1px_1px_0px_#000]">
                <motion.div
                    className={`h-full rounded-full transition-colors duration-300 ${
                        hasInput ? result.barColorClass : "bg-transparent"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: hasInput ? `${result.percentage}%` : "0%" }}
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
            </div>

            {/* Conditions Checklist with 'o' transitioning to tick '✓' */}
            <div className="pt-1">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-600">
                    Password must satisfy:
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {result.criteria.map((crit) => {
                        const satisfied = crit.isMet;
                        return (
                            <div
                                key={crit.id}
                                className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                                    satisfied
                                        ? "text-black font-bold"
                                        : "text-neutral-600 font-medium"
                                }`}
                            >
                                {/* Circle 'o' transitioning to tick '✓' */}
                                <motion.div
                                    animate={{
                                        scale: satisfied ? [1, 1.25, 1] : 1,
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-shrink-0"
                                >
                                    {satisfied ? (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white border border-black shadow-[1px_1px_0px_#000]">
                                            <svg
                                                className="h-2.5 w-2.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                            >
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </span>
                                    ) : (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-black/30 bg-neutral-100 text-neutral-400">
                                            {/* 'o' empty circle */}
                                            <span className="h-1.5 w-1.5 rounded-full bg-black/20" />
                                        </span>
                                    )}
                                </motion.div>
                                <span className="leading-tight text-[11.5px]">{crit.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
