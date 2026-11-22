import { Link } from 'react-router-dom';
export function PublicAnswers() {
    return <section aria-labelledby="orbix-explained" className="mx-auto max-w-5xl px-5 py-12 space-y-6">
        <h2 id="orbix-explained" className="text-2xl font-black">Developer profiles and campus communities, in one place</h2>
        <p>Orbix brings connected coding accounts, contest activity and projects into a developer profile. Campus clubs use a separate workspace for their public presence, events and team workflows.</p>
        <div className="grid gap-6 md:grid-cols-2">
            <div><h3 className="font-bold">How do I get started?</h3><p>Create an account, connect your coding profiles and review your visibility settings before sharing. Platform ownership verification is separate from connecting an account.</p><Link className="underline" to="/docs/supported-platform-registry">Read the supported platform guide</Link></div>
            <div><h3 className="font-bold">What can other people see?</h3><p>Public visibility is controlled separately from your signed-in workspace. Review profile, platform and resume visibility before publishing information.</p><Link className="underline" to="/docs/public-vs-private-profile">Understand public and private profiles</Link></div>
            <div><h3 className="font-bold">How do clubs use Orbix?</h3><p>Clubs can publish an organization profile and manage events and team responsibilities through their club account.</p><Link className="underline" to="/clubs">Explore Orbix for campus clubs</Link></div>
            <div><h3 className="font-bold">Where can I find public events?</h3><p>The public event directory lists published national events open to all participants. Campus-restricted events remain in the signed-in application.</p><Link className="underline" to="/events">Browse public events</Link></div>
        </div>
        <nav aria-label="Explore Orbix" className="flex flex-wrap gap-5"><Link to="/about">About Orbix</Link><Link to="/docs">Documentation</Link><Link to="/blogs">Engineering workbooks</Link><Link to="/privacy">Privacy policy</Link></nav>
    </section>;
}
export default function AboutPage() { return <main className="max-w-5xl mx-auto p-6 py-16"><Link to="/">Orbix home</Link><h1 className="text-4xl font-black mt-8">About Orbix</h1><PublicAnswers /></main>; }
