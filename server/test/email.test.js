import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test';
const { sendWithFallback } = await import('../src/lib/email.js');

const email = { from: 'Thyra <no-reply@x.com>', to: 'a@b.co', subject: 'Hi', text: 'Hi', html: '<p>Hi</p>' };
const ok = (name, calls) => ({ name, send: async () => (calls.push(name), null) });
const rejects = (name, calls) => ({ name, send: async () => (calls.push(name), { message: 'nope' }) });
const throws = (name, calls) => ({
  name,
  send: async () => {
    calls.push(name);
    throw new Error('down');
  },
});

describe('email fallback', () => {
  it('stops at the first provider that accepts the email', async () => {
    const calls = [];
    assert.equal(await sendWithFallback(email, [ok('Resend', calls), ok('SendByte', calls)], () => {}), 'Resend');
    assert.deepEqual(calls, ['Resend']);
  });

  it('falls back when the first provider rejects the email or is down', async () => {
    let calls = [];
    const logs = [];
    assert.equal(await sendWithFallback(email, [rejects('Resend', calls), ok('SendByte', calls)], (m) => logs.push(m)), 'SendByte');
    assert.deepEqual(calls, ['Resend', 'SendByte']);
    assert.match(logs[0], /Resend rejected "Hi"; trying SendByte/);

    calls = [];
    assert.equal(await sendWithFallback(email, [throws('Resend', calls), ok('SendByte', calls)], () => {}), 'SendByte');
    assert.deepEqual(calls, ['Resend', 'SendByte']);
  });

  it('reports failure when every provider fails', async () => {
    const calls = [];
    assert.equal(await sendWithFallback(email, [rejects('SendByte', calls), throws('Resend', calls)], () => {}), null);
    assert.deepEqual(calls, ['SendByte', 'Resend']);
  });
});
