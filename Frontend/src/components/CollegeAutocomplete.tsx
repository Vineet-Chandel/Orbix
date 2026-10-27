import React, { useState, useEffect, useRef } from "react";
import {
    Search,
    GraduationCap,
    CheckCircle2,
    MapPin,
    Building,
    X,
    Loader2,
    PlusCircle,
    ShieldCheck,
    AlertCircle,
    Lock,
    Clock,
} from "lucide-react";
import { searchInstitutions, type InstitutionItem } from "../utils/profileApi";
import { RequestCollegeModal } from "./RequestCollegeModal";
import { CollegeChangeWarningModal } from "./CollegeChangeWarningModal";

export interface CollegeAutocompleteProps {
    value?: string | null; // collegeId (UUID)
    selectedCollege?: InstitutionItem | null;
    onChange: (college: InstitutionItem | null) => void;
    placeholder?: string;
    disabled?: boolean;
    canChangeCollege?: boolean;
    collegeUpdatedAt?: string | null;
    collegeLockRemainingMs?: number;
    nextAllowedCollegeChangeAt?: string | null;
}

export function CollegeAutocomplete({
    value: _value,
    selectedCollege,
    onChange,
    placeholder = "Search verified Indian colleges, IITs, NITs, universities...",
    disabled = false,
    canChangeCollege = true,
    collegeUpdatedAt: _collegeUpdatedAt,
    collegeLockRemainingMs = 0,
    nextAllowedCollegeChangeAt,
}: CollegeAutocompleteProps) {
    const [queryText, setQueryText] = useState("");
    const [results, setResults] = useState<InstitutionItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Close dropdown when clicking outside (mouse and touch)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Global Escape key listener when dropdown is open
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isOpen]);

    // Debounced search with AbortController
    useEffect(() => {
        const trimmed = queryText.trim();

        // If query is too short, reset
        if (trimmed.length < 2) {
            setResults([]);
            setIsLoading(false);
            setHasSearched(false);
            setSearchError(null);
            return;
        }

        // Abort previous in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setSearchError(null);

        const debounceTimer = setTimeout(async () => {
            try {
                const data = await searchInstitutions(trimmed, {
                    limit: 15,
                    signal: controller.signal,
                });
                setResults(data);
                setHasSearched(true);
                setHighlightedIndex(data.length > 0 ? 0 : -1);
            } catch (err: any) {
                if (
                    err?.name === "AbortError" ||
                    controller.signal.aborted ||
                    String(err?.message || "").toLowerCase().includes("abort")
                ) {
                    return; // Ignore aborted fetches
                }
                console.error("Institution autocomplete error:", err);
                setSearchError("Failed to search institutions. Check your connection.");
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(debounceTimer);
            controller.abort();
        };
    }, [queryText]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedIndex >= 0 && listboxRef.current) {
            const item = listboxRef.current.children[highlightedIndex] as HTMLElement;
            if (item) {
                item.scrollIntoView({ block: "nearest" });
            }
        }
    }, [highlightedIndex]);

    // Handle Keyboard Navigation (ARIA Combobox)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
                break;
            case "Enter":
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < results.length) {
                    handleSelect(results[highlightedIndex]);
                } else if (results.length > 0) {
                    handleSelect(results[0]);
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                break;
            case "Tab":
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (item: InstitutionItem) => {
        onChange(item);
        setIsOpen(false);
        setQueryText("");
        setResults([]);
    };

    const handleClearSelection = () => {
        onChange(null);
        setQueryText("");
        setResults([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // If an institution is currently selected, display the verified selection badge card
    if (selectedCollege) {
        return (
            <div className="w-full space-y-2">
                <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center flex-shrink-0 text-black shadow-[1px_1px_0px_#000]">
                            <GraduationCap className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-black truncate tracking-tight">
                                    {selectedCollege.officialName}
                                </h4>
                                {selectedCollege.verificationStatus === "verified" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                        <ShieldCheck className="w-3 h-3 text-black stroke-[2.5]" />
                                        <span>Verified</span>
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-neutral-600 font-semibold mt-0.5 flex-wrap">
                                {(selectedCollege.city || selectedCollege.state) && (
                                    <span className="inline-flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-neutral-500" />
                                        <span>{[selectedCollege.city, selectedCollege.state].filter(Boolean).join(", ")}</span>
                                    </span>
                                )}
                                {selectedCollege.institutionType && (
                                    <span className="inline-flex items-center gap-1 text-black font-bold">
                                        <Building className="w-3 h-3 text-neutral-500" />
                                        <span>{selectedCollege.institutionType}</span>
                                    </span>
                                )}
                                {selectedCollege.aisheCode && (
                                    <span className="font-mono text-[10px] bg-neutral-100 border border-black/40 px-1.5 py-0.2 rounded font-bold text-black">
                                        AISHE: {selectedCollege.aisheCode}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {!disabled && (
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                            <button
                                type="button"
                                onClick={() => setIsWarningModalOpen(true)}
                                className={`px-3 py-1.5 rounded-lg text-black border-2 border-black text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${
                                    canChangeCollege === false ? "bg-amber-100 hover:bg-amber-200" : "hover:bg-neutral-100"
                                }`}
                                title={canChangeCollege === false ? "College affiliation is locked for 3 days" : "Change or remove selected institution"}
                            >
                                {canChangeCollege === false ? (
                                    <>
                                        <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Locked</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Change</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {canChangeCollege === false ? (
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-amber-800 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 stroke-[2.5]" />
                        <span>College identity locked (3-day cooldown active). Click Locked button to view status.</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-600 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-black flex-shrink-0 stroke-[2.5]" />
                        <span>Cross-referenced against official AISHE directory & UGC gazette registers.</span>
                    </div>
                )}

                {/* College Change / Deletion Warning & Cooldown Modal */}
                <CollegeChangeWarningModal
                    isOpen={isWarningModalOpen}
                    onClose={() => setIsWarningModalOpen(false)}
                    onConfirm={handleClearSelection}
                    currentCollegeName={selectedCollege.officialName}
                    isLocked={canChangeCollege === false}
                    remainingMs={collegeLockRemainingMs}
                    nextAllowedDate={nextAllowedCollegeChangeAt}
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full"
            onBlur={(e) => {
                if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
                    setIsOpen(false);
                }
            }}
        >
            {/* Backdrop overlay for clean click-outside and visual separation */}
            {isOpen && queryText.trim().length >= 2 && (
                <div
                    className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[0.5px] transition-opacity cursor-default"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Input Container */}
            <div className="relative">
                <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 pointer-events-none stroke-[2.5]" />

                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-autocomplete="list"
                        aria-controls="institution-search-listbox"
                        aria-activedescendant={
                            highlightedIndex >= 0 ? `inst-option-${highlightedIndex}` : undefined
                        }
                        disabled={disabled}
                        value={queryText}
                        onChange={(e) => {
                            setQueryText(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => {
                            if (queryText.trim().length >= 2) setIsOpen(true);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                    />

                    <div className="absolute right-3 flex items-center gap-1.5">
                        {isLoading && <Loader2 className="w-4 h-4 text-black animate-spin" />}
                        {queryText && !isLoading && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQueryText("");
                                    setResults([]);
                                    setIsOpen(false);
                                    inputRef.current?.focus();
                                }}
                                className="p-1 rounded-md text-neutral-500 hover:text-black hover:bg-neutral-200/50 transition-colors cursor-pointer"
                                aria-label="Clear search input"
                            >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Dropdown Menu - Directly attached under input with elevated z-index */}
                {isOpen && queryText.trim().length >= 2 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-2 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Dropdown Header */}
                        <div className="px-3.5 py-2.5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between text-xs font-black text-black">
                            <div className="flex items-center gap-1.5">
                                <Building className="w-4 h-4 text-black stroke-[2.5]" />
                                <span>Institutions matching "{queryText}" {results.length > 0 && `(${results.length})`}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-neutral-500 hover:text-black font-black text-xs px-2 py-0.5 rounded-md hover:bg-black/10 transition-colors cursor-pointer flex items-center gap-1"
                                aria-label="Close search dropdown"
                            >
                                <span>Close</span>
                                <span className="font-mono text-[10px] bg-neutral-200 px-1 py-0.5 rounded">Esc</span>
                            </button>
                        </div>

                        {/* Error Banner */}
                        {searchError && (
                            <div className="p-3 bg-rose-50 border-b-2 border-black flex items-center gap-2 text-rose-800 text-xs font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span>{searchError}</span>
                            </div>
                        )}

                        {/* Results List */}
                        {results.length > 0 && (
                            <ul
                                ref={listboxRef}
                                id="institution-search-listbox"
                                role="listbox"
                                className="max-h-64 overflow-y-auto divide-y-2 divide-neutral-100 py-1"
                            >
                                {results.map((item, idx) => {
                                    const isHighlighted = idx === highlightedIndex;
                                    return (
                                        <li
                                            key={item.id}
                                            id={`inst-option-${idx}`}
                                            role="option"
                                            aria-selected={isHighlighted}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            onClick={() => handleSelect(item)}
                                            className={`group px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                                isHighlighted
                                                    ? "bg-[#FFE566]/25 border-l-4 border-l-black pl-3"
                                                    : "hover:bg-neutral-50 border-l-4 border-l-transparent pl-3"
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-black tracking-tight leading-snug">
                                                        {item.officialName}
                                                    </span>
                                                    {item.verificationStatus === "verified" && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[9px] font-black text-black shadow-[1px_1px_0px_#000]">
                                                            <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>Verified</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2.5 text-[11px] text-neutral-600 font-semibold mt-1 flex-wrap">
                                                    {(item.city || item.state) && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-neutral-500" />
                                                            <span>{[item.city, item.state].filter(Boolean).join(", ")}</span>
                                                        </span>
                                                    )}
                                                    {item.institutionType && (
                                                        <span className="text-neutral-500">• {item.institutionType}</span>
                                                    )}
                                                    {item.aisheCode && (
                                                        <span className="font-mono text-[9px] bg-neutral-100 border border-black/30 px-1 rounded font-bold text-neutral-800">
                                                            {item.aisheCode}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(item);
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer"
                                            >
                                                <span>Select</span>
                                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {/* Empty State */}
                        {!isLoading && hasSearched && results.length === 0 && !searchError && (
                            <div className="p-6 text-center space-y-3">
                                <div className="w-11 h-11 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto text-black shadow-[2px_2px_0px_#000]">
                                    <Building className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-black">
                                        No verified institutions found for "{queryText}"
                                    </p>
                                    <p className="text-[11px] text-neutral-600 max-w-sm mx-auto leading-relaxed font-medium">
                                        Only institutions verified against official Ministry of Education / AISHE registers can be selected.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsRequestModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-transform hover:scale-[1.02] cursor-pointer"
                                >
                                    <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Request College Addition</span>
                                </button>
                            </div>
                        )}

                        {/* Dropdown Footer */}
                        <div className="p-2.5 bg-[#FAF6EE] border-t-2 border-black flex items-center justify-between text-[11px] font-bold text-neutral-700">
                            <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                <span>Official Indian Higher Education Directory</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsRequestModalOpen(true);
                                }}
                                className="text-black hover:underline font-black cursor-pointer underline-offset-2"
                            >
                                Request Addition
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Helper label below input */}
            <div className="flex items-center justify-between text-[11px] text-neutral-600 font-semibold mt-1.5 px-1">
                <span>Type at least 2 characters to search by official name, short form (e.g. IIT, NIT, BITS), or city.</span>
                <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(true)}
                    className="text-black underline hover:text-neutral-700 font-black transition-colors cursor-pointer"
                >
                    Can't find your college?
                </button>
            </div>

            <div className="flex items-center gap-1.5 px-1 mt-1 text-[11px] text-neutral-600 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-black flex-shrink-0 stroke-[2.5]" />
                <span>Selected college identity will be locked for 3 days once saved to your profile.</span>
            </div>

            {/* Request College Modal */}
            <RequestCollegeModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                initialQuery={queryText}
                onSubmitted={() => {
                    setIsRequestModalOpen(false);
                }}
            />
        </div>
    );
}
