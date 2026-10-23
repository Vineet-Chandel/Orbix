import React, { useState, useEffect, useRef } from "react";
import { Search, Building2, MapPin, ChevronDown, X } from "lucide-react";
import type { ParticipatingCollege } from "./types";

interface CollegeSelectorProps {
    selectedCollege: ParticipatingCollege | null;
    onSelectCollege: (college: ParticipatingCollege) => void;
    participatingColleges: ParticipatingCollege[];
    collegesRepresentedCount: number;
    userCollegeId?: string | null;
    userCollegeName?: string | null;
    isLoading?: boolean;
    onCounterClick?: () => void;
}

export const CollegeSelector: React.FC<CollegeSelectorProps> = ({
    selectedCollege,
    onSelectCollege,
    participatingColleges,
    collegesRepresentedCount,
    userCollegeId,
    userCollegeName: _userCollegeName,
    isLoading: _isLoading = false,
    onCounterClick,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ParticipatingCollege[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Live autocomplete search from database directory
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const endpoints = [
                    `/api/institutions/search?q=${encodeURIComponent(searchQuery)}&limit=15`,
                    `http://localhost:3000/api/institutions/search?q=${encodeURIComponent(searchQuery)}&limit=15`,
                ];

                let res: Response | null = null;
                for (const url of endpoints) {
                    try {
                        res = await fetch(url);
                        if (res.ok) break;
                    } catch {
                        // try next fallback
                    }
                }

                if (res && res.ok) {
                    const data = await res.json();
                    if (data.institutions) {
                        const formatted = data.institutions.map((i: any) => ({
                            id: i.id,
                            officialName: i.officialName,
                            city: i.city,
                            state: i.state,
                            district: i.district,
                            institutionType: i.institutionType,
                            aisheCode: i.aisheCode,
                            totalCoders: participatingColleges.find((p) => p.id === i.id)?.totalCoders || 0,
                            topScore: participatingColleges.find((p) => p.id === i.id)?.topScore || 0,
                        }));
                        setSearchResults(formatted);
                    }
                }
            } catch (err) {
                console.warn("Failed to search colleges:", err);
            } finally {
                setIsSearching(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery, participatingColleges]);

    const handleSelect = (college: ParticipatingCollege) => {
        onSelectCollege(college);
        setIsOpen(false);
        setSearchQuery("");
    };

    return (
        <div className="w-full space-y-4">
            {/* Participating Colleges Counter Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black text-black flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#000]">
                        <Building2 className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase text-neutral-600 tracking-wider">
                                College League Standings
                            </span>
                            {/* Prominent Participating Colleges Counter */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(true);
                                    onCounterClick?.();
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black text-[#a2ff86] border-2 border-black text-[11px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000] hover:bg-neutral-800 transition-colors cursor-pointer"
                                title="Click to browse participating colleges"
                            >
                                <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse" />
                                <span>Colleges Represented · {String(collegesRepresentedCount).padStart(2, "0")}</span>
                            </button>
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-black tracking-tight mt-0.5">
                            {selectedCollege ? selectedCollege.officialName : "Select an Institution to View League"}
                        </h2>
                        {selectedCollege ? (
                            (selectedCollege.city || selectedCollege.state) && (
                                <p className="text-xs font-mono font-bold text-neutral-600 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>{[selectedCollege.city, selectedCollege.state].filter(Boolean).join(", ")}</span>
                                    {selectedCollege.totalCoders !== undefined && (
                                        <>
                                            <span>•</span>
                                            <span className="text-black font-black">{selectedCollege.totalCoders} Eligible Students</span>
                                        </>
                                    )}
                                </p>
                            )
                        ) : (
                            <p className="text-xs font-medium text-neutral-600 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 stroke-[2.5] text-neutral-500" />
                                <span>Choose your campus or search 38,400+ colleges across the country.</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* College Selector Search & Dropdown Trigger */}
                <div className="relative self-start md:self-auto w-full md:w-80" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Search className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                            <span className="truncate">
                                {selectedCollege ? selectedCollege.officialName : "Search & Select a College..."}
                            </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 stroke-[2.5] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-3 space-y-3 animate-fadeIn text-black max-h-[380px] flex flex-col">
                            {/* Search Input */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 stroke-[2.5] pointer-events-none" />
                                <input
                                    type="text"
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Type college name, city, or AISHE..."
                                    className="w-full pl-8 pr-7 py-2 rounded-lg bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown List Body */}
                            <div className="overflow-y-auto space-y-1 pr-1 flex-1">
                                {isSearching ? (
                                    <div className="py-4 text-center text-xs font-bold text-neutral-600">
                                        Searching 38,400+ colleges...
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <>
                                        <div className="px-2 py-1 text-[10px] font-black uppercase text-neutral-500">
                                            Search Directory Results ({searchResults.length})
                                        </div>
                                        {searchResults.map((col) => {
                                            const isSelected = selectedCollege?.id === col.id;
                                            return (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    onClick={() => handleSelect(col)}
                                                    className={`w-full text-left p-2.5 rounded-lg border border-black/10 hover:border-black hover:bg-[#a2ff86]/30 transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                                        isSelected ? "bg-[#a2ff86] border-2 border-black" : "bg-[#FAF6EE]"
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-black text-black leading-tight truncate">
                                                            {col.officialName}
                                                        </p>
                                                        <p className="text-[10px] text-neutral-600 font-medium mt-0.5">
                                                            {[col.city, col.state].filter(Boolean).join(", ")}
                                                        </p>
                                                    </div>
                                                    {(col.totalCoders ?? 0) > 0 && (
                                                        <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-black text-black flex-shrink-0">
                                                            {col.totalCoders} {col.totalCoders === 1 ? "coder" : "coders"}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <>
                                        <div className="px-2 py-1 text-[10px] font-black uppercase text-neutral-500">
                                            Participating Colleges ({participatingColleges.length})
                                        </div>
                                        {participatingColleges.map((col) => {
                                            const isSelected = selectedCollege?.id === col.id;
                                            const isUserCol = userCollegeId && userCollegeId === col.id;
                                            return (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    onClick={() => handleSelect(col)}
                                                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                                        isSelected
                                                            ? "bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                            : "bg-[#FAF6EE] border-black/20 hover:border-black hover:bg-neutral-100"
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="text-xs font-black text-black leading-tight truncate">
                                                                {col.officialName}
                                                            </p>
                                                            {isUserCol && (
                                                                <span className="px-1.5 py-0.2 bg-black text-[#a2ff86] text-[9px] font-black uppercase rounded">
                                                                    Your College
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-neutral-600 font-medium mt-0.5">
                                                            {[col.city, col.state].filter(Boolean).join(", ")}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-black text-black flex-shrink-0 shadow-[1px_1px_0px_#000]">
                                                        {col.totalCoders ?? 0} {(col.totalCoders ?? 0) === 1 ? "coder" : "coders"}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
