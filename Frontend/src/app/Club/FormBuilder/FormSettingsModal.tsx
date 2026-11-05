import React, { useState } from "react";
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Settings className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">Form & Registration Settings</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Configure response limits, responder permissions and confirmation rules.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl border-2 border-black hover:bg-neutral-100 cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                <div className="space-y-5 text-xs">
                    {/* 1. Accepting Responses Toggle */}
                    <div className="p-4 rounded-xl border-2 border-black bg-neutral-50 flex items-center justify-between gap-4">
                        <div>
                            <span className="font-black text-sm text-black block">Accepting Responses</span>
                            <span className="text-neutral-500 font-medium">
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
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black">
                                Closed Registration Message
                            </label>
                            <textarea
                                value={settings.closedMessage}
                                onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
                                placeholder="Registrations are currently closed..."
                                rows={2}
                                className="w-full border-2 border-black rounded-xl p-3 font-medium focus:outline-none bg-white"
                            />
                        </div>
                    )}

                    {/* 2. Maximum Responses Cap */}
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black">
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
                            className="w-full border-2 border-black rounded-xl p-2.5 font-bold focus:outline-none bg-white"
                        />
                        <span className="text-[10px] text-neutral-500 font-medium">
                            Automatically closes registrations once this capacity count is reached.
                        </span>
                    </div>

                    {/* 3. Limit to 1 Response per Student */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-black/20 hover:border-black transition-colors">
                        <div>
                            <span className="font-black text-black block">Limit to 1 Response</span>
                            <span className="text-neutral-500">
                                Enforces one registration entry per authenticated student account.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.limitOneResponse}
                            onChange={(val) => setSettings({ ...settings, limitOneResponse: val })}
                        />
                    </div>

                    {/* 4. Allow Response Editing */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-black/20 hover:border-black transition-colors">
                        <div>
                            <span className="font-black text-black block">Allow Response Editing</span>
                            <span className="text-neutral-500">
                                Students can update their answers after submission prior to event start.
                            </span>
                        </div>
                        <NeoToggle
                            checked={settings.allowEditResponse}
                            onChange={(val) => setSettings({ ...settings, allowEditResponse: val })}
                        />
                    </div>

                    {/* 5. Progress Bar */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-black/20 hover:border-black transition-colors">
                        <div>
                            <span className="font-black text-black block">Show Progress Bar</span>
                            <span className="text-neutral-500">
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
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black">
                            Custom Confirmation Message
                        </label>
                        <textarea
                            value={settings.confirmationMessage}
                            onChange={(e) => setSettings({ ...settings, confirmationMessage: e.target.value })}
                            placeholder="Your registration has been submitted successfully!"
                            rows={3}
                            className="w-full border-2 border-black rounded-xl p-3 font-medium focus:outline-none bg-white"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t-2 border-black/10 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border-2 border-black font-black text-xs hover:bg-neutral-100 cursor-pointer shadow-[2px_2px_0px_#000]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-5 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};
