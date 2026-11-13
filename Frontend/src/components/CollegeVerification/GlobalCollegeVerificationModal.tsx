import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "../../store";
import { CollegeVerificationModal } from "./CollegeVerificationModal";
import {
    ORBIX_OPEN_COLLEGE_VERIFICATION_EVENT,
    emitCollegeVerificationUpdated,
    type OpenCollegeVerificationDetail,
} from "../../utils/collegeVerificationModalEvents";

/**
 * Single authoritative College Verification Modal host.
 * Mounted once at router root level in App.tsx.
 * Eliminates duplicate portal instances across individual pages.
 */
export const GlobalCollegeVerificationModal: React.FC = () => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);

    const [isOpen, setIsOpen] = useState(false);
    const [overrideCollege, setOverrideCollege] = useState<{ id?: string | null; name?: string | null } | null>(null);

    // Listen to global open trigger
    useEffect(() => {
        const handleOpen = (e: Event) => {
            const detail = (e as CustomEvent<OpenCollegeVerificationDetail>)?.detail;
            if (detail && (detail.collegeId || detail.collegeName)) {
                setOverrideCollege({ id: detail.collegeId, name: detail.collegeName });
            } else {
                setOverrideCollege(null);
            }
            setIsOpen(true);
        };

        window.addEventListener(ORBIX_OPEN_COLLEGE_VERIFICATION_EVENT, handleOpen);
        return () => window.removeEventListener(ORBIX_OPEN_COLLEGE_VERIFICATION_EVENT, handleOpen);
    }, []);

    // Account switch guard: reset and close immediately if user identity changes or signs out
    const previousUserIdRef = useRef(user?.id);
    useEffect(() => {
        if (previousUserIdRef.current && user?.id !== previousUserIdRef.current) {
            setIsOpen(false);
            setOverrideCollege(null);
        }
        previousUserIdRef.current = user?.id;
    }, [user?.id]);

    // Do not mount modal if user is not signed in or is a club account
    if (!user || user.accountType === "club") return null;

    return (
        <CollegeVerificationModal
            isOpen={isOpen}
            onClose={() => {
                setIsOpen(false);
                setOverrideCollege(null);
            }}
            currentCollegeName={overrideCollege?.name || user.college?.officialName}
            currentCollegeId={overrideCollege?.id || user.college?.id || user.collegeId}
            onVerificationSubmitted={() => {
                dispatch(fetchUserProfile({ force: true }));
                emitCollegeVerificationUpdated();
            }}
        />
    );
};
