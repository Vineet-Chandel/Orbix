// Frontend/src/app/Club/TeamWorkspace/Search/WorkspaceSearchModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Search,
    X,
    Hash,
    MessageSquare,
    Users,
    FolderKanban,
    ListTodo,
    FileText,
    CornerDownLeft,
    Loader2,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceSearchResultItem,
    WorkspaceSearchResponse,
} from "../../../../types/workspace";

interface WorkspaceSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    onSelectResult: (result: WorkspaceSearchResultItem) => void;
}

const SEARCH_CATEGORIES = [
    { label: "All Results", value: "" },
    { label: "Tasks", value: "task" },
    { label: "Channels", value: "channel" },
    { label: "Messages", value: "message" },
    { label: "Members", value: "member" },
    { label: "Departments", value: "department" },
    { label: "Files", value: "file" },
];

export const WorkspaceSearchModal: React.FC<WorkspaceSearchModalProps> = ({
    isOpen,
    onClose,
    clubId,
    onSelectResult,
}) => {
    const [query, setQuery] = useState("");
    const [selectedType, setSelectedType] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<WorkspaceSearchResponse | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Focus on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery("");
            setSearchResults(null);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Keyboard navigation (Escape, Up, Down, Enter)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    const count = searchResults?.results.length || 0;
                    return count > 0 ? (prev + 1) % count : 0;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    const count = searchResults?.results.length || 0;
                    return count > 0 ? (prev - 1 + count) % count : 0;
                });
            } else if (e.key === "Enter") {
                const results = searchResults?.results || [];
                if (results[selectedIndex]) {
                    e.preventDefault();
                    onSelectResult(results[selectedIndex]);
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, searchResults, selectedIndex, onSelectResult, onClose]);

    // Perform Search with debounce
    const performSearch = useCallback(
        async (q: string, type: string) => {
            if (!q.trim()) {
                setSearchResults(null);
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const res = await workspaceApi.searchWorkspace(q.trim(), {
                    clubId,
                    type: type || undefined,
                    limit: 30,
                });
                if (res?.data) {
                    setSearchResults(res.data);
                    setSelectedIndex(0);
                }
            } catch (err) {
                console.error("Workspace search failed:", err);
            } finally {
                setLoading(false);
            }
        },
        [clubId]
    );

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            performSearch(val, selectedType);
        }, 250);
    };

    const handleCategoryClick = (type: string) => {
        setSelectedType(type);
        performSearch(query, type);
    };

    const getItemIcon = (type: WorkspaceSearchResultItem["type"]) => {
        switch (type) {
            case "task":
                return <ListTodo className="w-4 h-4 text-indigo-600" />;
            case "channel":
                return <Hash className="w-4 h-4 text-cyan-600" />;
            case "message":
                return <MessageSquare className="w-4 h-4 text-emerald-600" />;
            case "member":
                return <Users className="w-4 h-4 text-amber-600" />;
            case "department":
                return <FolderKanban className="w-4 h-4 text-purple-600" />;
            case "file":
                return <FileText className="w-4 h-4 text-rose-600" />;
            default:
                return <Search className="w-4 h-4 text-slate-500" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center p-4 sm:pt-20">
            <div className="bg-white border-2 border-black rounded-2xl max-w-2xl w-full shadow-neo overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
                {/* Search Bar Input */}
                <div className="p-4 border-b-2 border-black flex items-center gap-3 bg-neutral-50">
                    <Search className="w-5 h-5 text-neutral-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Search channels, messages, tasks, files, members..."
                        className="w-full text-sm font-bold bg-transparent border-none focus:outline-none placeholder:text-neutral-400 placeholder:font-normal"
                    />
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-neutral-500 shrink-0" />}
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-500 hover:text-black transition shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Category Pills */}
                <div className="px-4 py-2.5 border-b border-neutral-200 bg-white flex items-center gap-1.5 overflow-x-auto text-xs font-black">
                    {SEARCH_CATEGORIES.map((cat) => {
                        const count = cat.value
                            ? searchResults?.countsByType?.[cat.value]
                            : searchResults?.total;

                        return (
                            <button
                                key={cat.value}
                                onClick={() => handleCategoryClick(cat.value)}
                                className={`px-2.5 py-1 rounded-lg border transition shrink-0 flex items-center gap-1.5 ${
                                    selectedType === cat.value
                                        ? "bg-black text-white border-black"
                                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300"
                                }`}
                            >
                                <span>{cat.label}</span>
                                {count !== undefined && count > 0 && (
                                    <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                            selectedType === cat.value
                                                ? "bg-white/20 text-white"
                                                : "bg-white text-neutral-800 border border-neutral-200"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2 divide-y divide-neutral-100">
                    {!query.trim() ? (
                        <div className="py-12 text-center text-xs text-neutral-500">
                            Type to begin searching across all permitted workspace channels, tasks, and files.
                        </div>
                    ) : loading && (!searchResults || searchResults.results.length === 0) ? (
                        <div className="py-12 text-center text-xs text-neutral-500">
                            Searching workspace...
                        </div>
                    ) : searchResults?.results.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-sm font-bold text-neutral-700">No matching results found.</p>
                            <p className="text-xs text-neutral-500 mt-1">
                                We searched all channels, tasks, files, and members you have access to.
                            </p>
                        </div>
                    ) : (
                        searchResults?.results.map((item, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => {
                                        onSelectResult(item);
                                        onClose();
                                    }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 ${
                                        isSelected
                                            ? "bg-neutral-100 border-2 border-black -my-[1px]"
                                            : "hover:bg-neutral-50"
                                    }`}
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="p-2 bg-white border border-neutral-300 rounded-lg shrink-0 mt-0.5">
                                            {getItemIcon(item.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                    {item.type}
                                                </span>
                                                {item.departmentName && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-neutral-200/80 rounded">
                                                        {item.departmentName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs font-bold text-black truncate mt-0.5">
                                                {item.title}
                                            </div>
                                            {item.snippet && (
                                                <p className="text-xs text-neutral-600 line-clamp-1 mt-0.5">
                                                    {item.snippet}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-neutral-600 shrink-0 mt-2">
                                            <span>Press Enter</span>
                                            <CornerDownLeft className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Hotkey Guide */}
                <div className="px-4 py-2 border-t-2 border-black bg-neutral-50 flex items-center justify-between text-[11px] font-bold text-neutral-500">
                    <div className="flex items-center gap-4">
                        <span>↑↓ to navigate</span>
                        <span>↵ to select</span>
                        <span>esc to close</span>
                    </div>
                    <span>{searchResults?.total || 0} results</span>
                </div>
            </div>
        </div>
    );
};
