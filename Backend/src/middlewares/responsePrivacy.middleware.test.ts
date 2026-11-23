import { test } from 'node:test';
import assert from 'node:assert/strict';
import { responsePrivacy, safeUnhandledError } from './responsePrivacy.middleware.js';
import { maskPublicContacts, maskPublicEmail, maskPublicPhone } from '../../../shared/privacy/publicContact.js';

function response(statusCode = 200) {
    let payload: any;
    const headers: Record<string, string> = {};
    const res: any = {
        statusCode,
        setHeader: (key: string, value: string) => { headers[key] = value; },
        json: (body: any) => { payload = body; return res; },
        status: (code: number) => { res.statusCode = code; return res; },
    };
    responsePrivacy({} as any, res, () => {});
    return { res, headers, payload: () => payload };
}

test('server errors suppress SQL, PII and provider details', () => {
    const { res, headers, payload } = response(500);
    res.json({ message: 'SELECT * FROM users', error: 'provider secret', user: { email: 'private@example.com' } });
    assert.deepEqual(payload(), { success: false, message: 'Something went wrong. Please try again.' });
    assert.equal(headers['Cache-Control'], 'private, no-store');
});

test('validation errors retain useful validation and machine codes without diagnostics', () => {
    const { res, payload } = response(400);
    res.json({ success: false, message: 'Name required', code: 'INVALID_NAME', error: 'SQL failed', details: { password: 'secret' }, stack: 'internal' });
    assert.deepEqual(payload(), { success: false, message: 'Name required', code: 'INVALID_NAME' });
});

test('uncaught exceptions use generic JSON instead of the Express HTML stack page', () => {
    const { res, payload } = response();
    safeUnhandledError(new Error('private details'), {} as any, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.stringify(payload()).includes('private details'), false);
});

test('public contacts mask aliases without mutating stored values', () => {
    const raw = { contactPhone: '+91 9312348844', contact_phone: '9312348844', publicEmail: 'person@gmail.com', contactEmail: 'lead@example.com', name: 'Club' };
    const masked = maskPublicContacts(raw);
    assert.equal(masked.contact_phone, '93******44');
    assert.equal(masked.contactPhone, '93******44');
    assert.equal(masked.publicEmail, 'p***@gmail.com');
    assert.equal(masked.contactEmail, 'l***@example.com');
    assert.equal(raw.contact_phone, '9312348844');
    assert.equal(JSON.stringify(masked).includes('9312348844'), false);
    assert.deepEqual(maskPublicContacts(masked), masked);
    assert.equal(maskPublicPhone('123'), '****');
    assert.equal(maskPublicPhone(null), null);
    assert.equal(maskPublicEmail('invalid'), '***');
});

test('database errors incorrectly classified as validation failures do not reveal schema details', () => {
    const { res, payload } = response(400);
    res.json({ message: 'relation private_users does not exist', error: 'query failed' });
    assert.equal(JSON.stringify(payload()).includes('private_users'), false);
    assert.equal(payload().success, false);
});
