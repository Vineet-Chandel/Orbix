import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface NeoSelectOption {
    value: string | number;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    description?: string;
}

export interface NeoSelectProps {
    value?: string | number;
    defaultValue?: string | number;
    onChange?: (value: string) => void;
    options?: NeoSelectOption[];
    children?: React.ReactNode;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
    dropdownClassName?: string;
    name?: string;
    id?: string;
    label?: string;
    error?: string;
    "aria-label"?: string;
    size?: "sm" | "md" | "lg";
}

/**
 * NeoSelect — Reusable Neo-Brutalist Select Dropdown Component
 * Replaces default system browser <select> dropdowns with a styled, accessible,
 * in-place Neo-brutalist popover menu with thick black borders, brutalist shadow,
 * and full keyboard navigation.
 */
export const NeoSelect: React.FC<NeoSelectProps> = ({
    value: controlledValue,
    defaultValue,
    onChange,
    options: optionsProp,
    children,
    placeholder = "Select an option...",
    disabled = false,
    className = "",
    triggerClassName = "",
    dropdownClassName = "",
    name,
    id: propId,
    label,
    error,
    "aria-label": ariaLabel,
    size = "md",
}) => {
    const generatedId = useId();
    const id = propId || generatedId;
    const listboxId = `${id}-listbox`;

    // Parse options from either `options` prop or child `<option>` elements
    const parsedOptions: NeoSelectOption[] = React.useMemo(() => {
        if (optionsProp && optionsProp.length > 0) {
            return optionsProp;
        }

        const childOptions: NeoSelectOption[] = [];
        React.Children.forEach(children, (child) => {
            if (React.isValidElement(child) && (child.type === "option" || (child.props as any).value !== undefined)) {
                const props = child.props as any;
                childOptions.push({
                    value: props.value !== undefined ? props.value : String(props.children),
                    label: typeof props.children === "string" ? props.children : String(props.value || ""),
                    disabled: Boolean(props.disabled),
                });
            }
        });
        return childOptions;
    }, [optionsProp, children]);

    // Handle controlled vs uncontrolled state
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState<string | number>(() => {
        if (controlledValue !== undefined) return controlledValue;
        if (defaultValue !== undefined) return defaultValue;
        return parsedOptions[0]?.value ?? "";
    });

    const currentValue = isControlled ? controlledValue : internalValue;

    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);

    // Selected option object
    const selectedOption = parsedOptions.find((opt) => String(opt.value) === String(currentValue));

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Scroll highlighted option into view
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
            const listItems = listboxRef.current.children;
            const targetItem = listItems[highlightedIndex] as HTMLElement;
            if (targetItem) {
                targetItem.scrollIntoView({ block: "nearest" });
            }
        }
    }, [isOpen, highlightedIndex]);

    const handleSelect = (val: string | number) => {
        if (!isControlled) {
            setInternalValue(val);
        }
        onChange?.(String(val));
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    const toggleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            const initialIdx = parsedOptions.findIndex((opt) => String(opt.value) === String(currentValue));
            setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    const init = parsedOptions.findIndex((opt) => String(opt.value) === String(currentValue));
                    setHighlightedIndex(init >= 0 ? init : 0);
                } else {
                    setHighlightedIndex((prev) => {
                        let next = prev + 1;
                        while (next < parsedOptions.length && parsedOptions[next]?.disabled) {
                            next++;
                        }
                        return next < parsedOptions.length ? next : prev;
                    });
                }
                break;

            case "ArrowUp":
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    const init = parsedOptions.findIndex((opt) => String(opt.value) === String(currentValue));
                    setHighlightedIndex(init >= 0 ? init : parsedOptions.length - 1);
                } else {
                    setHighlightedIndex((prev) => {
                        let next = prev - 1;
                        while (next >= 0 && parsedOptions[next]?.disabled) {
                            next--;
                        }
                        return next >= 0 ? next : prev;
                    });
                }
                break;

            case "Home":
                if (isOpen) {
                    e.preventDefault();
                    setHighlightedIndex(0);
                }
                break;

            case "End":
                if (isOpen) {
                    e.preventDefault();
                    setHighlightedIndex(parsedOptions.length - 1);
                }
                break;

            case "Enter":
            case " ":
                e.preventDefault();
                if (isOpen) {
                    if (highlightedIndex >= 0 && highlightedIndex < parsedOptions.length) {
                        const opt = parsedOptions[highlightedIndex];
                        if (opt && !opt.disabled) {
                            handleSelect(opt.value);
                        }
                    }
                } else {
                    toggleOpen();
                }
                break;

            case "Escape":
                if (isOpen) {
                    e.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus();
                }
                break;

            case "Tab":
                if (isOpen) {
                    setIsOpen(false);
                }
                break;
        }
    };

    // Size mappings
    const sizeClasses = {
        sm: "h-9 px-2.5 text-xs rounded-xl",
        md: "h-11 px-3 text-xs sm:text-sm rounded-xl sm:rounded-2xl",
        lg: "h-12 px-4 text-sm rounded-2xl",
    };

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {label && (
                <label
                    htmlFor={id}
                    className="block text-[11px] font-black uppercase tracking-wider text-neutral-600 mb-1"
                >
                    {label}
                </label>
            )}

            {/* Hidden native input for standard form serialization */}
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ""}
                />
            )}

            {/* Trigger Button */}
            <button
                type="button"
                id={id}
                ref={triggerRef}
                onClick={toggleOpen}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-label={ariaLabel || label}
                className={`w-full flex items-center justify-between gap-2 bg-[#FAF6EE] hover:bg-white focus:bg-white text-black border-2 border-black font-bold transition-all shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses[size]} ${
                    error ? "border-rose-600 bg-rose-50" : ""
                } ${triggerClassName}`}
            >
                <div className="flex items-center gap-2 truncate text-left min-w-0">
                    {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
                    <span className={`truncate ${!selectedOption ? "text-neutral-500 font-medium" : "text-black font-bold"}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-black flex-shrink-0 stroke-[2.5] transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <ul
                    id={listboxId}
                    ref={listboxRef}
                    role="listbox"
                    aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined}
                    tabIndex={-1}
                    className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl sm:rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] p-1.5 space-y-1 overflow-y-auto max-h-60 animate-fadeIn ${dropdownClassName}`}
                >
                    {parsedOptions.length === 0 ? (
                        <li className="px-3 py-2 text-xs font-bold text-neutral-500 text-center select-none">
                            No options available
                        </li>
                    ) : (
                        parsedOptions.map((opt, idx) => {
                            const isSelected = String(opt.value) === String(currentValue);
                            const isHighlighted = idx === highlightedIndex;

                            return (
                                <li
                                    key={`${opt.value}-${idx}`}
                                    id={`${listboxId}-opt-${idx}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={opt.disabled}
                                    onClick={() => {
                                        if (!opt.disabled) handleSelect(opt.value);
                                    }}
                                    onMouseEnter={() => {
                                        if (!opt.disabled) setHighlightedIndex(idx);
                                    }}
                                    className={`px-3 py-2 text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-colors select-none ${
                                        opt.disabled
                                            ? "opacity-40 cursor-not-allowed"
                                            : isSelected
                                            ? "bg-[#FFE566] text-black font-black border border-black shadow-[1px_1px_0px_#000]"
                                            : isHighlighted
                                            ? "bg-[#FAF6EE] text-black font-bold"
                                            : "text-neutral-800 font-bold hover:bg-[#FAF6EE] hover:text-black"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate min-w-0">
                                        {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                                        <div className="truncate">
                                            <div className="truncate">{opt.label}</div>
                                            {opt.description && (
                                                <div className="text-[10px] text-neutral-500 font-medium truncate">
                                                    {opt.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-3.5 h-3.5 stroke-[3] text-black flex-shrink-0" />
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}

            {error && <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>}
        </div>
    );
};

export default NeoSelect;
