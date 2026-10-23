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
} from "lucide-react";
import { searchInstitutions, type InstitutionItem } from "../utils/profileApi";
import { RequestCollegeModal } from "./RequestCollegeModal";

export interface CollegeAutocompleteProps {
    value?: string | null; // collegeId (UUID)
    selectedCollege?: InstitutionItem | null;
    onChange: (college: InstitutionItem | null) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function CollegeAutocomplete({
    value: _value,
    selectedCollege,
    onChange,
    placeholder = "Search verified Indian colleges, IITs, NITs, universities...",
    disabled = false,
}: CollegeAutocompleteProps) {
    const [queryText, setQueryText] = useState("");
    const [results, setResults] = useState<InstitutionItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                <div className="p-4 rounded-2xl bg-white border border-emerald-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 shadow-2xs">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-extrabold text-neutral-900 truncate tracking-tight">
                                    {selectedCollege.officialName}
                                </h4>
                                {selectedCollege.verificationStatus === "verified" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        <span>Verified</span>
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                                {(selectedCollege.city || selectedCollege.state) && (
                                    <span className="inline-flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-neutral-400" />
                                        <span>{[selectedCollege.city, selectedCollege.state].filter(Boolean).join(", ")}</span>
                                    </span>
                                )}
                                {selectedCollege.institutionType && (
                                    <span className="inline-flex items-center gap-1 text-neutral-600 font-medium">
                                        <Building className="w-3 h-3 text-neutral-400" />
                                        <span>{selectedCollege.institutionType}</span>
                                    </span>
                                )}
                                {selectedCollege.aisheCode && (
                                    <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-600">
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
                                onClick={handleClearSelection}
                                className="px-3 py-1.5 rounded-xl text-neutral-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                title="Change or remove selected institution"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>Change</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Cross-referenced against official AISHE directory & UGC gazette registers.</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Input Container */}
            <div className="relative flex items-center">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />

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
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                />

                <div className="absolute right-3 flex items-center gap-1.5">
                    {isLoading && <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />}
                    {queryText && !isLoading && (
                        <button
                            type="button"
                            onClick={() => {
                                setQueryText("");
                                setResults([]);
                                setIsOpen(false);
                                inputRef.current?.focus();
                            }}
                            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors cursor-pointer"
                            aria-label="Clear search input"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Helper label below input */}
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1 px-1">
                <span>Type at least 2 characters to search by official name, short form (e.g. IIT, NIT, BITS), or city.</span>
                <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors cursor-pointer"
                >
                    Can't find your college?
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && queryText.trim().length >= 2 && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl bg-white border border-neutral-200/90 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Error Banner */}
                    {searchError && (
                        <div className="p-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2 text-rose-800 text-xs">
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
                            className="max-h-72 overflow-y-auto divide-y divide-neutral-100 py-1"
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
                                        className={`px-4 py-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                                            isHighlighted ? "bg-neutral-100/80 text-neutral-900" : "hover:bg-neutral-50 text-neutral-800"
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-neutral-900 tracking-tight leading-snug">
                                                    {item.officialName}
                                                </span>
                                                {item.verificationStatus === "verified" && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                                        Verified
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2.5 text-[11px] text-neutral-500 mt-1 flex-wrap">
                                                {(item.city || item.state) && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-neutral-400" />
                                                        <span>{[item.city, item.state].filter(Boolean).join(", ")}</span>
                                                    </span>
                                                )}
                                                {item.institutionType && (
                                                    <span className="text-neutral-400">• {item.institutionType}</span>
                                                )}
                                                {item.aisheCode && (
                                                    <span className="font-mono text-[9px] bg-neutral-200/60 px-1 rounded text-neutral-600">
                                                        {item.aisheCode}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                        >
                                            Select
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* Empty State */}
                    {!isLoading && hasSearched && results.length === 0 && !searchError && (
                        <div className="p-6 text-center space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                                <Building className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-neutral-800">
                                    No verified institutions found for "{queryText}"
                                </p>
                                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
                                    Only institutions verified against official Ministry of Education / AISHE registers can be selected.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsRequestModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Request College Addition</span>
                            </button>
                        </div>
                    )}

                    {/* Dropdown Footer */}
                    <div className="p-2.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Official Indian Higher Education Directory</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                setIsRequestModalOpen(true);
                            }}
                            className="text-neutral-700 hover:text-black font-semibold cursor-pointer underline-offset-2 hover:underline"
                        >
                            Request Addition
                        </button>
                    </div>
                </div>
            )}

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
