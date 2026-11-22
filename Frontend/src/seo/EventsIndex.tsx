import EventTrackerPage from '../app/Events/EventTrackerPage';
import PublicEventPage from './PublicEventPage';
import type { PageData } from '../../../shared/seo/metadata';
/** Preserve the contest tracker; add crawlable published events as a separate section. */
export default function EventsIndex({ initialData }: { initialData?: PageData }) {
    return <><EventTrackerPage /><PublicEventPage initialData={initialData} embedded /></>;
}
