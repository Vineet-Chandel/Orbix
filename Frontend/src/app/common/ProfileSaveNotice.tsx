import { LoaderCircle } from "lucide-react";
import { ToastActionNotice } from "../../context/ToastContext";

type ProfileSaveNoticeProps = {
    open: boolean;
    isSaving: boolean;
    onCancel: () => void;
} & (
    | { formId: string; onSave?: never }
    | { formId?: never; onSave: () => void }
);

export function ProfileSaveNotice({ open, isSaving, onCancel, formId, onSave }: ProfileSaveNoticeProps) {
    return (
        <ToastActionNotice
            open={open}
            title={isSaving ? "Saving profile changes…" : "Unsaved profile changes"}
            actions={
                <>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={onCancel}
                        className="inline-flex items-center justify-center rounded-xl border-2 border-black bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 disabled:opacity-60 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
                    >
                        Cancel
                    </button>
                    <button
                        type={formId ? "submit" : "button"}
                        form={formId}
                        onClick={onSave}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black bg-[#a2ff86] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] disabled:opacity-60 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
                    >
                        {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Save changes
                    </button>
                </>
            }
        />
    );
}
