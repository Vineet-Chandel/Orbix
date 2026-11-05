import React from "react";
import { Mail, Phone } from "lucide-react";
import { ClubCoordinatorsManager } from "./ClubCoordinatorsManager";
import type { ClubCoordinator } from "../../../utils/clubProfileApi";

interface StepPeopleContactProps {
    clubId: string;
    coordinators: ClubCoordinator[];
    canManage: boolean;
    onUpdateCoordinators: () => void;
    publicEmail: string;
    onPublicEmailChange: (val: string) => void;
    contactPhone: string;
    onContactPhoneChange: (val: string) => void;
}

export const StepPeopleContact: React.FC<StepPeopleContactProps> = ({
    clubId,
    coordinators,
    canManage,
    onUpdateCoordinators,
    publicEmail,
    onPublicEmailChange,
    contactPhone,
    onContactPhoneChange,
}) => {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b border-black/10 pb-4">
                <h2 className="text-lg font-black text-black tracking-tight">People & Contact</h2>
                <p className="text-xs text-neutral-600 font-medium mt-1">
                    Manage publicly displayed club student coordinators and your chapter's official contact channels.
                </p>
            </div>

            {/* A. Club Coordinators Section */}
            <div className="space-y-4">
                <ClubCoordinatorsManager
                    clubId={clubId}
                    coordinators={coordinators}
                    canManage={canManage}
                    onUpdate={onUpdateCoordinators}
                />
            </div>

            {/* B. Official Club Contact Details */}
            <div className="space-y-4 pt-6 border-t-2 border-black/10">
                <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-wider">
                        Official Chapter Contact
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        These official communication channels are displayed publicly for student and sponsor inquiries.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Public Contact Email */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Official Public Email <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                        </label>
                        <div className="relative">
                            <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                value={publicEmail}
                                onChange={(e) => onPublicEmailChange(e.target.value)}
                                placeholder="contact@club.org or club@college.edu"
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <p className="text-[10px] text-neutral-500 font-medium">
                            Use your club's shared inbox rather than an individual coordinator's personal email.
                        </p>
                    </div>

                    {/* Official Contact Phone / WhatsApp */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Phone / WhatsApp Inquiries <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                        </label>
                        <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="tel"
                                value={contactPhone}
                                onChange={(e) => onContactPhoneChange(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <p className="text-[10px] text-neutral-500 font-medium">
                            Format with country code (e.g. +91) for international student and mentor reach.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
