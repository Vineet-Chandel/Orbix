import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { updateProfile } from "../../utils/profileApi";
import { usePlatformSync } from "../../hooks/usePlatformSync";
import { Sidebar } from "../Dashboard/Sidebar";
import { ProfilePhotoFrame } from "./ProfilePhotoFrame";
import { ConnectedPlatformsSection } from "../Dashboard/ConnectedPlatformsSection";
import { ProfileCardStudio } from "./CardStudio/ProfileCardStudio";

export default function ProfileManager() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const platformSync = usePlatformSync();

    // Profile Edit Form State
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [headline, setHeadline] = useState(user?.headline || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [website, setWebsite] = useState(user?.website || "");
    const [location, setLocation] = useState(user?.location || "");
    const [skills, setSkills] = useState<string[]>(user?.skills || []);
    const [newSkillInput, setNewSkillInput] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);

    // Connected Platforms from localStorage / sync
    const [connectedPortals, setConnectedPortals] = useState<Record<string, any>>(() => {
        try {
            const raw = localStorage.getItem("orbix_connected_portals");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    // Listen for portal changes across tabs / storage
    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                setConnectedPortals(raw ? JSON.parse(raw) : {});
            } catch {
                setConnectedPortals({});
            }
        };

        window.addEventListener("orbix_portals_updated", handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            window.removeEventListener("orbix_portals_updated", handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, []);

    // Sync initial form values when user object loads
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setHeadline(user.headline || "");
            setBio(user.bio || "");
            setWebsite(user.website || "");
            setLocation(user.location || "");
            setSkills(Array.isArray(user.skills) ? user.skills : []);
        }
    }, [user]);

    // Handle profile save
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);

        try {
            const payload = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                headline: headline.trim(),
                bio: bio.trim(),
                website: website.trim(),
                location: location.trim(),
                skills,
            };

            const updated = await updateProfile(payload);
            dispatch(updateUserProfile(updated));
            toast.success("Your profile details have been saved successfully!", {
                title: "Profile Updated",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile", {
                title: "Update Error",
            });
        } finally {
            setSavingProfile(false);
        }
    };

    // Add skill tag
    const handleAddSkill = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && "key" in e && e.key !== "Enter") return;
        if (e) e.preventDefault();

        const trimmed = newSkillInput.trim();
        if (trimmed && !skills.includes(trimmed)) {
            setSkills([...skills, trimmed]);
            setNewSkillInput("");
        }
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setSkills(skills.filter((s) => s !== skillToRemove));
    };

    const handleCopyProfileLink = () => {
        const fullUrl = `${window.location.origin}/profile/${encodeURIComponent(user?.username || "")}`;
        navigator.clipboard.writeText(fullUrl).then(
            () => toast.success("Profile link copied to clipboard!", { title: "Copied" }),
            () => toast.error("Failed to copy link", { title: "Error" })
        );
    };

    const handleShareProfile = async () => {
        const fullUrl = `${window.location.origin}/profile/${encodeURIComponent(user?.username || "")}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${firstName} ${lastName} (@${user?.username}) — Orbix Profile`,
                    text: headline || "Check out my developer and competitive programming profile on Orbix!",
                    url: fullUrl,
                });
            } catch {
                // user dismissed share dialog
            }
        } else {
            handleCopyProfileLink();
        }
    };

    const publicUrl = `/profile/${encodeURIComponent(user?.username || "")}`;

    // Live combined user object for the Card Studio to react instantly to form edits
    const liveUser = useMemo(() => ({
        ...user,
        firstName,
        lastName,
        headline,
        bio,
        website,
        location,
        skills,
        photoUrl: user?.photoUrl || user?.avatarUrl,
    }), [user, firstName, lastName, headline, bio, website, location, skills]);

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white">
            {/* Desktop & Mobile Floating Sidebar */}
            <Sidebar
                activeTab="profile"
                onTabChange={(tab) => {
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "connect-platform") navigate("/onboarding");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                }}
            />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col min-h-screen p-3 sm:p-6 lg:pl-0">
                <div className="mx-auto w-full space-y-6">
                    {/* Header Navbar */}
                    <header className="w-full rounded-2xl bg-white border border-neutral-200/90 shadow-xs px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
                                <Link to="/dashboard" className="hover:text-neutral-700 transition-colors">
                                    Dashboard
                                </Link>
                                <span>/</span>
                                <span className="text-neutral-800">Profile Settings</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                Profile Settings
                            </h1>
                        </div>

                        {/* Quick Profile Link & Share Controls */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <Link
                                to={publicUrl}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all cursor-pointer"
                                title="Preview your public profile"
                            >
                                <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>Preview Showcase</span>
                            </Link>

                            <button
                                type="button"
                                onClick={handleCopyProfileLink}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Copy Link</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleShareProfile}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span>Share Profile</span>
                            </button>
                        </div>
                    </header>

                    {/* Split Layout: Left Column = Personal Details, Right Column = Orbix Share Card Studio */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* LEFT COLUMN: Personal Details Card */}
                        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-xs p-6 sm:p-7">
                            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-neutral-900">Personal Details</h2>
                                    <p className="text-xs text-neutral-500 mt-0.5">Manage your showcase details and profile photo.</p>
                                </div>
                                <span className="text-xs font-mono font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
                                    @{user?.username}
                                </span>
                            </div>

                            {/* Profile Photo Interactive Frame */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 mb-6 shadow-2xs">
                                <ProfilePhotoFrame
                                    currentPhotoUrl={user?.photoUrl || user?.avatarUrl}
                                    hasPreviousPhoto={user?.hasPreviousPhoto}
                                    previousPhotoUrl={user?.previousPhotoUrl}
                                    displayName={`${firstName} ${lastName}`.trim() || user?.username || "User"}
                                    username={user?.username || ""}
                                    size="lg"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-extrabold text-neutral-900 truncate">
                                            Profile Photo
                                        </h3>
                                        {user?.photoUrl ? (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                                                Custom
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-bold text-neutral-600">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                                        Hover or tap avatar to upload, restore, or reset photo. Images are optimized and face-cropped automatically.
                                    </p>
                                    {user?.hasPreviousPhoto && (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600 font-semibold mt-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span>Previous photo available for instant restoration</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleSaveProfile} className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Headline</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Senior Full-Stack Engineer & Competitive Programmer"
                                        value={headline}
                                        maxLength={255}
                                        onChange={(e) => setHeadline(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                    />
                                    <span className="text-[10px] text-neutral-400 flex justify-end mt-1">{headline.length}/255</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Biography</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Write a brief intro about yourself, your tech stack, and what you're passionate about..."
                                        value={bio}
                                        maxLength={2000}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Location</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. San Francisco, CA"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Portfolio / Website</label>
                                        <input
                                            type="url"
                                            placeholder="https://yourportfolio.dev"
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Skills Tags */}
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Skills & Technologies</label>
                                    <div className="flex gap-2 mb-2.5">
                                        <input
                                            type="text"
                                            placeholder="Type skill & press Enter"
                                            value={newSkillInput}
                                            onChange={(e) => setNewSkillInput(e.target.value)}
                                            onKeyDown={handleAddSkill}
                                            className="flex-1 px-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddSkill}
                                            className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-800 transition-colors cursor-pointer"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                        {skills.map((skill) => (
                                            <span
                                                key={skill}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-semibold"
                                            >
                                                <span>{skill}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSkill(skill)}
                                                    className="text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="pt-4 border-t border-neutral-100">
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="w-full h-11 flex items-center justify-center rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all cursor-pointer shadow-sm hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50"
                                    >
                                        {savingProfile ? (
                                            <div className="flex items-center gap-2">
                                                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                                <span>Saving Changes...</span>
                                            </div>
                                        ) : (
                                            <span>Save Profile Details</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* RIGHT COLUMN: Orbix Share Card Studio (Sticky on Desktop) */}
                        <div className="lg:sticky lg:top-5">
                            <ProfileCardStudio
                                user={liveUser}
                                connectedPortals={connectedPortals}
                            />
                        </div>
                    </div>

                    {/* Connected Platforms Section (Shifted below the Personal Details Card) */}
                    <div className="w-full">
                        <ConnectedPlatformsSection
                            connectedPortals={connectedPortals}
                            onPortalsChange={(updated) => setConnectedPortals(updated)}
                            syncState={platformSync}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
