import type { CertificateTemplateRecord } from "../../../types/certificateStudio";

export function uniqueTemplates(templates: CertificateTemplateRecord[]) {
    const unique = new Map<string, CertificateTemplateRecord>();
    for (const template of templates) {
        const previous = unique.get(template.id);
        if (!previous || Date.parse(template.updatedAt) > Date.parse(previous.updatedAt) || (
            template.updatedAt === previous.updatedAt && template.version > previous.version
        )) {
            unique.set(template.id, template);
        }
    }
    return [...unique.values()];
}

export function templatesById(templates: CertificateTemplateRecord[], ids: string[]) {
    const byId = new Map(templates.map((template) => [template.id, template]));
    return [...new Set(ids)].flatMap((id) => {
        const template = byId.get(id);
        return template ? [template] : [];
    });
}

export function recommendTemplates(
    official: CertificateTemplateRecord[],
    viewedIds: string[],
    usedIds: string[],
    popularIds: string[],
    eligible: CertificateTemplateRecord[],
) {
    const affinity = new Map<string, number>();
    const signal = (template: CertificateTemplateRecord, weight: number) => {
        for (const facet of [`category:${template.category}`, `style:${template.style || template.design?.style || "classic"}`, `orientation:${template.orientation}`]) {
            affinity.set(facet, (affinity.get(facet) || 0) + weight);
        }
    };
    templatesById(official, viewedIds).forEach((template, index) => signal(template, Math.max(1, 10 - index)));
    templatesById(official, usedIds).forEach((template, index) => signal(template, Math.max(4, 18 - index)));

    const popularOrder = new Map(popularIds.map((id, index) => [id, index]));
    const score = (template: CertificateTemplateRecord) =>
        (affinity.get(`category:${template.category}`) || 0) * 3 +
        (affinity.get(`style:${template.style || template.design?.style || "classic"}`) || 0) * 2 +
        (affinity.get(`orientation:${template.orientation}`) || 0) +
        Math.max(0, 20 - (popularOrder.get(template.id) ?? 20));

    const ranked = uniqueTemplates(eligible.filter((template) => template.isSystem && template.status === "published"))
        .map((template) => ({ template, score: score(template) }))
        .sort((a, b) => b.score - a.score ||
            Date.parse(b.template.createdAt) - Date.parse(a.template.createdAt) || a.template.id.localeCompare(b.template.id));

    // Alternate categories when similarly relevant so one certificate family cannot fill the first row.
    const bands = new Map<number, Map<string, CertificateTemplateRecord[]>>();
    for (const { template, score: relevance } of ranked) {
        const band = Math.floor(relevance / 25);
        const categories = bands.get(band) ?? new Map<string, CertificateTemplateRecord[]>();
        const category = categories.get(template.category) ?? [];
        category.push(template);
        categories.set(template.category, category);
        bands.set(band, categories);
    }

    return [...bands.values()].flatMap((categories) => {
        const group = [...categories.values()];
        return Array.from({ length: Math.max(...group.map((templates) => templates.length)) },
            (_, index) => group.flatMap((templates) => templates[index] ? [templates[index]] : []),
        ).flat();
    });
}
