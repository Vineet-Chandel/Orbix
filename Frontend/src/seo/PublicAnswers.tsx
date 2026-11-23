import { Link } from 'react-router-dom';

export function PublicAnswers() {
    return null;
}

export default function AboutPage() {
    return (
        <main className="max-w-5xl mx-auto p-6 py-16 space-y-8 bg-[#FAF6EE] min-h-screen">
            <Link to="/" className="inline-flex items-center gap-2 font-bold underline hover:text-neutral-700">
                ← Orbix home
            </Link>
            <h1 className="text-4xl font-black">About Orbix</h1>
            <p className="text-lg text-neutral-700 leading-relaxed font-medium">
                Orbix brings connected developer profiles, contest tracking, verified credentials, and campus communities together into a single unified platform.
            </p>
            <div className="grid gap-6 md:grid-cols-2 pt-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                    <h3 className="font-bold text-lg">Developer Portfolios</h3>
                    <p className="text-sm text-neutral-600 font-medium">
                        Connect LeetCode, Codeforces, GitHub, and 16+ platforms into a verified developer profile with zero password sharing.
                    </p>
                </div>
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                    <h3 className="font-bold text-lg">Campus Club Ecosystem</h3>
                    <p className="text-sm text-neutral-600 font-medium">
                        Organize hackathons, issue cryptographically verifiable certificates, and coordinate member teams in one place.
                    </p>
                </div>
            </div>
            <nav aria-label="Explore Orbix" className="flex flex-wrap gap-5 pt-4 text-sm font-bold underline">
                <Link to="/docs">Documentation</Link>
                <Link to="/blogs">Engineering workbooks</Link>
                <Link to="/privacy">Privacy policy</Link>
            </nav>
        </main>
    );
}
