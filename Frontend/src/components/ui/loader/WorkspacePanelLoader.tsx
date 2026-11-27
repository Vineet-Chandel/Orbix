export function WorkspacePanelLoader({ label = "Loading section…" }: { label?: string } = {}) {
    return (
        <div role="status" className="grid min-h-0 min-w-0 flex-1 place-items-center">
            <img src="/orbix-pixel-loader.svg" width={118} height={118} alt="" />
            <span className="sr-only">{label}</span>
        </div>
    );
}
