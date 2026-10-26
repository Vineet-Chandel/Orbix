import { motion } from "framer-motion";

interface UsernameRulesIndicatorProps {
    username: string;
    hasInput: boolean;
    isFocused?: boolean;
}

export const evaluateUsername = (username: string) => {
    const trimmed = username.trim().toLowerCase();
    
    const criteria = [
        {
            id: "length",
            label: "3 to 20 characters",
            isMet: trimmed.length >= 3 && trimmed.length <= 20,
        },
        {
            id: "characters",
            label: "Lowercase letters (a-z) & numbers (0-9)",
            isMet: /[a-z0-9]/.test(trimmed) && !/[^a-z0-9._-]/.test(trimmed),
        },
        {
            id: "symbols",
            label: "Allowed symbols: dot ( . ), underscore ( _ ), hyphen ( - )",
            isMet: !/[^a-z0-9._-]/.test(trimmed) && trimmed.length > 0,
        },
        {
            id: "noSpaces",
            label: "No spaces or special symbols (@, $, %, etc.)",
            isMet: !/\s/.test(username) && !/[^a-z0-9._-]/.test(trimmed) && trimmed.length > 0,
        },
        {
            id: "startEnd",
            label: "Starts and ends with a letter or number",
            isMet: /^[a-z0-9]/.test(trimmed) && /[a-z0-9]$/.test(trimmed),
        },
    ];

    const isValid = criteria.every((c) => c.isMet);
    const metCount = criteria.filter((c) => c.isMet).length;

    return {
        criteria,
        isValid,
        metCount,
        total: criteria.length,
    };
};

export const UsernameRulesIndicator = ({
    username,
    hasInput,
    isFocused = false,
}: UsernameRulesIndicatorProps) => {
    const { criteria, isValid } = evaluateUsername(username);

    // Show rules whenever user has typed something or focused the field
    if (!hasInput && !isFocused) {
        return null;
    }

    return (
        <div className="mt-2.5 space-y-2.5 rounded-2xl border-2 border-black bg-white p-3.5 sm:p-4 shadow-[3px_3px_0px_#000] transition-all">
            {/* Header: Label & Status Indicator */}
            <div className="flex items-center justify-between text-xs">
                <span className="font-black uppercase tracking-wider text-black">Username Requirements</span>
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border-2 border-black transition-colors duration-200 ${
                        isValid
                            ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000]"
                            : hasInput
                            ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000]"
                            : "bg-neutral-100 text-neutral-500 border-neutral-300"
                    }`}
                >
                    {isValid ? "✓ All Rules Met" : hasInput ? "In Progress" : "Required"}
                </span>
            </div>

            {/* Conditions Checklist with tick '✓' and circle 'o' */}
            <div className="space-y-1.5 pt-0.5">
                {criteria.map((crit) => {
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
    );
};
