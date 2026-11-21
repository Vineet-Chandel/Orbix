import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CollegeClubItem } from "../utils/clubProfileApi";
import { useModalDismiss } from "../hooks/useModalDismiss";
import PublicClubProfilePage from "../app/Club/PublicClubProfilePage";

export interface ClubDetailModalProps {
    club: CollegeClubItem | null;
    isOpen: boolean;
    onClose: () => void;
    onNavigateToEdit?: () => void;
}

export const ClubDetailModal: React.FC<ClubDetailModalProps> = ({
    club,
    isOpen,
    onClose,
    onNavigateToEdit,
}) => {
    useModalDismiss({ isOpen, onClose });

    // Lock body scroll while modal is active
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    if (!isOpen || !club) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] w-screen h-screen bg-[#FAF6EE] overflow-y-auto animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-modal-title"
        >
            <PublicClubProfilePage
                overrideSlug={club.slug}
                initialClubData={club}
                onClose={onClose}
                onNavigateToEdit={onNavigateToEdit}
            />
        </div>,
        document.body
    );
};
