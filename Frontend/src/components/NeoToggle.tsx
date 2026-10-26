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
    size?: "md" | "sm";
    ariaLabel?: string;
}

export const NeoToggle: React.FC<NeoToggleProps> = ({
    checked,
    onChange,
    disabled = false,
    onIcon,
    offIcon,
    statusText,
    onStatusText = "Status: Public",
    offStatusText = "Status: Private",
    showStatusText = true,
    className = "",
    size = "md",
    ariaLabel,
}) => {
    const isSm = size === "sm";
    const currentStatusText = statusText || (checked ? onStatusText : offStatusText);

    return (
        <div className={`flex flex-col items-center sm:items-end gap-1.5 shrink-0 select-none ${className}`}>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={ariaLabel}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`relative rounded-full border-[3px] border-black shadow-[3px_3px_0px_#000] transition-colors p-1 cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                    isSm ? "w-16 h-9" : "w-20 h-11"
                } ${checked ? "bg-[#a2ff86]" : "bg-neutral-200"}`}
            >
                <motion.div
                    animate={{ x: checked ? (isSm ? 28 : 36) : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`${
                        isSm ? "w-6 h-6" : "w-7 h-7"
                    } rounded-full bg-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center`}
                >
                    {checked ? onIcon : offIcon}
                </motion.div>
            </button>
            {showStatusText && (
                <span className="text-[11px] font-mono font-bold text-neutral-600">
                    {currentStatusText}
                </span>
            )}
        </div>
    );
};

export default NeoToggle;
