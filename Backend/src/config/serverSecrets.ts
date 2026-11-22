import 'dotenv/config';

/** Missing signing keys must fail closed instead of using a shared public key. */
export function requireServerSecret(name: string): string {
    const value = process.env[name];
    if (!value || (process.env.NODE_ENV === 'production' && (value.length < 32 || /your_|fallback|test_secret/i.test(value)))) {
        throw new Error(`Server configuration requires a secure ${name}.`);
    }
    return value;
}
