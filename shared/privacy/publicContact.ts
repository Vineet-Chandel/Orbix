/** Public display only. Never return a raw contact alongside its masked version. */
export function maskPublicPhone(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (/^\d{2}\*+\d{2}$/.test(value)) return value;
    const rawDigits = value.replace(/\D/g, '');
    const digits = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    if (digits.length < 7) return '****';
    return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 4)}${digits.slice(-2)}`;
}

export function maskPublicEmail(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const [local, domain] = value.trim().split('@');
    if (!local || !domain) return '***';
    if (/^[^@]\*{3}$/.test(local)) return `${local}@${domain}`;
    return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPublicContacts<T extends Record<string, any>>(record: T): T {
    const result = { ...record };
    for (const key of ['contactPhone', 'contact_phone', 'phone', 'phoneNumber', 'phone_number']) {
        if (key in result) (result as Record<string, any>)[key] = maskPublicPhone(result[key]);
    }
    for (const key of ['publicEmail', 'public_email', 'contactEmail', 'contact_email', 'email', 'gmail']) {
        if (key in result) (result as Record<string, any>)[key] = maskPublicEmail(result[key]);
    }
    return result;
}
