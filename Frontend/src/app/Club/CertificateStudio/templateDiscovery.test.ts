import assert from "node:assert/strict";
import { test } from "node:test";
import type { CertificateTemplateRecord } from "../../../types/certificateStudio";
import { recommendTemplates, templatesById, uniqueTemplates } from "./templateDiscovery";

function template(id: string, overrides: Partial<CertificateTemplateRecord> = {}): CertificateTemplateRecord {
    return {
        id, name: id, clubId: null, isSystem: true, status: "published", category: "event", style: "classic",
        orientation: "landscape", pageWidth: 842, pageHeight: 595, backgroundFit: "cover", version: 1,
        design: { background: { type: "color", color: "#fff" }, elements: [] },
        createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
        ...overrides,
    };
}

test("repeated records for one design keep the newest saved revision", () => {
    const newest = template("same", { updatedAt: "2026-11-27T10:00:00Z", version: 2 });
    const oldest = template("same");
    const independent = template("different", { name: newest.name });
    assert.deepEqual(uniqueTemplates([newest, oldest, independent]), [newest, independent]);
});

test("activity preserves order and drops duplicate or unavailable template IDs", () => {
    const records = [template("first"), template("second")];
    assert.deepEqual(templatesById(records, ["second", "unknown", "first", "second"]), [records[1], records[0]]);
});

test("official recommendations apply affinity and exclude private or unpublished entries", () => {
    const formal = template("formal", { category: "academic", style: "academic" });
    const related = template("related", { category: "academic", style: "academic" });
    const other = template("other");
    const privateDraft = template("private", { isSystem: false, clubId: "club" });
    const unpublished = template("draft", { status: "draft" });
    const catalog = [formal, related, other, privateDraft, unpublished];
    const result = recommendTemplates(catalog, [], ["formal"], ["other", "private"], catalog);
    assert.deepEqual(result.map(({ id }) => id), ["formal", "related", "other"]);
});

test("cold-start recommendations diversify equally relevant categories and remain deterministic", () => {
    const catalog = [template("a"), template("b"), template("c", { category: "team" })];
    const rank = (records: CertificateTemplateRecord[]) =>
        recommendTemplates(records, [], [], [], records).map(({ id }) => id);
    assert.deepEqual(rank(catalog), ["a", "c", "b"]);
    assert.deepEqual(rank([...catalog].reverse()), ["a", "c", "b"]);
});
