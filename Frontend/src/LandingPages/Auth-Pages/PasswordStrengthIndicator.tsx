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
        <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
            {/* Header: Label & Status Indicator */}
            <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-600">Password Strength</span>
                <span
                    className={`font-bold transition-colors duration-200 ${
                        hasInput ? result.colorClass : "text-neutral-400"
                    }`}
                >
                    {hasInput ? result.label : "Required"}
                </span>
            </div>

            {/* Situation Progress Bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-200">
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
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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
                                        ? "text-neutral-900 font-medium"
                                        : "text-neutral-500"
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
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
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
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-400">
                                            {/* 'o' empty circle */}
                                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
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
