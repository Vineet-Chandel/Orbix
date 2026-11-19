import React, { useState, useEffect, useRef } from "react";
import { Filter, X, Check } from "lucide-react";
import type { TableColumnDefinition, ColumnFilterRule } from "./types";
import { NeoSelect, type NeoSelectOption } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";

const FILTER_CONDITION_OPTIONS: NeoSelectOption[] = [
    { value: "contains", label: "Contains" },
    { value: "does_not_contain", label: "Does not contain" },
    { value: "equals", label: "Equals exactly" },
    { value: "does_not_equal", label: "Does not equal" },
    { value: "starts_with", label: "Starts with" },
    { value: "is_empty", label: "Is empty / blank" },
    { value: "is_not_empty", label: "Is not empty" },
];

interface ColumnFilterPopoverProps {
    column: TableColumnDefinition;
    activeRule?: ColumnFilterRule;
    onApply: (rule: ColumnFilterRule) => void;
    onClear: () => void;
    onClose: () => void;
}

export const ColumnFilterPopover: React.FC<ColumnFilterPopoverProps> = ({
    column,
    activeRule,
    onApply,
    onClear,
    onClose,
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    const isChoiceType =
        column.type === "select" ||
        column.type === "multiselect" ||
        column.type === "status" ||
        (column.options && column.options.length > 0);

    const isFileType = column.type === "file";

    const [operator, setOperator] = useState<string>(
        activeRule?.operator ||
            (isChoiceType ? "selectedOptions" : isFileType ? "has_file" : "contains")
    );
    const [value, setValue] = useState<string>(activeRule?.value || "");
    const [selectedOptions, setSelectedOptions] = useState<string[]>(
        activeRule?.selectedOptions || []
    );

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isChoiceType) {
            if (selectedOptions.length === 0) {
                onClear();
            } else {
                onApply({
                    columnId: column.id,
                    operator: "selectedOptions",
                    selectedOptions,
                });
            }
            onClose();
            return;
        }

        if (isFileType) {
            onApply({
                columnId: column.id,
                operator,
            });
            onClose();
            return;
        }

        if (operator === "is_empty" || operator === "is_not_empty") {
            onApply({
                columnId: column.id,
                operator,
            });
            onClose();
            return;
        }

        if (!value.trim()) {
            onClear();
            onClose();
            return;
        }

        onApply({
            columnId: column.id,
            operator,
            value: value.trim(),
        });
        onClose();
    };

    const toggleOption = (opt: string) => {
        setSelectedOptions((prev) =>
            prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
        );
    };

    return (
        <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full mt-2 left-0 z-50 w-72 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] p-3 text-left font-sans animate-in fade-in zoom-in-95 duration-100"
        >
            <div className="flex items-center justify-between border-b-2 border-black/10 pb-2 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-black">
                    <Filter className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[190px]">Filter: {column.label}</span>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="p-1 rounded-md hover:bg-neutral-200 text-neutral-600 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <form onSubmit={handleApply} className="space-y-3">
                {isChoiceType ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500 mb-1 px-1">
                            <span>Select options to include:</span>
                            <button
                                type="button"
                                onClick={() =>
                                    setSelectedOptions(
                                        selectedOptions.length === (column.options?.length || 0)
                                            ? []
                                            : column.options || []
                                    )
                                }
                                className="text-indigo-700 hover:underline"
                            >
                                {selectedOptions.length === (column.options?.length || 0)
                                    ? "Deselect All"
                                    : "Select All"}
                            </button>
                        </div>
                        {(column.options || []).map((opt) => {
                            const isChecked = selectedOptions.includes(opt);
                            return (
                                <div
                                    key={opt}
                                    className="p-1 rounded-lg hover:bg-white/80 transition-colors"
                                >
                                    <NeoCheckbox
                                        size="sm"
                                        colorScheme="yellow"
                                        checked={isChecked}
                                        onCheckedChange={() => toggleOption(opt)}
                                        label={opt}
                                        className="w-full"
                                        labelClassName="text-xs font-bold text-black"
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : isFileType ? (
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs font-bold text-black cursor-pointer">
                            <input
                                type="radio"
                                name="fileFilter"
                                checked={operator === "has_file"}
                                onChange={() => setOperator("has_file")}
                                className="text-black focus:ring-0 cursor-pointer"
                            />
                            <span>Has attached file</span>
                        </label>
                        <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs font-bold text-black cursor-pointer">
                            <input
                                type="radio"
                                name="fileFilter"
                                checked={operator === "no_file"}
                                onChange={() => setOperator("no_file")}
                                className="text-black focus:ring-0 cursor-pointer"
                            />
                            <span>No file submitted</span>
                        </label>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                Condition
                            </label>
                            <NeoSelect
                                value={operator}
                                onChange={(val) => setOperator(val)}
                                options={FILTER_CONDITION_OPTIONS}
                                size="sm"
                                className="w-full"
                                triggerClassName="h-8 text-xs font-bold bg-white"
                            />
                        </div>

                        {operator !== "is_empty" && operator !== "is_not_empty" && (
                            <div>
                                <label className="block text-[10px] font-black uppercase text-neutral-600 mb-1">
                                    Filter value
                                </label>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="Enter search term..."
                                    autoFocus
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-black text-xs font-bold text-black focus:outline-hidden"
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t-2 border-black/10">
                    <button
                        type="button"
                        onClick={() => {
                            onClear();
                            onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-black text-neutral-600 hover:text-black hover:bg-neutral-200 transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        type="submit"
                        className="px-3.5 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs font-black border border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                    >
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Apply</span>
                    </button>
                </div>
            </form>
        </div>
    );
};
