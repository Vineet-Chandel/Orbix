import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import NavBar from "../NavBar/Landing";
import {
    DOCS_FOLDERS,
    type DocFolder,
} from "../../data/docsRegistry";
import {
    Search,
    Folder,
    FileText,
    Sparkles,
    ArrowRight,
    Clock,
    Cpu,
    Layers,
    Award,
    Terminal,
    Brain,
    Shield,
} from "lucide-react";

export const DocsHubPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFolderId, setSelectedFolderId] = useState<string>("all");

    // Dynamic folder icon resolver
    const getFolderIcon = (iconName: string) => {
        switch (iconName) {
            case "Cpu":
                return <Cpu className="w-5 h-5 text-black" />;
            case "Layers":
                return <Layers className="w-5 h-5 text-black" />;
            case "Award":
                return <Award className="w-5 h-5 text-black" />;
            case "Terminal":
                return <Terminal className="w-5 h-5 text-black" />;
            case "Brain":
                return <Brain className="w-5 h-5 text-black" />;
            case "Shield":
                return <Shield className="w-5 h-5 text-black" />;
            default:
                return <Folder className="w-5 h-5 text-black" />;
        }
    };

    // Filter folders and files based on active folder tab & search query
    const filteredFolders = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        return DOCS_FOLDERS.map((folder) => {
            if (selectedFolderId !== "all" && folder.id !== selectedFolderId) {
                return null;
            }

            const matchingFiles = folder.files.filter((file) => {
                if (!query) return true;
                const inTitle = file.title.toLowerCase().includes(query);
                const inSubtitle = file.subtitle.toLowerCase().includes(query);
                const inSummary = file.summary.toLowerCase().includes(query);
                const inTags = file.tags.some((t) => t.toLowerCase().includes(query));
                return inTitle || inSubtitle || inSummary || inTags;
            });

            if (matchingFiles.length === 0 && query) {
                return null;
            }

            return {
                ...folder,
                files: matchingFiles,
            };
        }).filter(Boolean) as DocFolder[];
    }, [searchQuery, selectedFolderId]);

    const totalFilesCount = useMemo(() => {
        return DOCS_FOLDERS.reduce((acc, f) => acc + f.files.length, 0);
    }, []);

    // Total matching files across currently filtered/displayed folders
    const totalMatchingFiles = useMemo(() => {
        return filteredFolders.reduce((acc, f) => acc + f.files.length, 0);
    }, [filteredFolders]);

    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black font-sans selection:bg-black selection:text-[#a2ff86] relative overflow-x-hidden">
            {/* Global Top Navbar */}
            <NavBar activeTab="docs" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32 space-y-12">
                {/* ========================================================================= */}
                {/* HEADER HERO SECTION                                                      */}
                {/* ========================================================================= */}
                <header className="text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFE566] border-2 border-black text-black font-black text-xs tracking-wider uppercase shadow-[2px_2px_0px_#000] select-none">
                        <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Developer Documentation & Architecture</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-black leading-[1.08]">
                        Orbix Docs Explorer
                    </h1>

                    <p className="text-base sm:text-lg text-neutral-700 font-bold leading-relaxed pt-1">
                        Comprehensive architecture specifications, algorithm documentaries, and developer playbooks organized into modular folders and image-preview document files.
                    </p>

                    {/* Quick Stats Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-3 select-none">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <Cpu className="w-3.5 h-3.5" />
                            Scoring & Ranking Engine
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <Layers className="w-3.5 h-3.5" />
                            {DOCS_FOLDERS.length} Core Folders
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <FileText className="w-3.5 h-3.5" />
                            {totalFilesCount} Inserted Files
                        </span>
                    </div>
                </header>

                {/* ========================================================================= */}
                {/* SEARCH & FOLDER FILTER BAR                                                */}
                {/* ========================================================================= */}
                <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-4 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4">
                    {/* Live Search Input */}
                    <div className="relative w-full">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 stroke-[2.5]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search algorithm, formulas, 16 platforms, college leaderboards, AWS..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[#FAF6EE] border-2 border-black font-bold text-sm sm:text-base text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000] transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-1 rounded-md bg-neutral-200 border border-black hover:bg-neutral-300"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Folder Filter Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-black">
                        <button
                            type="button"
                            onClick={() => setSelectedFolderId("all")}
                            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border-2 border-black shrink-0 ${
                                selectedFolderId === "all"
                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                    : "bg-[#FAF6EE] text-black hover:bg-neutral-200 shadow-[1px_1px_0px_#000]"
                            }`}
                        >
                            All Folders ({totalFilesCount})
                        </button>
                        {DOCS_FOLDERS.map((folder) => (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => setSelectedFolderId(folder.id)}
                                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border-2 border-black shrink-0 flex items-center gap-1.5 ${
                                    selectedFolderId === folder.id
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-black hover:bg-neutral-200 shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                <span>{folder.name}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                                    {folder.files.length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* FOLDERS & INSERTED FILE STRUCTURE (SMART ADAPTIVE ARRANGEMENT)           */}
                {/* ========================================================================= */}
                <div className="space-y-6">
                    {/* Status & Topic Counter */}
                    {filteredFolders.length > 0 && (
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-600 px-1">
                            <span className="font-mono text-neutral-700 font-bold uppercase text-[11px] tracking-wider">
                                Showing {filteredFolders.length} {filteredFolders.length === 1 ? "Architecture Topic" : "Architecture Topics"} ({totalMatchingFiles} {totalMatchingFiles === 1 ? "Documentary" : "Documentaries"})
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline-block">
                                Orbix Technical Specifications
                            </span>
                        </div>
                    )}

                    {filteredFolders.length === 0 ? (
                        <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-12 text-center shadow-[4px_4px_0px_#000] space-y-3">
                            <Folder className="w-12 h-12 mx-auto text-neutral-400 stroke-[1.5]" />
                            <h3 className="text-xl font-black text-black">No matching documentation files</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-md mx-auto">
                                No documentation or guide matches your search query "{searchQuery}". Try searching for "algorithm", "leaderboard", "platforms", or reset filters.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedFolderId("all");
                                }}
                                className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer inline-block mt-2"
                            >
                                Reset Filters
                            </button>
                        </div>
                    ) : (
                        <div
                            className={
                                filteredFolders.length === 1
                                    ? "max-w-2xl mx-auto w-full space-y-8"
                                    : filteredFolders.length === 2 || filteredFolders.length === 4
                                    ? "grid grid-cols-1 md:grid-cols-2 gap-7 items-stretch"
                                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
                            }
                        >
                            {filteredFolders.map((folder) => {
                                const isFolderSingleFile = folder.files.length === 1;

                                return (
                                    <section
                                        key={folder.id}
                                        className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-5 sm:p-6 shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-5 h-full"
                                    >
                                        {/* Folder Block Header */}
                                        <div className="flex items-start gap-3.5 pb-4 border-b-2 border-black/10">
                                            <div className={`p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] shrink-0 mt-0.5 ${folder.color}`}>
                                                {getFolderIcon(folder.icon)}
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-lg sm:text-xl font-black text-black tracking-tight leading-snug">
                                                        {folder.name}
                                                    </h2>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                                        {folder.badge}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-600 font-medium leading-relaxed line-clamp-2">
                                                    {folder.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Inserted Files in Folder: Auto-adapts to 1 file or multi-file */}
                                        <div
                                            className={
                                                isFolderSingleFile
                                                    ? "w-full flex-1 flex flex-col"
                                                    : "grid grid-cols-1 md:grid-cols-2 gap-6"
                                            }
                                        >
                                            {folder.files.map((file) => (
                                                <article
                                                    key={file.id}
                                                    className="w-full rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between overflow-hidden group flex-1"
                                                >
                                                    <div className="w-full">
                                                        {/* Image-like View Header (Thumbnail Banner) */}
                                                        <Link
                                                            to={`/docs/${file.slug}`}
                                                            className="block w-full relative overflow-hidden bg-black border-b-2 border-black shrink-0 h-48 sm:h-52"
                                                        >
                                                            <img
                                                                src={file.image}
                                                                alt={file.title}
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 block"
                                                            />
                                                        </Link>

                                                        {/* File Content Summary */}
                                                        <div className="p-4 sm:p-5 space-y-2.5">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-neutral-600">
                                                                <Clock className="w-3 h-3 text-black" />
                                                                <span>{file.readTime}</span>
                                                                <span>•</span>
                                                                <span className="truncate">{file.author}</span>
                                                            </div>

                                                            <h3 className="text-base sm:text-lg font-black text-black tracking-tight leading-snug group-hover:text-[#008f39] transition-colors line-clamp-2">
                                                                <Link to={`/docs/${file.slug}`}>
                                                                    {file.title}
                                                                </Link>
                                                            </h3>

                                                            <p className="text-xs font-medium text-neutral-600 leading-relaxed line-clamp-2">
                                                                {file.summary}
                                                            </p>

                                                            {/* Tags */}
                                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                                {file.tags.slice(0, 3).map((tag, tIdx) => (
                                                                    <span
                                                                        key={tIdx}
                                                                        className="px-2 py-0.5 rounded-md bg-white border border-neutral-300 text-[10px] font-bold text-neutral-800 shadow-[1px_1px_0px_#eee]"
                                                                    >
                                                                        #{tag}
                                                                    </span>
                                                                ))}
                                                                {file.tags.length > 3 && (
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-black/5 text-[10px] font-mono font-bold text-neutral-600">
                                                                        +{file.tags.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* File Card Footer */}
                                                    <div className="p-3.5 sm:p-4 bg-white border-t-2 border-black flex items-center justify-between gap-3 mt-3">
                                                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                                                            {file.updatedAt}
                                                        </span>

                                                        <Link
                                                            to={`/docs/${file.slug}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-[#FFE566] hover:text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                                        >
                                                            <span>Open File</span>
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default DocsHubPage;
