export async function persistCodingProfiles(url: string, payload: unknown, headers: Record<string, string>): Promise<void> {
    const response = await fetch(url, {
        method: "POST", headers, credentials: "include", body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (result?.dbPersisted === false) {
        throw new Error("Coding profiles weren’t saved to your account. Please retry.");
    }
    if (!response.ok || !result || result.success === false) {
        throw new Error(result?.message || "Couldn’t save coding profiles. Your changes are ready to retry.");
    }
}
