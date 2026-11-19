import type { ReactNode } from "react";

export type ClubSettingsViewKey =
    | "hub"
    | "account-center"
    | "verify-account"
    | "account-privacy"
    | "password-security"
    | "manage-account"
    | "help"
    | "privacy-center"
    | "account-status"
    | "about"
    | "your-activity";

export interface ClubSettingItemDef {
    id: ClubSettingsViewKey;
    label: string;
    description: string;
    icon: ReactNode;
    badge?: string;
    badgeColor?: string;
    group: "account-center" | "support";
}
