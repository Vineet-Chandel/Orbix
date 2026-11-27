import { WorkspacePanelLoader } from "./WorkspacePanelLoader";

export function AuthRouteLoader({ label }: { label: string }) {
    return (
        <div className="grid min-h-dvh place-items-center bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] p-4">
            <div className="flex min-h-56 w-full max-w-md rounded-3xl border-3 border-black bg-white shadow-[8px_8px_0px_#000]">
                <WorkspacePanelLoader label={label} />
            </div>
        </div>
    );
}
