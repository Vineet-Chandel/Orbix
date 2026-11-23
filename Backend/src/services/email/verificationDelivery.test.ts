import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProductionDelivery } from './verificationDelivery.js';

test('production rejects failed, simulated and sandbox-restricted verification delivery', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        for (const result of [{ success: false }, { success: true, simulated: true }, { success: true, sandboxRestricted: true }]) {
            assert.throws(() => assertProductionDelivery(result), (error: any) => error.statusCode === 503);
        }
        assert.doesNotThrow(() => assertProductionDelivery({ success: true }));
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
    }
});
