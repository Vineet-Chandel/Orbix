/** Serialize writes so an older autosave cannot overwrite a newer explicit save. */
export function createDraftSaveQueue() {
    let tail: Promise<unknown> = Promise.resolve();
    let savedKey = "";
    return {
        markSaved(key: string) { savedKey = key; },
        enqueue(key: string, write: () => Promise<unknown>) {
            const task = tail.catch(() => undefined).then(async () => {
                if (savedKey === key) return;
                await write();
                savedKey = key;
            });
            tail = task;
            return task;
        },
    };
}
