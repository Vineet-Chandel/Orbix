// Frontend/src/app/Club/TeamWorkspace/Notifications/NotificationPreferencesModal.tsx
import React, { useState, useEffect } from "react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { WorkspaceNotificationPreferences } from "../../../../types/workspace";
import { Bell, Check, Shield, X } from "lucide-react";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface NotificationPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId?: string;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
    isOpen,
    onClose,
    clubId,
}) => {
    const [preferences, setPreferences] = useState<WorkspaceNotificationPreferences | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        workspaceApi
            .getNotificationPreferences(clubId)
            .then((res) => {
                if (res?.data) {
                    setPreferences(res.data);
                }
            })
            .catch((err) => console.error("Failed to load preferences:", err))
            .finally(() => setLoading(false));
    }, [isOpen, clubId]);

    const handleToggle = (key: keyof WorkspaceNotificationPreferences) => {
        if (!preferences) return;
        setPreferences({
            ...preferences,
            [key]: !preferences[key],
        });
    };

    const handleSave = async () => {
        if (!preferences) return;
        setSaving(true);
        setSaveSuccess(false);
        try {
            const res = await workspaceApi.updateNotificationPreferences(
                {
                    emailTaskAssigned: preferences.emailTaskAssigned,
                    emailTaskReminders: preferences.emailTaskReminders,
                    emailMentions: preferences.emailMentions,
                    emailDiscussions: preferences.emailDiscussions,
                    emailDigestFrequency: preferences.emailDigestFrequency,
                    mutedUntil: preferences.mutedUntil,
                },
                clubId
            );
            if (res?.data) {
                setPreferences(res.data);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            }
        } catch (err) {
            console.error("Failed to save preferences:", err);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-indigo-950/40 text-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Bell className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
                            <p className="text-xs text-slate-400">Configure what updates trigger external emails</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                        Loading preferences...
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        {/* Essential security notice */}
                        <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-indigo-200">
                            <Shield className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                            <span>
                                Essential security communications, workspace invitations, and role revoking notices
                                are non-disableable to ensure workspace accountability.
                            </span>
                        </div>

                        {/* Email toggles */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/40 transition">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-slate-200">Task Assignments</span>
                                    <p className="text-xs text-slate-400">Receive email when new tasks are delegated to you</p>
                                </div>
                                <NeoCheckbox
                                    checked={preferences?.emailTaskAssigned ?? true}
                                    onCheckedChange={() => handleToggle("emailTaskAssigned")}
                                    colorScheme="cyan"
                                    size="sm"
                                />
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/40 transition">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-slate-200">Task Reminders</span>
                                    <p className="text-xs text-slate-400">Receive email reminders 24h prior to task deadlines</p>
                                </div>
                                <NeoCheckbox
                                    checked={preferences?.emailTaskReminders ?? true}
                                    onCheckedChange={() => handleToggle("emailTaskReminders")}
                                    colorScheme="cyan"
                                    size="sm"
                                />
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/40 transition">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-slate-200">Direct Mentions (@you)</span>
                                    <p className="text-xs text-slate-400">Receive email when tagged in discussions or comments</p>
                                </div>
                                <NeoCheckbox
                                    checked={preferences?.emailMentions ?? true}
                                    onCheckedChange={() => handleToggle("emailMentions")}
                                    colorScheme="cyan"
                                    size="sm"
                                />
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/40 transition">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-slate-200">Watched Discussions</span>
                                    <p className="text-xs text-slate-400">Receive email on threads you have actively joined</p>
                                </div>
                                <NeoCheckbox
                                    checked={preferences?.emailDiscussions ?? true}
                                    onCheckedChange={() => handleToggle("emailDiscussions")}
                                    colorScheme="cyan"
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* Digest Frequency */}
                        <div className="pt-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                                Email Delivery Mode
                            </label>
                            <NeoSelect
                                value={preferences?.emailDigestFrequency || "instant"}
                                onChange={(val) =>
                                    setPreferences((prev) =>
                                        prev ? { ...prev, emailDigestFrequency: val as any } : null
                                    )
                                }
                                options={[
                                    { value: "instant", label: "Instant — Deliver emails immediately upon event" },
                                    { value: "daily", label: "Daily Digest — Batch non-urgent updates into daily digest" },
                                    { value: "none", label: "Mute Optional — In-app notifications only (no emails)" },
                                ]}
                                size="md"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-6">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                {saveSuccess && (
                                    <>
                                        <Check className="h-3.5 w-3.5" /> Preferences saved!
                                    </>
                                )}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/30"
                                >
                                    {saving ? "Saving..." : "Save Preferences"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
