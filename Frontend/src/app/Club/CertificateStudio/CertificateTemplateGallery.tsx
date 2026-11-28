import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { CertificateTemplateRecord } from "../../../types/certificateStudio";
import { CertificateThumbnailPreview } from "./CertificateThumbnailPreview";
import { hasCertificateContent } from "./templateContent";

const actionClass = "rounded-lg border-2 border-black bg-white px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#FFE566]";
const gridClass = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";

function TemplateCard({ template, onOpen, carousel = false }: {
    template: CertificateTemplateRecord;
    onOpen: (template: CertificateTemplateRecord) => void;
    carousel?: boolean;
}) {
    const width = template.design.page?.width || template.design.dimensions?.width || template.pageWidth || 842;
    const height = template.design.page?.height || template.design.dimensions?.height || template.pageHeight || 595;
    const carouselWidth = 1.6 * Math.max(166.4, Math.min(528, 288 * width / height));
    return (
        <button
            type="button"
            aria-label={`Preview ${template.name}`}
            onClick={() => onOpen(template)}
            className={`block min-w-0 cursor-pointer overflow-hidden rounded-xl border-2 border-black bg-white text-left shadow-[3px_3px_0px_#000] transition-shadow hover:shadow-[4px_4px_0px_#000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${carousel ? "h-fit max-w-[85%] shrink-0 snap-start" : "w-full"}`}
            style={carousel ? { width: carouselWidth } : undefined}
        >
            <CertificateThumbnailPreview design={template.design} />
        </button>
    );
}

export function CertificateCarousel({ title, children, action }: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    const row = useRef<HTMLDivElement>(null);

    const scroll = (direction: number) => {
        if (row.current) row.current.scrollBy({ left: direction * row.current.clientWidth * 0.8, behavior: "smooth" });
    };
    return (
        <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
                <div className="flex items-center gap-2">
                    {action}
                    <button type="button" className={actionClass} aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" className={actionClass} aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div ref={row} className="flex snap-x items-start gap-4 overflow-x-auto p-1 pb-3">
                {children}
            </div>
        </section>
    );
}

function TemplateRow({ title, templates, onOpen, action }: {
    title: string;
    templates: CertificateTemplateRecord[];
    onOpen: (template: CertificateTemplateRecord) => void;
    action?: ReactNode;
}) {
    if (!templates.length) return null;
    return (
        <CertificateCarousel title={title} action={action}>
            {templates.map((template) => <TemplateCard key={template.id} template={template} onOpen={onOpen} carousel />)}
        </CertificateCarousel>
    );
}

export function ContinueDesigning({ templates, onOpen }: {
    templates: CertificateTemplateRecord[];
    onOpen: (template: CertificateTemplateRecord) => void;
}) {
    const [limit, setLimit] = useState(6);
    const designs = templates.filter((template) => hasCertificateContent(template.design));
    if (!designs.length) return null;
    return (
        <section className="space-y-4">
            <h2 className="text-lg font-black tracking-tight sm:text-xl">Continue designing</h2>
            <div className={gridClass}>
                {designs.slice(0, limit).map((template) => <TemplateCard key={template.id} template={template} onOpen={onOpen} />)}
            </div>
            {limit < designs.length && (
                <div className="text-center">
                    <button type="button" className={actionClass} onClick={() => setLimit((value) => value + 6)}>Show more</button>
                </div>
            )}
        </section>
    );
}

export function CertificateTemplateGallery({ recommendations, recentlyViewed, recentlyUsed, trending, popular, browseAll, onBrowseChange, onOpen, afterRecommendations }: {
    recommendations: CertificateTemplateRecord[];
    afterRecommendations?: ReactNode;
    recentlyViewed: CertificateTemplateRecord[];
    recentlyUsed: CertificateTemplateRecord[];
    trending: CertificateTemplateRecord[];
    popular: CertificateTemplateRecord[];
    browseAll: boolean;
    onBrowseChange: (browseAll: boolean) => void;
    onOpen: (template: CertificateTemplateRecord) => void;
}) {
    const [visibleCount, setVisibleCount] = useState(12);
    const discoveryHeader = useRef<HTMLHeadingElement>(null);
    const loadMore = useRef<HTMLButtonElement>(null);
    const hasMore = visibleCount < recommendations.length;

    useEffect(() => {
        const element = loadMore.current;
        if (!browseAll || !hasMore || !element || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            setVisibleCount((count) => count + 12);
        }, { rootMargin: "120px" });
        observer.observe(element);
        return () => observer.disconnect();
    }, [browseAll, hasMore, visibleCount]);

    useEffect(() => {
        if (browseAll) discoveryHeader.current?.focus();
    }, [browseAll]);

    return (
        <div className="min-w-0 space-y-8">
            {browseAll ? (
                <>
                    <div className="flex items-center justify-between gap-2">
                        <h2 ref={discoveryHeader} tabIndex={-1} className="text-xl font-black tracking-tight">Discover templates</h2>
                        <button type="button" className={actionClass} onClick={() => { onBrowseChange(false); setVisibleCount(12); }}>Back to overview</button>
                    </div>
                    <TemplateRow title="Recently viewed" templates={recentlyViewed} onOpen={onOpen} />
                    <TemplateRow title="Trending near you" templates={trending} onOpen={onOpen} />
                    <section className="space-y-4">
                        <h3 className="text-lg font-black tracking-tight sm:text-xl">More templates for you</h3>
                        <div className={gridClass}>
                            {recommendations.slice(0, visibleCount).map((template) => (
                                <TemplateCard key={template.id} template={template} onOpen={onOpen} />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="text-center">
                                <button ref={loadMore} type="button" className={actionClass} onClick={() => setVisibleCount((count) => count + 12)}>Load more templates</button>
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <>
                    <TemplateRow
                        title="Templates for you"
                        templates={recommendations.slice(0, 20)}
                        onOpen={onOpen}
                        action={<button type="button" className={actionClass} onClick={() => onBrowseChange(true)}>See all</button>}
                    />
                    {afterRecommendations}
                    <TemplateRow title="Recently used" templates={recentlyUsed} onOpen={onOpen} />
                    <TemplateRow title="Popular on Orbix" templates={popular} onOpen={onOpen} />
                </>
            )}
            {!recommendations.length && <p className="rounded-xl border-2 border-black bg-white p-4 text-sm font-bold">No official templates in this category yet.</p>}
        </div>
    );
}
