import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireServerSecret } from './serverSecrets.js';

test('missing keys fail closed and errors contain only the setting name', () => {
    assert.throws(() => requireServerSecret('ORBIX_MISSING_TEST_KEY'), /requires a secure ORBIX_MISSING_TEST_KEY/);
});

test('production rejects weak placeholders while accepting configured keys', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        process.env.ORBIX_TEST_SIGNING_KEY = 'your_placeholder';
        assert.throws(() => requireServerSecret('ORBIX_TEST_SIGNING_KEY'), error => {
            assert.equal(String(error).includes('your_placeholder'), false);
            return true;
        });
        process.env.ORBIX_TEST_SIGNING_KEY = '9e380f6d4a2710bcde8251f3a670942bd4c59f0a128be367';
        assert.equal(requireServerSecret('ORBIX_TEST_SIGNING_KEY'), process.env.ORBIX_TEST_SIGNING_KEY);
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
        delete process.env.ORBIX_TEST_SIGNING_KEY;
    }
});
