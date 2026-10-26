import type { ReactNode } from "react";

export type SettingsViewKey =
    | "hub"
    | "account-center"
    | "verify-account"
    | "account-privacy"
    | "password-security"
    | "manage-account"
    | "saved"
    | "your-activity"
    | "notifications"
    | "blogged"
    | "connections"
    | "comments"
    | "help"
    | "privacy-center"
    | "account-status"
    | "about";

export interface SettingItemDef {
    id: SettingsViewKey;
    label: string;
    description: string;
    icon: ReactNode;
    badge?: string;
    badgeColor?: string;
    group: "account-center" | "usage" | "support";
}
