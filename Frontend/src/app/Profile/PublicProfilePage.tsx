import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchPublicProfile, type PublicProfileData } from "../../utils/profileApi";
import { getPortalIcon } from "../../utils/portalIcons";
import { useToast } from "../../context/ToastContext";

export default function PublicProfilePage() {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const toast = useToast();

    const [profile, setProfile] = useState<PublicProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username) {
            setError("No username specified");
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        fetchPublicProfile(username)
            .then((data) => {
                if (isMounted) {
                    setProfile(data);
                    setLoading(false);
                    // Update document title for SEO
                    document.title = `${data.displayName} (@${data.username}) — Orbix Profile`;
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    setError(err.message || "Failed to load profile");
                    setLoading(false);
                    document.title = "Profile Not Found — Orbix";
                }
            });

        return () => {
            isMounted = false;
        };
    }, [username]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(
            () => toast.success("Profile link copied to clipboard!", { title: "Copied" }),
            () => toast.error("Failed to copy link", { title: "Error" })
        );
    };

    const handleShare = async () => {
        if (navigator.share && profile) {
            try {
                await navigator.share({
                    title: `${profile.displayName} (@${profile.username}) — Orbix Profile`,
                    text: profile.headline || `Check out ${profile.displayName}'s developer showcase on Orbix!`,
                    url: window.location.href,
                });
            } catch {
                // dismissed
            }
        } else {
            handleCopyLink();
        }
    };

    // Loading Skeleton
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F6] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-3xl bg-white border border-neutral-200/80 p-8 shadow-xs animate-pulse">
                    <div className="flex items-center gap-5 mb-6">
                        <div className="w-20 h-20 rounded-full bg-neutral-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2.5">
                            <div className="h-6 w-48 bg-neutral-200 rounded-lg" />
                            <div className="h-4 w-32 bg-neutral-100 rounded-lg" />
                            <div className="h-3 w-64 bg-neutral-100 rounded-lg" />
                        </div>
                    </div>
                    <div className="h-20 bg-neutral-100 rounded-2xl mb-6" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="h-24 bg-neutral-100 rounded-2xl" />
                        <div className="h-24 bg-neutral-100 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    // Error / Private Profile State
    if (error || !profile) {
        return (
            <div className="min-h-screen bg-[#F0F2F6] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 p-8 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight mb-2">
                        Profile Unavailable
                    </h2>
                    <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                        {error?.includes("private")
                            ? "This user has configured their profile to be private."
                            : `The developer profile '@${username}' could not be found or does not exist.`}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Link
                            to="/"
                            className="px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                            Return to Orbix
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const avatarSrc =
        profile.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            profile.displayName
        )}&background=0c1017&color=fff&size=256&bold=true`;

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white pb-16">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 group cursor-pointer">
                    <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center text-white font-black text-sm">
                        O
                    </div>
                    <span className="font-extrabold text-neutral-900 text-base tracking-tight">
                        Orbix
                    </span>
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span>Share</span>
                    </button>

                    {profile.isOwner && (
                        <button
                            type="button"
                            onClick={() => navigate("/profile")}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Edit Profile</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Profile Banner & Showcase Container */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
                {/* Profile Card Container */}
                <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-xs overflow-hidden mb-8">
                    {/* Cover Banner */}
                    <div
                        className="h-44 sm:h-56 w-full relative bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 flex items-end p-6"
                        style={
                            profile.coverImageUrl
                                ? { backgroundImage: `url(${profile.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                                : undefined
                        }
                    >
                        {profile.isOwner && (
                            <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30">
                                Profile Owner View
                            </span>
                        )}
                    </div>

                    {/* Profile Header Info */}
                    <div className="px-6 sm:px-8 pb-8 pt-0 relative">
                        {/* Avatar */}
                        <div className="-mt-14 sm:-mt-16 mb-4 flex items-end justify-between gap-4">
                            <div className="relative">
                                <img
                                    src={avatarSrc}
                                    alt={profile.displayName}
                                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover ring-4 ring-white shadow-md bg-neutral-900"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            profile.displayName
                                        )}&background=0c1017&color=fff&size=256&bold=true`;
                                    }}
                                />
                                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" title="Verified Developer" />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    <span>Copy URL</span>
                                </button>
                            </div>
                        </div>

                        {/* Name & Headline */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                                    {profile.displayName}
                                </h1>
                                <span className="text-sm font-mono font-medium text-neutral-400">
                                    @{profile.username}
                                </span>
                            </div>

                            {profile.headline && (
                                <p className="text-sm sm:text-base font-medium text-neutral-700 mt-1">
                                    {profile.headline}
                                </p>
                            )}
                        </div>

                        {/* Bio Description */}
                        {profile.bio && (
                            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-2xl mb-4 whitespace-pre-line">
                                {profile.bio}
                            </p>
                        )}

                        {/* Metadata chips: Location, Website */}
                        <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 flex-wrap pt-2 border-t border-neutral-100">
                            {profile.location && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{profile.location}</span>
                                </span>
                            )}

                            {profile.website && (
                                <a
                                    href={profile.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-neutral-800 hover:text-indigo-600 font-semibold underline underline-offset-2 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <span className="truncate max-w-xs">{profile.website.replace(/^https?:\/\//, "")}</span>
                                </a>
                            )}

                            <span className="flex items-center gap-1 text-neutral-400">
                                <span>Member of Orbix</span>
                            </span>
                        </div>

                        {/* Skills Chips */}
                        {Array.isArray(profile.skills) && profile.skills.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap gap-1.5">
                                {profile.skills.map((skill) => (
                                    <span
                                        key={skill}
                                        className="px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200/80 text-neutral-800 text-[11px] font-semibold"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Platforms Showcase Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                Connected Platforms
                            </h2>
                            <p className="text-xs text-neutral-500">
                                Publicly verified developer and competitive programming profiles.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-neutral-500 bg-white px-3 py-1 rounded-full border border-neutral-200">
                            {profile.platforms.length} Accounts
                        </span>
                    </div>

                    {profile.platforms.length === 0 ? (
                        <div className="rounded-3xl bg-white border border-neutral-200/90 p-8 text-center">
                            <p className="text-sm font-semibold text-neutral-700 mb-1">
                                No public platforms connected yet.
                            </p>
                            <p className="text-xs text-neutral-400">
                                This developer hasn't added any public coding platform accounts.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {profile.platforms.map((platform) => {
                                const handle = platform.portalUsername || "connected";
                                const profileUrl = platform.link;

                                return (
                                    <div
                                        key={platform.portal}
                                        className="rounded-2xl bg-white border border-neutral-200/90 hover:border-neutral-300 p-5 shadow-2xs transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            {/* Header: Icon, Name, Verified Badge */}
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                                        {getPortalIcon(platform.portal, "w-6 h-6")}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-extrabold text-neutral-900 capitalize">
                                                            {platform.portal}
                                                        </h3>
                                                        <span className="text-[11px] font-mono font-medium text-neutral-500">
                                                            @{handle}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span>Verified</span>
                                                    <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            </div>

                                            {/* Live Platform Stats */}
                                            {Array.isArray(platform.stats) && platform.stats.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 my-3 pt-2.5 border-t border-neutral-100">
                                                    {platform.stats.map((st, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="p-2 rounded-xl bg-neutral-50 border border-neutral-100 text-center"
                                                        >
                                                            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                                                                {st.label}
                                                            </p>
                                                            <p className="text-xs font-black text-neutral-900 mt-0.5 truncate">
                                                                {st.value}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* External Profile Link Action */}
                                        <div className="pt-2">
                                            <a
                                                href={profileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer"
                                            >
                                                <span>View on {platform.portal}</span>
                                                <svg className="w-3.5 h-3.5 text-neutral-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
