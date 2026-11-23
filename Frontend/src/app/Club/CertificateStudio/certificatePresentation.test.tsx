import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";
import { RecipientRosterTable } from "./RecipientRosterTable";
import { EligibilityRecipientsStep } from "./EligibilityRecipientsStep";
import type { EventEligibilityReport } from "../../../api/certificateStudioApi";
import { hasCertificateContent } from "./templateContent";
import type { CertificateDesign } from "../../../types/certificateStudio";
import { SYSTEM_CERTIFICATE_TEMPLATES } from "../../../../../Backend/src/services/club/systemCertificateTemplates";

// Fonts are loaded by Vite in the app; Node only needs the markup for these checks.
const cssHook = registerHooks({ load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    return nextLoad(url, context);
} });
const { CertificateThumbnailPreview } = await import("./CertificateThumbnailPreview");
cssHook.deregister();

test("saved text aliases, flat styles and background assets render in previews", () => {
    const design: CertificateDesign = {
        dimensions: { width: 600, height: 400, orientation: "landscape" },
        background: { type: "image", assetUrl: "https://example.test/art.png" },
        elements: [
            { id: "title", type: "text", content: "Certificate of Merit", x: 50, y: 40, width: 500, height: 40, zIndex: 1, fontSize: 32, color: "#123456", fontWeight: "700" },
            { id: "name", type: "dynamic_text", fieldKey: "recipient.name", x: 50, y: 100, width: 500, height: 40, zIndex: 2 },
            { id: "hidden", type: "text", content: "Hidden text", x: 0, y: 0, width: 100, height: 30, zIndex: 3, isHidden: true },
        ],
    };
    const html = renderToStaticMarkup(<CertificateThumbnailPreview design={design} sampleRecipientName="Aarav Sharma" />);
    assert.match(html, /viewBox="0 0 600 400"/);
    assert.match(html, /href="https:\/\/example.test\/art.png"/);
    assert.match(html, /Certificate of Merit/);
    assert.match(html, /Aarav Sharma/);
    assert.match(html, /font-size="32"/);
    assert.match(html, /fill="#123456"/);
    assert.match(html, /font-weight="700"/);
    assert.doesNotMatch(html, /Hidden text/);
});

test("empty canvases stay distinguishable from usable text and artwork templates", () => {
    const blank: CertificateDesign = { background: { type: "color", color: "#ffffff" }, elements: [] };
    assert.equal(hasCertificateContent(blank), false);
    assert.match(renderToStaticMarkup(<CertificateThumbnailPreview design={blank} />), /Empty template/);
    assert.equal(hasCertificateContent({ ...blank, background: { type: "image", assetUrl: "art.png" } }), true);
    assert.equal(hasCertificateContent({ ...blank, elements: [{ id: "name", type: "dynamic_text", fieldKey: "recipient.name", x: 0, y: 0, width: 100, height: 30, zIndex: 1 }] }), true);
});

test("every official template contains visible certificate text", () => {
    for (const template of SYSTEM_CERTIFICATE_TEMPLATES) {
        assert.equal(hasCertificateContent(template.design), true, template.name);
        const html = renderToStaticMarkup(<CertificateThumbnailPreview design={template.design} sampleRecipientName="Test Recipient" />);
        assert.match(html, /<text/, template.name);
        assert.match(html, /Test Recipient/, template.name);
        assert.doesNotMatch(html, /Empty template/, template.name);
    }
});

function roster(count: number, selected = false) {
    const recipients = Array.from({ length: count }, (_, index) => ({ id: String(index), name: `Recipient ${index}`, email: `${index}@example.test`, username: `user${index}`, isEligible: true }));
    return renderToStaticMarkup(<RecipientRosterTable recipients={recipients}
        selectedIds={new Set(selected ? recipients.map((recipient) => recipient.id) : [])}
        onToggleSelect={() => {}} onSelectMultiple={() => {}} onDeselectMultiple={() => {}} onDeselectAll={() => {}} />);
}

test("small fully selected rosters do not show redundant actions or pagination", () => {
    const html = roster(3, true);
    assert.match(html, /3 selected/);
    assert.match(html, /Deselect All/);
    assert.doesNotMatch(html, /Select All Eligible|per page:|Page 1 of|Selected Total|Attended Only|Eligible Only/);
    assert.doesNotMatch(html, /Award Position|Custom Role|Custom position/);
});

const auditReport: EventEligibilityReport = {
    eventId: "event", eventTitle: "Workshop", eventStartsAt: null, category: "participation",
    summary: { totalRegistrations: 8, eligibleCount: 5, verifiedAttendeesCount: 4, ineligibleCount: 3, manualReviewCount: 2, missingInfoCount: 2, teamEligibilityCount: 1, alreadyIssuedCount: 1 },
    eligibleRecipients: [], ineligibleRecipients: [], manualReviewCases: [],
};
const stepProps = {
    report: auditReport, loading: false, categoryLabel: "Event Participation", categoryRule: "Valid event registration with accepted status.",
    certType: "participation", title: "Event Roster", selectedIds: new Set<string>(),
    recipients: [{ id: "excluded", name: "Excluded Student", username: "excluded", email: "excluded@example.test", isEligible: false, exclusionReason: "Registration cancelled" }],
    onToggleSelect() {}, onSelectMultiple() {}, onDeselectMultiple() {}, onDeselectAll() {}, onInspectExclusions() {}, onInspectReview() {}, onRetry() {},
};

test("merged step retains all audit criteria and exclusions beside recipient selection", () => {
    const html = renderToStaticMarkup(<EligibilityRecipientsStep {...stepProps} />);
    for (const label of ["Total signups", "Eligible", "Verified attendance", "Excluded", "Manual review", "Missing information", "Team eligible", "Already issued"]) {
        assert.ok(html.includes(label), label);
    }
    assert.match(html, /Inspect excluded: 3/);
    assert.match(html, /Inspect manual review: 2/);
    assert.match(html, /Inspect missing information: 2/);
    assert.match(html, /Excluded Student/);
    assert.match(html, /Registration cancelled/);
    assert.match(html, /STEP 2 OF 6/);
    assert.doesNotMatch(html, /Total Roster:|Award Position|Custom position/);
});

test("merged step hides stale recipients while checking eligibility and offers retry on failure", () => {
    const loading = renderToStaticMarkup(<EligibilityRecipientsStep {...stepProps} loading />);
    assert.match(loading, /Checking registrations and attendance/);
    assert.doesNotMatch(loading, /Excluded Student/);
    const failed = renderToStaticMarkup(<EligibilityRecipientsStep {...stepProps} report={null} />);
    assert.match(failed, /Retry eligibility check/);
    assert.doesNotMatch(failed, /Excluded Student/);
});

test("large rosters render only the current page and offer relevant pagination", () => {
    const html = roster(60);
    assert.match(html, /Select All Eligible/);
    assert.match(html, /Recipients per page:/);
    assert.match(html, /Page 1 of 3/);
    assert.match(html, /Recipient 24</);
    assert.doesNotMatch(html, /Recipient 25</);
});
