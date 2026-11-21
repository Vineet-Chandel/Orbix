import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { resolveSheerIdResult, validSheerIdSignature, type SheerIdDetails } from './sheerIdPolicy.js';
const now = Date.UTC(2026, 10, 21);
const expected = { sessionId: 'session1234567890', programId: 'program123', institutionId: '1234', email: 'student@gmail.com', name: 'First Last' };
function details(): SheerIdDetails {
    return { programId: expected.programId, lastResponse: { verificationId: expected.sessionId, currentStep: 'success', segment: 'student' },
        personInfo: { firstName: 'First', lastName: 'Last', email: expected.email, organization: { id: 1234 } } };
}
test('signatures cover exact bytes and reject tampering, malformed and missing secrets', () => {
    const body = Buffer.from('{ "verificationId": "session1234567890" }');
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');
    assert.equal(validSheerIdSignature(body, signature, 'secret'), true);
    assert.equal(validSheerIdSignature(Buffer.from(body.toString().replace(' ', '')), signature, 'secret'), false);
    for (const invalid of ['', 'a', 'x'.repeat(64), signature.toUpperCase()]) assert.equal(validSheerIdSignature(body, invalid, 'secret'), false);
    assert.equal(validSheerIdSignature(body, signature, ''), false);
});
test('a bound student success grants one year, with normalized name and email', () => {
    const input = details(); input.personInfo!.email = 'STUDENT@gmail.com'; input.personInfo!.firstName = ' First  ';
    const result = resolveSheerIdResult(input, expected, now);
    assert.equal(result.status, 'APPROVED');
    assert.equal(result.expiresAt?.getTime(), now + 365 * 86400000);
});
test('known enrollment end caps annual renewal', () => {
    const input = details();
    input.confirmedSegments = [{ segment: 'student', active: true, organization: { id: 1234 }, endDate: now + 86400000 }];
    assert.equal(resolveSheerIdResult(input, expected, now).expiresAt?.getTime(), now + 86400000);
    input.confirmedSegments[0]!.endDate = now - 1;
    assert.equal(resolveSheerIdResult(input, expected, now).status, 'INVALIDATED');
});
test('inactive enrollment is rejected even on a success response', () => {
    const input = details(); input.confirmedSegments = [{ segment: 'student', active: false, organization: { id: 1234 } }];
    assert.equal(resolveSheerIdResult(input, expected, now).status, 'REJECTED');
});
test('session and program mismatch cannot fulfill', () => {
    for (const input of [{ ...details(), programId: 'another' }, { ...details(), lastResponse: { ...details().lastResponse, verificationId: 'another' } }]) {
        assert.throws(() => resolveSheerIdResult(input, expected, now), /binding mismatch/);
    }
});
test('wrong name, email, organization, segment and missing PII never approve', () => {
    const variants = [details(), details(), details(), details(), details()];
    variants[0]!.personInfo!.email = 'other@gmail.com';
    variants[1]!.personInfo!.firstName = 'Other';
    variants[2]!.personInfo!.organization = { id: 999 };
    variants[3]!.lastResponse!.segment = 'teacher';
    delete variants[4]!.personInfo;
    for (const input of variants) assert.equal(resolveSheerIdResult(input, expected, now).status, 'REJECTED');
});
test('pending, documents, email, unknown steps and SMS cannot approve', () => {
    for (const step of ['pending', 'docUpload', 'emailLoop', 'collectStudentPersonalInfo', 'unknown', 'smsLoop', 'error']) {
        const input = details(); input.lastResponse!.currentStep = step;
        assert.notEqual(resolveSheerIdResult(input, expected, now).status, 'APPROVED');
    }
});
test('document corrections explain unreadable and expired evidence', () => {
    const input = details(); input.lastResponse!.currentStep = 'docUpload';
    input.lastResponse!.rejectionReasons = ['DOCUMENT_UNREADABLE'];
    assert.match(resolveSheerIdResult(input, expected, now).reason!, /clearer/);
    input.lastResponse!.rejectionReasons = ['DOCUMENT_EXPIRED'];
    assert.match(resolveSheerIdResult(input, expected, now).reason!, /current/);
});
