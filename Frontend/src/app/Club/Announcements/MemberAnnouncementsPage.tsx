import { Link } from 'react-router-dom';
import { ClubAnnouncementsSection } from '../ClubAnnouncementsSection';
export default function MemberAnnouncementsPage() {
    return <div className="min-h-screen bg-[#faf6ee] px-4 py-7 text-black sm:px-8"><div className="w-full"><Link to="/dashboard" className="mb-6 inline-block text-sm font-black underline">← Back to dashboard</Link><ClubAnnouncementsSection /></div></div>;
}
