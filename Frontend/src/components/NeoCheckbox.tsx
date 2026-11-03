import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";

export interface NeoCheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
    /** Checked state for controlled usage */
    checked?: boolean;
    /** Initial checked state for uncontrolled usage */
    defaultChecked?: boolean;
    /** Indeterminate (partially checked) state */
    indeterminate?: boolean;
    /** Callback invoked with the boolean checked state */
    onCheckedChange?: (checked: boolean) => void;
    /** Standard change event handler */
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    /** Checkbox size variant */
    size?: "sm" | "md" | "lg";
    /** Accent color when checked */
    colorScheme?: "green" | "yellow" | "cyan" | "pink";
    /** Optional primary label text or node */
    label?: React.ReactNode;
    /** Optional secondary supporting description */
    description?: React.ReactNode;
    /** Optional error message displayed below */
    error?: string;
    /** Custom class applied to outer wrapper */
    className?: string;
    /** Custom class applied to visual checkbox square */
    boxClassName?: string;
    /** Custom class applied to label text */
    labelClassName?: string;
}

const colorStyles = {
    green: "bg-[#a2ff86] text-black",
    yellow: "bg-[#FFE566] text-black",
    cyan: "bg-[#70D6FF] text-black",
    pink: "bg-[#FF70A6] text-black",
};

const sizeStyles = {
    sm: {
        box: "w-4 h-4 rounded-[4px]",
        icon: "w-3 h-3 stroke-[3.5]",
        dash: "w-2 h-0.5",
        text: "text-xs",
        desc: "text-[11px]",
    },
    md: {
        box: "w-5 h-5 rounded-[5px]",
        icon: "w-3.5 h-3.5 stroke-[3.5]",
        dash: "w-2.5 h-0.5",
        text: "text-sm",
        desc: "text-xs",
    },
    lg: {
        box: "w-6 h-6 rounded-[6px]",
        icon: "w-4 h-4 stroke-[3.5]",
        dash: "w-3 h-0.5",
        text: "text-base",
        desc: "text-sm",
    },
};

export const NeoCheckbox = forwardRef<HTMLInputElement, NeoCheckboxProps>(
    (
        {
            checked,
            defaultChecked,
            indeterminate = false,
            onCheckedChange,
            onChange,
            size = "md",
            colorScheme = "green",
            label,
            description,
            error,
            className = "",
            boxClassName = "",
            labelClassName = "",
            disabled = false,
            id,
            ...rest
        },
        ref
    ) => {
        const innerRef = useRef<HTMLInputElement>(null);
        const resolvedRef = (ref || innerRef) as React.RefObject<HTMLInputElement | null>;

        // Keep DOM element's indeterminate property in sync
        useEffect(() => {
            if (resolvedRef.current) {
                resolvedRef.current.indeterminate = indeterminate;
            }
        }, [indeterminate, resolvedRef]);

        const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
        const isControlled = checked !== undefined;
        const isChecked = isControlled ? Boolean(checked) : uncontrolledChecked;

        const currentSize = sizeStyles[size];
        const activeColor = colorStyles[colorScheme];

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (disabled) return;
            if (!isControlled) {
                setUncontrolledChecked(e.target.checked);
            }
            onCheckedChange?.(e.target.checked);
            onChange?.(e);
        };

        // Visual indicator state
        const isBoxActive = indeterminate || isChecked;

        return (
            <div className={`inline-flex flex-col select-none ${className}`}>
                <label
                    htmlFor={id}
                    className={`inline-flex items-start gap-2.5 cursor-pointer group ${
                        disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                    <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                        {/* Hidden Accessible Native Checkbox */}
                        <input
                            ref={resolvedRef}
                            id={id}
                            type="checkbox"
                            className="sr-only peer"
                            checked={checked}
                            defaultChecked={defaultChecked}
                            disabled={disabled}
                            onChange={handleChange}
                            {...rest}
                        />

                        {/* Custom Neo-Brutalist Visual Checkbox */}
                        <div
                            aria-hidden="true"
                            className={`
                                ${currentSize.box}
                                flex items-center justify-center
                                border-2 border-black
                                shadow-[2px_2px_0px_#000000]
                                transition-all duration-100 ease-out
                                ${
                                    isBoxActive
                                        ? activeColor
                                        : "bg-white text-transparent group-hover:bg-neutral-50"
                                }
                                ${
                                    !disabled
                                        ? "group-active:translate-x-[1px] group-active:translate-y-[1px] group-active:shadow-[1px_1px_0px_#000000] peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2"
                                        : ""
                                }
                                ${boxClassName}
                            `}
                        >
                            {indeterminate ? (
                                <Minus className={`${currentSize.icon} text-black stroke-[3.5]`} />
                            ) : (
                                <Check
                                    className={`
                                        ${currentSize.icon}
                                        text-black stroke-[3.5]
                                        transition-transform duration-100
                                        ${isChecked ? "scale-100 opacity-100" : "scale-0 opacity-0"}
                                    `}
                                />
                            )}
                        </div>
                    </div>

                    {/* Label & Description */}
                    {(label || description) && (
                        <div className="flex flex-col min-w-0">
                            {label && (
                                <span
                                    className={`font-bold leading-snug text-black ${currentSize.text} ${labelClassName}`}
                                >
                                    {label}
                                </span>
                            )}
                            {description && (
                                <span
                                    className={`font-normal leading-normal text-neutral-600 mt-0.5 ${currentSize.desc}`}
                                >
                                    {description}
                                </span>
                            )}
                        </div>
                    )}
                </label>

                {error && (
                    <p className="mt-1 text-xs font-bold text-rose-600 px-0.5">{error}</p>
                )}
            </div>
        );
    }
);

NeoCheckbox.displayName = "NeoCheckbox";

export default NeoCheckbox;
