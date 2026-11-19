import React from "react";
import { motion } from "framer-motion";

export interface NeoToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    onIcon?: React.ReactNode;
    offIcon?: React.ReactNode;
    statusText?: string;
    onStatusText?: string;
    offStatusText?: string;
    showStatusText?: boolean;
    className?: string;
    size?: "xs" | "sm" | "md" | "lg";
    ariaLabel?: string;
}

export const NeoToggle: React.FC<NeoToggleProps> = ({
    checked,
    onChange,
    disabled = false,
    onIcon,
    offIcon,
    statusText,
    onStatusText = "Enabled",
    offStatusText = "Disabled",
    showStatusText = false,
    className = "",
    size = "md",
    ariaLabel,
}) => {
    const currentStatusText = statusText || (checked ? onStatusText : offStatusText);

    const sizeConfig = {
        xs: {
            pill: "w-11 h-6 p-0.5 border-[2px] border-black shadow-[1.5px_1.5px_0px_#000]",
            knob: "w-4 h-4 border-[1.5px] border-black shadow-[1px_1px_0px_#000]",
            travel: 20,
        },
        sm: {
            pill: "w-14 h-8 p-1 border-[2.5px] border-black shadow-[2px_2px_0px_#000]",
            knob: "w-5 h-5 border-2 border-black shadow-[1px_1px_0px_#000]",
            travel: 24,
        },
        md: {
            pill: "w-20 h-11 p-1 border-[3px] border-black shadow-[3px_3px_0px_#000]",
            knob: "w-7 h-7 border-2 border-black shadow-[1px_1px_0px_#000]",
            travel: 36,
        },
        lg: {
            pill: "w-24 h-12 p-1 border-[3px] border-black shadow-[3px_3px_0px_#000]",
            knob: "w-8 h-8 border-2 border-black shadow-[1.5px_1.5px_0px_#000]",
            travel: 46,
        },
    }[size];

    const toggleButton = (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative rounded-full transition-colors cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed select-none shrink-0 ${
                sizeConfig.pill
            } ${checked ? "bg-[#a2ff86]" : "bg-neutral-200 dark:bg-neutral-800"}`}
        >
            <motion.div
                animate={{ x: checked ? sizeConfig.travel : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`${sizeConfig.knob} rounded-full bg-white dark:bg-neutral-100 flex items-center justify-center`}
            >
                {checked ? onIcon : offIcon}
            </motion.div>
        </button>
    );

    if (!showStatusText) {
        return <div className={`inline-flex items-center shrink-0 ${className}`}>{toggleButton}</div>;
    }

    return (
        <div className={`flex flex-col items-center sm:items-end gap-1.5 shrink-0 select-none ${className}`}>
            {toggleButton}
            <span className="text-[11px] font-mono font-bold text-neutral-600 dark:text-neutral-400">
                {currentStatusText}
            </span>
        </div>
    );
};

export default NeoToggle;
