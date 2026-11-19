import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Settings } from "lucide-react";
import { NeoToggle } from "../../../components/NeoToggle";
import type { FormSettings } from "../../../api/clubEventFormApi";

export interface FormSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: FormSettings;
    onSave: (updated: FormSettings) => void;
}

export const FormSettingsModal: React.FC<FormSettingsModalProps> = ({
    isOpen,
    onClose,
    settings: initialSettings,
    onSave,
}) => {
    const [settings, setSettings] = useState<FormSettings>({ ...initialSettings });

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(settings);
        onClose();
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none">
            <div className="w-full max-w-xl bg-white dark:bg-[#0A0A0A] rounded-2xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                            <Settings className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">Form & Registration Settings</h3>
                            <p className="text-xs text-neutral-500 font-normal">
                                Configure response limits, responder permissions and confirmation rules.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4 text-xs">
                    {/* 1. Accepting Responses Toggle */}
                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 flex items-center justify-between gap-4">
                        <div>
                            <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 block">Accepting Responses</span>
                            <span className="text-neutral-500 font-normal">
                                When turned off, students will see the closed message and cannot submit.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.isOpen}
                            onChange={(val) => setSettings({ ...settings, isOpen: val })}
                        />
                    </div>

                    {!settings.isOpen && (
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                Closed Registration Message
                            </label>
                            <textarea
                                value={settings.closedMessage}
                                onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
                                placeholder="Registrations are currently closed..."
                                rows={2}
                                className="w-full border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                            />
                        </div>
                    )}

                    {/* 2. Maximum Responses Cap */}
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                            Max Responses Cap (Optional)
                        </label>
                        <input
                            type="number"
                            value={settings.maxResponses ?? ""}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    maxResponses: e.target.value ? Number(e.target.value) : null,
                                })
                            }
                            placeholder="Leave empty for unlimited participants"
                            className="w-full border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                        />
                        <span className="text-[10px] text-neutral-500 font-normal">
                            Automatically closes registrations once this capacity count is reached.
                        </span>
                    </div>

                    {/* 3. Limit to 1 Response per Student */}
                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                        <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">Limit to 1 Response</span>
                            <span className="text-neutral-500 font-normal">
                                Enforces one registration entry per authenticated student account.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.limitOneResponse}
                            onChange={(val) => setSettings({ ...settings, limitOneResponse: val })}
                        />
                    </div>

                    {/* 4. Allow Response Editing */}
                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                        <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">Allow Response Editing</span>
                            <span className="text-neutral-500 font-normal">
                                Students can update their answers after submission prior to event start.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.allowEditResponse}
                            onChange={(val) => setSettings({ ...settings, allowEditResponse: val })}
                        />
                    </div>

                    {/* 5. Progress Bar */}
                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                        <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">Show Progress Bar</span>
                            <span className="text-neutral-500 font-normal">
                                Display step progress indicator on multi-section forms.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.showProgressBar}
                            onChange={(val) => setSettings({ ...settings, showProgressBar: val })}
                        />
                    </div>

                    {/* 6. Confirmation Message */}
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                            Custom Confirmation Message
                        </label>
                        <textarea
                            value={settings.confirmationMessage}
                            onChange={(e) => setSettings({ ...settings, confirmationMessage: e.target.value })}
                            placeholder="Your registration has been submitted successfully!"
                            rows={3}
                            className="w-full border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-white bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm cursor-pointer transition-colors"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
