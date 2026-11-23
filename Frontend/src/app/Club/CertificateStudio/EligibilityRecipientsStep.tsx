import { RefreshCw } from "lucide-react";
import type { EventEligibilityReport } from "../../../api/certificateStudioApi";
import { RecipientRosterTable, type RosterRecipientItem } from "./RecipientRosterTable";

interface Props {
    report: EventEligibilityReport | null;
    loading: boolean;
    categoryLabel: string;
    categoryRule: string;
    certType: string;
    title: string;
    recipients: RosterRecipientItem[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectMultiple: (ids: string[]) => void;
    onDeselectMultiple: (ids: string[]) => void;
    onDeselectAll: () => void;
    onInspectExclusions: () => void;
    onInspectReview: () => void;
    onRetry: () => void;
}

export function EligibilityRecipientsStep(props: Props) {
    const { report } = props;
    return <div className="space-y-5">
        <div className="border-b-2 border-black/10 pb-4">
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">STEP 2 OF 6</span>
            <h4 className="text-lg font-black text-black mt-1">Eligibility & Recipients</h4>
            <p className="text-xs text-neutral-600 font-medium mt-1">{props.categoryLabel}: {props.categoryRule}</p>
        </div>
        {props.loading ? <div className="p-8 text-center space-y-3" role="status">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
            <p className="text-xs font-bold">Checking registrations and attendance…</p>
        </div> : report ? <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                    { label: "Total signups", count: report.summary.totalRegistrations },
                    { label: "Eligible", count: report.summary.eligibleCount },
                    { label: "Verified attendance", count: report.summary.verifiedAttendeesCount },
                    { label: "Excluded", count: report.summary.ineligibleCount, onClick: props.onInspectExclusions },
                    { label: "Manual review", count: report.summary.manualReviewCount, onClick: props.onInspectReview },
                    { label: "Missing information", count: report.summary.missingInfoCount, onClick: props.onInspectReview },
                    { label: "Team eligible", count: report.summary.teamEligibilityCount },
                    { label: "Already issued", count: report.summary.alreadyIssuedCount },
                ].map((metric) => metric.onClick ? <button key={metric.label} type="button" onClick={metric.onClick}
                    className="p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE] flex items-center justify-between gap-2 hover:bg-[#FFE566]/30 text-left"
                    aria-label={`Inspect ${metric.label.toLowerCase()}: ${metric.count}`}>
                    <span className="font-bold underline decoration-dotted underline-offset-2">{metric.label}</span><strong>{metric.count}</strong>
                </button> : <div key={metric.label} className="p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE] flex items-center justify-between gap-2">
                    <span className="font-bold">{metric.label}</span><strong>{metric.count}</strong>
                </div>)}
            </div>
            <RecipientRosterTable recipients={props.recipients} selectedIds={props.selectedIds}
                onToggleSelect={props.onToggleSelect} onSelectMultiple={props.onSelectMultiple}
                onDeselectMultiple={props.onDeselectMultiple} onDeselectAll={props.onDeselectAll}
                certType={props.certType} requireAttendance={props.certType === "attendance"} title={props.title} showSummary={false} />
        </> : <div className="p-6 text-center space-y-3">
            <p className="text-xs font-bold text-neutral-600">Eligibility could not be loaded. Retry before selecting recipients.</p>
            <button type="button" onClick={props.onRetry} className="px-3 py-1.5 rounded-xl border-2 border-black font-bold text-xs bg-[#FFE566]">Retry eligibility check</button>
        </div>}
    </div>;
}
