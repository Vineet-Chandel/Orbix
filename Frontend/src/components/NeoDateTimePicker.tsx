import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Calendar as CalendarIcon,
    Clock,
    ChevronLeft,
    ChevronRight,
    X,
    Check,
    Sparkles,
} from "lucide-react";
import { NeoSelect, type NeoSelectOption } from "./NeoSelect";

export interface NeoDateTimePickerProps {
    value: string; // Format: "YYYY-MM-DDTHH:mm" (datetime) or "YYYY-MM-DD" (date)
    onChange: (value: string) => void;
    onBlur?: () => void;
    mode?: "datetime" | "date";
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    required?: boolean;
    className?: string;
    minDate?: string;
    maxDate?: string;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper: pad single digit numbers with leading zero
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const HOUR_OPTIONS: NeoSelectOption[] = Array.from({ length: 12 }, (_, i) => {
    const val = i + 1;
    return {
        value: String(val),
        label: pad2(val),
    };
});

const MINUTE_OPTIONS: NeoSelectOption[] = Array.from({ length: 60 }, (_, i) => {
    return {
        value: String(i),
        label: pad2(i),
    };
});

const MONTH_OPTIONS: NeoSelectOption[] = MONTH_NAMES.map((name, idx) => ({
    value: String(idx),
    label: name,
}));

export const NeoDateTimePicker: React.FC<NeoDateTimePickerProps> = ({
    value,
    onChange,
    onBlur,
    mode = "datetime",
    label,
    placeholder = mode === "datetime" ? "Select date and time..." : "Select date...",
    disabled = false,
    error,
    required = false,
    className = "",
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Parse the incoming value into Date parts
    const parsedDate = useMemo(() => {
        if (!value) return null;
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        return d;
    }, [value]);

    // Active calendar viewing month/year
    const [viewYear, setViewYear] = useState<number>(() => {
        return parsedDate ? parsedDate.getFullYear() : new Date().getFullYear();
    });
    const [viewMonth, setViewMonth] = useState<number>(() => {
        return parsedDate ? parsedDate.getMonth() : new Date().getMonth();
    });

    // Temporary working state while calendar is open
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        return parsedDate ? parsedDate.getFullYear() : new Date().getFullYear();
    });
    const [selectedMonth, setSelectedMonth] = useState<number>(() => {
        return parsedDate ? parsedDate.getMonth() : new Date().getMonth();
    });
    const [selectedDay, setSelectedDay] = useState<number>(() => {
        return parsedDate ? parsedDate.getDate() : new Date().getDate();
    });

    // Time state (12-hour clock with AM/PM)
    const [hours12, setHours12] = useState<number>(() => {
        if (!parsedDate) return 10;
        const h24 = parsedDate.getHours();
        return h24 % 12 === 0 ? 12 : h24 % 12;
    });
    const [minutes, setMinutes] = useState<number>(() => {
        return parsedDate ? parsedDate.getMinutes() : 0;
    });
    const [ampm, setAmpm] = useState<"AM" | "PM">(() => {
        if (!parsedDate) return "AM";
        return parsedDate.getHours() >= 12 ? "PM" : "AM";
    });

    const YEAR_OPTIONS: NeoSelectOption[] = useMemo(() => {
        const currentY = new Date().getFullYear();
        const startY = Math.min(viewYear - 5, currentY - 5);
        const endY = Math.max(viewYear + 10, currentY + 10);
        const opts: NeoSelectOption[] = [];
        for (let y = startY; y <= endY; y++) {
            opts.push({ value: String(y), label: String(y) });
        }
        return opts;
    }, [viewYear]);

    // Synchronize working state when prop value changes
    useEffect(() => {
        if (parsedDate) {
            setViewYear(parsedDate.getFullYear());
            setViewMonth(parsedDate.getMonth());
            setSelectedYear(parsedDate.getFullYear());
            setSelectedMonth(parsedDate.getMonth());
            setSelectedDay(parsedDate.getDate());

            const h24 = parsedDate.getHours();
            setHours12(h24 % 12 === 0 ? 12 : h24 % 12);
            setMinutes(parsedDate.getMinutes());
            setAmpm(h24 >= 12 ? "PM" : "AM");
        }
    }, [parsedDate]);

