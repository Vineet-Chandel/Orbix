import React from "react";
import { useParams, Link } from "react-router-dom";
import NavBar from "../NavBar/Landing";
import { getDocBySlug, ALL_DOC_FILES } from "../../data/docsRegistry";
import AlgorithmDocumentary from "./documentaries/AlgorithmDocumentary";
import PlatformRegistryDocumentary from "./documentaries/PlatformRegistryDocumentary";
import ResumeIntelligenceDocumentary from "./documentaries/ResumeIntelligenceDocumentary";
import {
    ArrowLeft,
    FileText,
    CheckCircle2,
    ArrowRight,
} from "lucide-react";

export const DocsViewerPage: React.FC = () => {
    const { slug, pageId, docId } = useParams<{ slug?: string; pageId?: string; docId?: string }>();
    const activeSlug = (slug || docId || pageId || "orbix-score-algorithm").toLowerCase();

    // Map common aliases
    const resolvedSlug =
        activeSlug === "algorithm" || activeSlug === "scoring" || activeSlug === "leaderboard"
            ? "orbix-score-algorithm"
            : activeSlug === "platforms" || activeSlug === "platform-registry" || activeSlug === "connected-platforms"
            ? "supported-platform-registry"
            : activeSlug === "resume" || activeSlug === "resume-analytics" || activeSlug === "resume-algorithm" || activeSlug === "resume-intelligence" || activeSlug === "resume-intelligence-algorithm"
            ? "resume-intelligence-algorithm"
            : activeSlug;

    // Check if doc exists in registry
    const doc = getDocBySlug(resolvedSlug);

    // Related docs from registry
    const relatedDocs = ALL_DOC_FILES.filter((f) => f.slug !== resolvedSlug).slice(0, 3);

    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black font-sans selection:bg-black selection:text-[#a2ff86] relative overflow-x-hidden">
            {/* Global Navigation */}
            <NavBar activeTab="docs" />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 sm:pt-32 sm:pb-32 space-y-8">
                {/* ========================================================================= */}
                {/* BREADCRUMB NAVIGATION & BACK BUTTON                                       */}
                {/* ========================================================================= */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                        <Link
                            to="/docs"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-black hover:bg-neutral-100 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Docs Explorer</span>
                        </Link>
                        <span>/</span>
                        <span className="font-mono text-neutral-800">{doc?.folderName || "Documentation"}</span>
                        <span>/</span>
                        <span className="text-black font-black truncate max-w-[200px] sm:max-w-sm">
                            {doc?.title || "Documentary"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                            Verified Specification
                        </span>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* MAIN DOCUMENTARY BODY                                                     */}
                {/* ========================================================================= */}
                {resolvedSlug === "orbix-score-algorithm" ? (
                    <AlgorithmDocumentary />
                ) : resolvedSlug === "supported-platform-registry" ? (
                    <PlatformRegistryDocumentary />
                ) : resolvedSlug === "resume-intelligence-algorithm" ? (
                    <ResumeIntelligenceDocumentary />
                ) : doc ? (
                    <article className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                        <header className="space-y-4 pb-6 border-b-2 border-black/15">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-[#a2ff86] border-2 border-black">
                                    {doc.badge}
                                </span>
                                <span className="text-xs font-mono font-bold text-neutral-500">
                                    {doc.readTime}
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-black">
                                {doc.title}
                            </h1>
                            <p className="text-base sm:text-lg font-bold text-neutral-700">
                                {doc.subtitle}
                            </p>
                        </header>

                        <div className="rounded-2xl border-2 border-black overflow-hidden bg-black shadow-[4px_4px_0px_#000] w-full">
                            <img src={doc.image} alt={doc.title} className="w-full h-auto block" />
                        </div>

                        <div className="space-y-4 text-neutral-800 text-sm sm:text-base leading-relaxed font-medium">
                            <p>{doc.summary}</p>
                            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <h3 className="font-black text-black">Key Topics Covered:</h3>
                                <ul className="space-y-1.5">
                                    {doc.tags.map((tag, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>{tag} Integration and Architectural Guarantees</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </article>
                ) : (
                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-10 text-center shadow-[4px_4px_0px_#000] space-y-4">
                        <FileText className="w-12 h-12 mx-auto text-neutral-400 stroke-[1.5]" />
                        <h2 className="text-2xl font-black text-black">Document Not Found</h2>
                        <p className="text-sm text-neutral-600 font-bold max-w-md mx-auto">
                            The requested document "{activeSlug}" could not be located.
                        </p>
                        <Link
                            to="/docs"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Return to Docs Explorer</span>
                        </Link>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* RELATED DOCUMENTATION FILES                                               */}
                {/* ========================================================================= */}
                <section className="pt-8 border-t-2 border-black/15 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-black">Explore Related Documents</h3>
                            <p className="text-xs font-bold text-neutral-600">More architecture specifications and engineering workbooks</p>
                        </div>
                        <Link
                            to="/docs"
                            className="text-xs font-black text-black hover:underline flex items-center gap-1"
                        >
                            <span>View All Files</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {relatedDocs.map((item) => (
                            <Link
                                key={item.id}
                                to={`/docs/${item.slug}`}
                                className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-2">
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-neutral-700">
                                        {item.folderName}
                                    </span>
                                    <h4 className="font-black text-xs sm:text-sm text-black line-clamp-2 leading-snug">
                                        {item.title}
                                    </h4>
                                    <p className="text-[11px] text-neutral-600 font-medium line-clamp-2">
                                        {item.summary}
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-neutral-200 flex justify-between items-center text-[10px] font-mono font-bold text-neutral-500">
                                    <span>{item.readTime}</span>
                                    <span className="text-black font-black flex items-center gap-1">
                                        Read <ArrowRight className="w-2.5 h-2.5" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default DocsViewerPage;
