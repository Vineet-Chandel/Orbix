import React, { useState, useEffect } from "react";
import {
    Save,
    ShieldCheck,
    RefreshCw,
    UserCheck,
} from "lucide-react";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import { useToast } from "../../../context/ToastContext";
import {
    fetchCertificateSettings,
    updateCertificateSettings,
    type CertificateClubSettings,
} from "../../../api/certificateStudioApi";

interface CertificateSettingsViewProps {
    clubId: string;
}

export const CertificateSettingsView: React.FC<CertificateSettingsViewProps> = () => {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState<CertificateClubSettings>({
        defaultSignerName: "",
        defaultSignerRole: "Faculty Advisor",
        defaultTitle: "Certificate of Recognition",
        requireAttendance: true,
        verificationPublic: true,
        signatureAssetUrl: null,
    });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const s = await fetchCertificateSettings();
                setSettings(s);
            } catch (err: any) {
                console.error("Failed to load settings:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateCertificateSettings(settings);
            toast.success("Certificate settings updated successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
                <RefreshCw className="w-6 h-6 animate-spin text-black mx-auto mb-2" />
                <span className="text-xs font-bold text-neutral-600">Loading certificate configuration...</span>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 w-full">
            {/* Header info */}
            <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-1">
                <h3 className="text-lg font-black text-black">
                    Club Credential & Issuance Defaults
                </h3>
                <p className="text-xs font-semibold text-neutral-600">
                    Define default signatory credentials, event eligibility thresholds, and cryptographic verification policies.
                </p>
            </div>

            {/* Form cards */}
            <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-black/10">
                    <UserCheck className="w-5 h-5 text-black" />
                    <h4 className="text-sm font-black text-black">Authorized Signatory Defaults</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Default Signer Name
                        </label>
                        <input
                            type="text"
                            value={settings.defaultSignerName}
                            onChange={(e) => setSettings({ ...settings, defaultSignerName: e.target.value })}
                            placeholder="e.g. Prof. Rajesh Verma or President Name"
                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-medium">
                            Automatically populates the &quot;signer_name&quot; dynamic token.
                        </span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-black text-black block">
                            Default Signer Role / Title
                        </label>
                        <input
                            type="text"
                            value={settings.defaultSignerRole}
                            onChange={(e) => setSettings({ ...settings, defaultSignerRole: e.target.value })}
                            placeholder="e.g. Faculty Coordinator / Chapter Lead"
                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-medium">
                            Designation printed below the signature line.
                        </span>
                    </div>
                </div>

                <div className="space-y-1 pt-2">
                    <label className="text-xs font-black text-black block">
                        Default Certificate Title
                    </label>
                    <input
                        type="text"
                        value={settings.defaultTitle}
                        onChange={(e) => setSettings({ ...settings, defaultTitle: e.target.value })}
                        placeholder="e.g. Certificate of Recognition"
                        className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:bg-white focus:outline-none"
                    />
                </div>
            </div>

            {/* Attendance & Eligibility Policies */}
            <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-black/10">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-sm font-black text-black">Verification & Integrity Rules</h4>
                </div>

                <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border-2 border-black bg-[#FAF6EE]">
                        <NeoCheckbox
                            checked={settings.requireAttendance}
                            onCheckedChange={(checked) => setSettings({ ...settings, requireAttendance: checked })}
                            colorScheme="green"
                            size="md"
                            label={<span className="font-black text-black text-xs">Enforce Strict Attendance Verification</span>}
                            description={
                                <span className="text-neutral-600 font-medium leading-relaxed text-xs block mt-0.5">
                                    Requires confirmed check-in timestamps before event turnout certificates can be generated. Prevents false accreditation for absent registrants.
                                </span>
                            }
                        />
                    </div>

                    <div className="p-3.5 rounded-xl border-2 border-black bg-[#FAF6EE]">
                        <NeoCheckbox
                            checked={settings.verificationPublic}
                            onCheckedChange={(checked) => setSettings({ ...settings, verificationPublic: checked })}
                            colorScheme="green"
                            size="md"
                            label={<span className="font-black text-black text-xs">Enable Public Verification Registry</span>}
                            description={
                                <span className="text-neutral-600 font-medium leading-relaxed text-xs block mt-0.5">
                                    Permits external employers and institutions to verify credentials directly via <code className="font-mono text-[11px] bg-neutral-200 px-1 py-0.5 rounded">/verify/certificate/:code</code>.
                                </span>
                            }
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-3 border-black font-black text-xs sm:text-sm shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>{saving ? "Saving Defaults..." : "Save Certificate Preferences"}</span>
                </button>
            </div>
        </form>
    );
};

export default CertificateSettingsView;
