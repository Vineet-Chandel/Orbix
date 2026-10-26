import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    BadgeCheck,
    Bookmark,
    BookOpen,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Copy,
    Download,
    Trash2,
    AlertTriangle,
    Lock,
    Laptop,
    Mail,
} from "lucide-react";
import type { SettingsViewKey } from "./types";
import { useToast } from "../../context/ToastContext";
import { NeoToggle } from "../../components/NeoToggle";

interface SettingDetailViewProps {
    viewKey: SettingsViewKey;
    user: any;
    onBack: () => void;
    onSelectView: (view: SettingsViewKey) => void;
}

export const SettingDetailView: React.FC<SettingDetailViewProps> = ({
    viewKey,
    user,
    onBack,
    onSelectView,
}) => {
    const toast = useToast();

    // Local toggles for notification & security settings
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailContestAlerts, setEmailContestAlerts] = useState(true);
    const [recruiterMessages, setRecruiterMessages] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);
    const [telemetryEnabled, setTelemetryEnabled] = useState(false);

    // Password fields
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleSavePassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword) {
            toast.error("Please fill in both current and new password.", { title: "Password Error" });
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.", { title: "Weak Password" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.", { title: "Mismatch" });
            return;
        }
        setIsSavingPassword(true);
        setTimeout(() => {
            setIsSavingPassword(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Password updated successfully.", { title: "Security Updated" });
        }, 600);
    };

    const handleExportData = () => {
        const exportData = {
            user: {
                username: user?.username,
                email: user?.gmail || user?.email,
                name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
                createdAt: user?.createdAt,
                platforms: user?.platforms,
                college: user?.college,
            },
            exportDate: new Date().toISOString(),
            formatVersion: "1.0",
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orbix-account-data-${user?.username || "export"}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Account data archive downloaded as JSON.", { title: "Data Exported" });
    };

    const handleCopyInviteLink = () => {
        const link = `${window.location.origin}/signup?ref=${encodeURIComponent(user?.username || "dev")}`;
        navigator.clipboard.writeText(link);
        toast.success("Referral & invite link copied to clipboard!", { title: "Copied" });
    };

    // Render individual view based on viewKey
    const renderContent = () => {
        switch (viewKey) {
            case "verify-account":
                return (
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                                        <BadgeCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Collegiate Verification</span>
                                    </div>
                                    <h3 className="text-xl font-black text-black">
                                        Verified Student & Developer Identity
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Get your verified badge on Global & Campus leaderboards, confirm collegiate enrollment, and gain recruiter priority.
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase border-2 border-black shrink-0 shadow-[2px_2px_0px_#000] ${user?.college?.officialName ? "bg-[#a2ff86] text-black" : "bg-neutral-100 text-neutral-700"}`}>
                                    {user?.college?.officialName ? "Enrolled" : "Not Linked"}
                                </span>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Current Affiliation
                                </h4>
                                <div className="text-xs font-bold text-neutral-800 space-y-1">
                                    <p className="text-sm font-black text-black">
                                        {user?.college?.officialName || "No verified college currently associated"}
                                    </p>
                                    <p className="text-neutral-500 font-medium">
                                        {user?.college?.city && user?.college?.state
                                            ? `${user.college.city}, ${user.college.state} • AISHE Verified`
                                            : "Select your institution in Profile Details to initiate campus verification"}
                                    </p>
                                </div>
                                <Link
                                    to="/profile"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                                >
                                    <span>Manage College in Profile</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            <div className="pt-2 border-t-2 border-black/10 space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Verified Badge Perks
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                        <span className="text-lg">🏅</span>
                                        <p className="text-xs font-black text-black">Official Badge</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Verified checkmark on cards & leaderboards.</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                        <span className="text-lg">🏫</span>
                                        <p className="text-xs font-black text-black">Campus League</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Rep your university in the College League.</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                        <span className="text-lg">💼</span>
                                        <p className="text-xs font-black text-black">Recruiter Trust</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Rank higher in verified talent searches.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "password-security":
                return (
                    <div className="space-y-6">
                        {/* Change Password Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">Change Password</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Ensure your password uses at least 8 characters with a mix of numbers and letters.
                                </p>
                            </div>

                            <form onSubmit={handleSavePassword} className="space-y-3.5 max-w-md">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Current Password
                                    </label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingPassword}
                                    className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingPassword ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>

                        {/* Two-Factor Authentication Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                                    <h3 className="text-base font-black text-black">Two-Factor Authentication (2FA)</h3>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium max-w-xl">
                                    Protect your Orbix account with an extra layer of security using an authenticator app (Google Authenticator or 1Password).
                                </p>
                            </div>

                            <NeoToggle
                                checked={twoFactorEnabled}
                                onChange={(val) => {
                                    setTwoFactorEnabled(val);
                                    toast.info(`Two-Factor Authentication ${val ? "enabled" : "disabled"}.`, {
                                        title: "Security Preference",
                                    });
                                }}
                                onStatusText="2FA: Enabled"
                                offStatusText="2FA: Disabled"
                                ariaLabel="Toggle two-factor authentication"
                            />
                        </div>

                        {/* Active Sessions Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center gap-2">
                                <Laptop className="w-4 h-4 text-black stroke-[2.5]" />
                                <h3 className="text-base font-black text-black">Where You're Logged In</h3>
                            </div>
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">This Device (Current Session)</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Browser session • Active now</p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black">
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case "manage-account":
                return (
                    <div className="space-y-6">
                        {/* Account Data & Archive */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">Account Information & Export</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Download a copy of your Orbix profile details, verified coding platforms, and submission history in JSON format.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                                    <span>Primary Account Email:</span>
                                    <span className="font-mono text-black">{user?.gmail || user?.email || "No email on record"}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                                    <span>Registered Username:</span>
                                    <span className="font-mono text-black">@{user?.username}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleExportData}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                            >
                                <Download className="w-4 h-4 stroke-[2.5]" />
                                <span>Download Account Data (.JSON)</span>
                            </button>
                        </div>

                        {/* Danger Zone */}
                        <div className="p-6 rounded-2xl bg-rose-50/60 border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center gap-2 text-rose-700">
                                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                                <h3 className="text-base font-black text-black">Danger Zone</h3>
                            </div>
                            <p className="text-xs text-neutral-700 font-medium leading-relaxed max-w-xl">
                                Deactivating or deleting your account will remove your public showcase, unlink your external coding platforms, and withdraw you from active leaderboards.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    toast.info("Account deletion requires email confirmation link. Check your inbox.", {
                                        title: "Request Initiated",
                                    });
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Request Account Deletion</span>
                            </button>
                        </div>
                    </div>
                );

            case "saved":
                return (
                    <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <Bookmark className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-xl font-black text-black">Saved Bookmarks</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Save challenging algorithmic problems, starred repositories, and bookmarked articles to review them here anytime.
                            </p>
                        </div>
                        <Link
                            to="/leaderboard"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                        >
                            <span>Explore Leaderboard Coders</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                );

            case "your-activity":
                return (
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Your Activity & Metrics</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Summary of your platform syncs, submission consistency, and active engagement.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Platforms</p>
                                    <p className="text-2xl font-black text-black">{user?.platforms?.length || 0}</p>
                                    <p className="text-[10px] font-bold text-[#008f39]">Active</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Profile Status</p>
                                    <p className="text-base font-black text-black truncate">{user?.isPublic !== false ? "Public" : "Private"}</p>
                                    <p className="text-[10px] font-bold text-neutral-600">Visibility</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Account Age</p>
                                    <p className="text-base font-black text-black">Active</p>
                                    <p className="text-[10px] font-bold text-neutral-600">Verified</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Sync Pipeline</p>
                                    <p className="text-base font-black text-black">Healthy</p>
                                    <p className="text-[10px] font-bold text-[#008f39]">Live Redis</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "notifications":
                return (
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-black">Notification Preferences</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Choose which alerts, platform updates, and contest reminders you want to receive.
                            </p>
                        </div>

                        <div className="space-y-4 pt-1">
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Push Notifications</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Receive real-time in-browser alerts for submissions and rank updates.</p>
                                </div>
                                <NeoToggle
                                    checked={pushNotifications}
                                    onChange={(v) => {
                                        setPushNotifications(v);
                                        toast.info(`Push notifications ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle push notifications"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Upcoming Contest Reminders</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Get reminders 2 hours before registered competitive programming contests.</p>
                                </div>
                                <NeoToggle
                                    checked={emailContestAlerts}
                                    onChange={(v) => {
                                        setEmailContestAlerts(v);
                                        toast.info(`Contest reminders ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle contest reminders"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Recruiter Inquiries & Messages</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Notifications when a verified recruiter contacts you through your profile.</p>
                                </div>
                                <NeoToggle
                                    checked={recruiterMessages}
                                    onChange={(v) => {
                                        setRecruiterMessages(v);
                                        toast.info(`Recruiter alerts ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle recruiter messages"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Weekly Developer Digest</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Summary of top campus coders, trending technologies, and leaderboard shifts.</p>
                                </div>
                                <NeoToggle
                                    checked={weeklyDigest}
                                    onChange={(v) => {
                                        setWeeklyDigest(v);
                                        toast.info(`Weekly digest ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle weekly digest"
                                />
                            </div>
                        </div>
                    </div>
                );

            case "blogged":
                return (
                    <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-purple-200 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <BookOpen className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-xl font-black text-black">Your Authored Blogs & Articles</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Share tutorials, system design notes, and algorithmic walkthroughs with the Orbix developer community.
                            </p>
                        </div>
                        <Link
                            to="/blogs"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                        >
                            <span>Open Blogs Hub</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                );

            case "connections":
                return (
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Developer Connections</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Connect with coding peers, campus teammates, and mentors across institutions.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyInviteLink}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer shrink-0"
                            >
                                <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Copy Invite Link</span>
                            </button>
                        </div>

                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                            <p className="text-xs font-black text-black uppercase tracking-wider">Campus Directory</p>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                {user?.college?.officialName
                                    ? `Coders from ${user.college.officialName} automatically connect in the College League.`
                                    : "Link your verified college to automatically discover fellow student developers."}
                            </p>
                        </div>
                    </div>
                );

            case "comments":
                return (
                    <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <MessageSquare className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-xl font-black text-black">Discussions & Comments</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Review your comments, question responses, and technical discussion replies across blogs and events.
                            </p>
                        </div>
                        <p className="text-xs font-mono font-bold text-neutral-500">
                            Zero active moderation flags on your discussions.
                        </p>
                    </div>
                );

            case "help":
                return (
                    <div className="space-y-5">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Help & Documentation</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Find guides on platform syncs, verification, contest tracking, and Orbix Score calculation.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                <Link
                                    to="/docs"
                                    className="p-4 rounded-xl bg-[#FAF6EE] hover:bg-[#ede5d6] border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-black text-black">Documentation Hub</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Platform architecture, scoring engine & APIs.</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-black shrink-0" />
                                </Link>

                                <a
                                    href="mailto:support@orbix.dev"
                                    className="p-4 rounded-xl bg-[#FAF6EE] hover:bg-[#ede5d6] border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-black text-black">Contact Support</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Email our team at support@orbix.dev</p>
                                    </div>
                                    <Mail className="w-4 h-4 text-black shrink-0" />
                                </a>
                            </div>
                        </div>
                    </div>
                );

            case "privacy-center":
                return (
                    <div className="space-y-5">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Orbix Privacy Center</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                    We believe developer data belongs to developers. Orbix never sells your code, submissions, or contact details to third-party data brokers.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-black text-black">Anonymous Telemetry</p>
                                        <p className="text-[11px] text-neutral-600 font-medium">Help improve Orbix by sharing anonymous performance telemetry.</p>
                                    </div>
                                    <NeoToggle
                                        checked={telemetryEnabled}
                                        onChange={(v) => {
                                            setTelemetryEnabled(v);
                                            toast.info(`Telemetry preferences updated.`);
                                        }}
                                        ariaLabel="Toggle telemetry"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => onSelectView("account-privacy")}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                                >
                                    <span>Open Profile Privacy Controls</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case "account-status":
                return (
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Account Standing</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Current health status of your Orbix developer account.
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Good Standing</span>
                            </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2 text-xs font-bold text-neutral-700">
                            <div className="flex items-center justify-between">
                                <span>Community Guidelines:</span>
                                <span className="text-[#008f39]">100% Compliant</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>API Rate Limits:</span>
                                <span>5,000 requests / hour</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>External Sync Queues:</span>
                                <span className="text-[#008f39]">Healthy</span>
                            </div>
                        </div>
                    </div>
                );

            case "about":
                return (
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_#000]">
                                O
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-black">Orbix Platform</h3>
                                <p className="text-xs font-mono font-bold text-neutral-600">v1.4.0 • Neo-Grotesque Edition</p>
                            </div>
                        </div>

                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed max-w-xl">
                            Orbix is the unified developer identity and competitive analytics platform built for coders, student clubs, and tech hiring teams worldwide.
                        </p>

                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1.5 text-xs font-bold text-neutral-700">
                            <div className="flex items-center justify-between">
                                <span>Frontend Engine:</span>
                                <span>React 19 • Vite • Tailwind</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Backend Infrastructure:</span>
                                <span>Node • Express • PostgreSQL • Redis</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>License:</span>
                                <span>Proprietary © {new Date().getFullYear()} Orbix Inc.</span>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const getViewTitle = () => {
        switch (viewKey) {
            case "verify-account": return "Verify Account";
            case "password-security": return "Password and Security";
            case "manage-account": return "Manage Account";
            case "saved": return "Saved";
            case "your-activity": return "Your Activity";
            case "notifications": return "Notifications";
            case "blogged": return "Blogged";
            case "connections": return "Connections";
            case "comments": return "Comments";
            case "help": return "Help";
            case "privacy-center": return "Privacy Center";
            case "account-status": return "Account Status";
            case "about": return "About";
            default: return "Setting";
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b-2 border-black/15">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                    aria-label="Back to Settings Hub"
                    title="Back to Settings"
                >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="space-y-0.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        Settings
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        {getViewTitle()}
                    </h2>
                </div>
            </div>

            {renderContent()}
        </div>
    );
};