    // Dismiss popover on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                if (onBlur) onBlur();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
                if (onBlur) onBlur();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onBlur]);

    // Format current value for display in the input box
    const displayValue = useMemo(() => {
        if (!parsedDate) return "";
        const m = SHORT_MONTH_NAMES[parsedDate.getMonth()];
        const d = parsedDate.getDate();
        const y = parsedDate.getFullYear();

        if (mode === "date") {
            return `${m} ${pad2(d)}, ${y}`;
        }

        const h24 = parsedDate.getHours();
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        const mins = pad2(parsedDate.getMinutes());
        const period = h24 >= 12 ? "PM" : "AM";

        return `${m} ${pad2(d)}, ${y} · ${pad2(h12)}:${mins} ${period}`;
    }, [parsedDate, mode]);

    // Calendar grid calculations
    const calendarDays = useMemo(() => {
        const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
        const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells: Array<{
            day: number;
            month: number;
            year: number;
            isCurrentMonth: boolean;
            isToday: boolean;
            isSelected: boolean;
        }> = [];

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();

        // 1. Previous month trailing days
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonthIndex = viewMonth === 0 ? 11 : viewMonth - 1;
            const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
            cells.push({
                day: dayNum,
                month: prevMonthIndex,
                year: prevYear,
                isCurrentMonth: false,
                isToday: false,
                isSelected:
                    !!parsedDate &&
                    selectedDay === dayNum &&
                    selectedMonth === prevMonthIndex &&
                    selectedYear === prevYear,
            });
        }

        // 2. Current month days
        for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
            const isToday =
                viewYear === todayY && viewMonth === todayM && dayNum === todayD;
            const isSelected =
                !!parsedDate &&
                selectedDay === dayNum &&
                selectedMonth === viewMonth &&
                selectedYear === viewYear;

            cells.push({
                day: dayNum,
                month: viewMonth,
                year: viewYear,
                isCurrentMonth: true,
                isToday,
                isSelected,
            });
        }

        // 3. Next month leading days to complete 42 cells (6 rows x 7 days)
        const remaining = 42 - cells.length;
        for (let dayNum = 1; dayNum <= remaining; dayNum++) {
            const nextMonthIndex = viewMonth === 11 ? 0 : viewMonth + 1;
            const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
            cells.push({
                day: dayNum,
                month: nextMonthIndex,
                year: nextYear,
                isCurrentMonth: false,
                isToday: false,
                isSelected:
                    !!parsedDate &&
                    selectedDay === dayNum &&
                    selectedMonth === nextMonthIndex &&
                    selectedYear === nextYear,
            });
        }

        return cells;
    }, [viewYear, viewMonth, selectedYear, selectedMonth, selectedDay, parsedDate]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((prev) => prev - 1);
        } else {
            setViewMonth((prev) => prev - 1);
        }
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((prev) => prev + 1);
        } else {
            setViewMonth((prev) => prev + 1);
        }
    };

    // Calculate formatted ISO / local string and emit onChange
    const emitChange = (y: number, m: number, d: number, h: number, mins: number, period: "AM" | "PM") => {
        if (mode === "date") {
            const str = `${y}-${pad2(m + 1)}-${pad2(d)}`;
            onChange(str);
            return;
        }

        // 24-hour conversion
        let h24 = h % 12;
        if (period === "PM") h24 += 12;

        const str = `${y}-${pad2(m + 1)}-${pad2(d)}T${pad2(h24)}:${pad2(mins)}`;
        onChange(str);
    };

    const handleSelectDay = (cell: (typeof calendarDays)[0]) => {
        setSelectedYear(cell.year);
        setSelectedMonth(cell.month);
        setSelectedDay(cell.day);

        // Keep viewing month in sync
        if (!cell.isCurrentMonth) {
            setViewYear(cell.year);
            setViewMonth(cell.month);
        }

        emitChange(cell.year, cell.month, cell.day, hours12, minutes, ampm);

        // In date-only mode, selecting a day immediately closes popover
        if (mode === "date") {
            setIsOpen(false);
            if (onBlur) onBlur();
        }
    };

    const handleSetTime = (newHours: number, newMinutes: number, newPeriod: "AM" | "PM") => {
        setHours12(newHours);
        setMinutes(newMinutes);
        setAmpm(newPeriod);
        emitChange(selectedYear, selectedMonth, selectedDay, newHours, newMinutes, newPeriod);
    };

    const handleQuickNow = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();
        const h24 = now.getHours();
        const mins = now.getMinutes();
        const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

        setViewYear(y);
        setViewMonth(m);
        setSelectedYear(y);
        setSelectedMonth(m);
        setSelectedDay(d);
        setHours12(h12);
        setMinutes(mins);
        setAmpm(period);

        emitChange(y, m, d, h12, mins, period);
    };

    const handleClear = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        onChange("");
        setIsOpen(false);
        if (onBlur) onBlur();
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {label && (
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}

            {/* Trigger Input Box */}
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border-2 text-xs font-bold text-black flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
                    isOpen
                        ? "bg-white border-black ring-2 ring-black shadow-[3px_3px_0px_#000]"
                        : "bg-[#FAF6EE] hover:bg-white border-black shadow-[2px_2px_0px_#000]"
                } ${error ? "border-rose-500 bg-rose-50/60" : ""} ${
                    disabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarIcon className="w-4 h-4 text-neutral-800 shrink-0 stroke-[2.2]" />
                    <span className={`truncate ${displayValue ? "font-black text-black" : "font-medium text-neutral-500"}`}>
                        {displayValue || placeholder}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {displayValue && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 rounded-md text-neutral-400 hover:text-black hover:bg-black/10 transition-colors"
                            title="Clear date"
                        >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                    )}
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-black/5 text-neutral-600 border border-black/10">
                        {mode === "datetime" ? "IST" : "Date"}
                    </span>
                </div>
            </div>

            {/* Neo-Brutalist Popover Calendar - Crisp pure white with bold black border & brutalist shadow */}
            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Date and time picker"
                    className="absolute left-0 top-[calc(100%+6px)] z-50 w-full sm:w-[330px] bg-white border-3 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                    {/* Month / Year Navigation with Custom NeoSelect Dropdowns & Fast Chevrons */}
                    <div className="flex items-center justify-between pb-2.5 border-b-2 border-black/10 gap-1.5">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px] shrink-0"
                            aria-label="Previous month"
                            title="Previous month"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                                <NeoSelect
                                    size="sm"
                                    value={String(viewMonth)}
                                    onChange={(val) => setViewMonth(Number(val))}
                                    options={MONTH_OPTIONS}
                                    triggerClassName="!h-8 !px-2 !py-0 !text-xs !font-black !rounded-lg !bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                    dropdownClassName="max-h-56 shadow-[4px_4px_0px_#000] text-xs font-bold"
                                />
                            </div>
                            <div className="w-[84px] shrink-0">
                                <NeoSelect
                                    size="sm"
                                    value={String(viewYear)}
                                    onChange={(val) => setViewYear(Number(val))}
                                    options={YEAR_OPTIONS}
                                    triggerClassName="!h-8 !px-2 !py-0 !text-xs !font-black !rounded-lg !bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                    dropdownClassName="max-h-56 shadow-[4px_4px_0px_#000] text-xs font-bold"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px] shrink-0"
                            aria-label="Next month"
                            title="Next month"
                        >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                    </div>

                    {/* Day-of-week header */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {DAY_LABELS.map((lbl, idx) => (
                            <span
                                key={idx}
                                className="text-[10px] font-black uppercase text-neutral-500"
                            >
                                {lbl}
                            </span>
                        ))}
                    </div>

                    {/* Calendar Days 6x7 Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((cell, idx) => {
                            const isSelected = cell.isSelected;
                            const isToday = cell.isToday;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectDay(cell)}
                                    className={`h-8 w-full rounded-lg text-xs font-bold transition-all flex items-center justify-center relative cursor-pointer ${
                                        isSelected
                                            ? "bg-[#a2ff86] text-black font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] z-10 scale-105"
                                            : cell.isCurrentMonth
                                            ? "text-black hover:bg-[#FFE566] hover:border hover:border-black"
                                            : "text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100"
                                    } ${
                                        isToday && !isSelected
                                            ? "font-black underline decoration-black decoration-2"
                                            : ""
                                    }`}
                                >
                                    <span>{cell.day}</span>
                                    {isToday && !isSelected && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Time Picker Row (in datetime mode) - Using Custom NeoSelect Dropdowns */}
                    {mode === "datetime" && (
                        <div className="pt-2.5 border-t-2 border-black/10 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3 stroke-[2.5]" />
                                    Time (IST)
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-black/5 text-black border border-black/10 font-mono">
                                    {pad2(hours12)}:{pad2(minutes)} {ampm}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-1.5">
                                {/* Custom NeoSelect Hour Selector */}
                                <div className="flex-1 min-w-0">
                                    <NeoSelect
                                        size="sm"
                                        placement="top"
                                        value={String(hours12)}
                                        onChange={(val) =>
                                            handleSetTime(Number(val), minutes, ampm)
                                        }
                                        options={HOUR_OPTIONS}
                                        triggerClassName="!h-8.5 !px-2.5 !py-0 !text-xs !font-black !rounded-xl !bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                        dropdownClassName="max-h-48 shadow-[4px_4px_0px_#000] text-xs font-bold"
                                    />
                                </div>

                                <span className="font-black text-black text-sm select-none">:</span>

                                {/* Custom NeoSelect Minute Selector */}
                                <div className="flex-1 min-w-0">
                                    <NeoSelect
                                        size="sm"
                                        placement="top"
                                        value={String(minutes)}
                                        onChange={(val) =>
                                            handleSetTime(hours12, Number(val), ampm)
                                        }
                                        options={MINUTE_OPTIONS}
                                        triggerClassName="!h-8.5 !px-2.5 !py-0 !text-xs !font-black !rounded-xl !bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                        dropdownClassName="max-h-48 shadow-[4px_4px_0px_#000] text-xs font-bold"
                                    />
                                </div>

                                {/* AM / PM Toggle Pill */}
                                <div className="flex items-center rounded-xl border-2 border-black bg-white overflow-hidden shadow-[1.5px_1.5px_0px_#000] shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleSetTime(hours12, minutes, "AM")}
                                        className={`px-3 h-8.5 text-xs font-black cursor-pointer transition-colors flex items-center justify-center ${
                                            ampm === "AM"
                                                ? "bg-black text-white"
                                                : "bg-white text-neutral-600 hover:text-black hover:bg-neutral-50"
                                        }`}
                                    >
                                        AM
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetTime(hours12, minutes, "PM")}
                                        className={`px-3 h-8.5 text-xs font-black cursor-pointer transition-colors border-l-2 border-black flex items-center justify-center ${
                                            ampm === "PM"
                                                ? "bg-black text-white"
                                                : "bg-white text-neutral-600 hover:text-black hover:bg-neutral-50"
                                        }`}
                                    >
                                        PM
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Popover Footer Actions */}
                    <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={handleQuickNow}
                            className="px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black text-[11px] font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px]"
                        >
                            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                            <span>{mode === "datetime" ? "Now" : "Today"}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleClear}
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 hover:text-black border-2 border-black text-[11px] font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1 transition-all"
                            >
                                <X className="w-3 h-3 stroke-[2.5]" />
                                <span>Clear</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    if (onBlur) onBlur();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px]"
                            >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Done</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
