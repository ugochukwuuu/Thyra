import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { client, ctx, query, registered, signup, staff, tokenFrom, useTestApp, userFolder, verifyEmail } from './helpers.js';

useTestApp();

const { notifyStalled, sendWeeklySummary } = await import('../src/lib/jobs.js');

const completeDraft = () => ({
  businessInfo: { name: 'Ade Fine Jewellery', description: 'Gold.', email: 'hello@ade.com', phone: '+234 800', address: 'Lagos' },
  aboutBrand: {
    values: [
      { id: 'v1', title: 'Craft' },
      { id: 'v2', title: 'Honesty' },
      { id: 'v3', title: 'Care' },
    ],
  },
});

async function submittedClient(email = 'ade@example.com') {
  const { c, user } = await registered({ email });
  await verifyEmail(user.id);
  await c.put('/api/onboarding', { ...completeDraft(), currentStep: 9 });
  assert.equal((await c.post('/api/onboarding/submit')).status, 200);
  return { c, user };
}

async function inviteClient(admin, email = 'kemi@kora.co') {
  const res = await admin.post('/api/admin/invites', { businessName: 'Kora Skin Co.', contactName: 'Kemi Adebayo', email, note: 'Great call today.' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.invite;
}

describe('email verification', () => {
  it('emails a link on sign-up and blocks submitting until it is used', async () => {
    const { c, user } = await registered();
    assert.equal(user.emailVerified, false);
    await c.put('/api/onboarding', { ...completeDraft(), currentStep: 9 });

    const blocked = await c.post('/api/onboarding/submit');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'email_unverified');

    const token = tokenFrom('verify_email');
    assert.equal((await client().post('/api/auth/verify-email', { token })).status, 200);
    assert.equal((await client().post('/api/auth/verify-email', { token })).status, 400); // single use
    assert.equal((await c.get('/api/auth/me')).body.user.emailVerified, true);
    assert.equal((await c.post('/api/onboarding/submit')).status, 200);
  });

  it('resending replaces the old link', async () => {
    const { c } = await registered();
    const first = tokenFrom('verify_email');
    assert.equal((await c.post('/api/auth/resend-verification')).status, 200);
    const second = tokenFrom('verify_email');
    assert.notEqual(first, second);
    assert.equal((await client().post('/api/auth/verify-email', { token: first })).status, 400);
    assert.equal((await client().post('/api/auth/verify-email', { token: second })).status, 200);
  });

  it('uses the expiry chosen in Settings', async () => {
    const { c: admin } = await staff();
    const current = (await admin.get('/api/admin/settings')).body.settings.onboarding;
    await admin.put('/api/admin/settings/onboarding', { ...current, verificationHours: 48 });
    await registered();
    const { rows } = await query('SELECT extract(epoch from (expires_at - created_at)) / 3600 AS hours FROM email_verifications');
    assert.equal(Math.round(Number(rows[0].hours)), 48);
  });
});

describe('client invites', () => {
  it('lets an admin invite a client, who signs up already verified', async () => {
    const { c: admin } = await staff();
    await inviteClient(admin);
    const email = ctx.sent.find((m) => m.kind === 'client_invite');
    assert.equal(email.to, 'kemi@kora.co');
    assert.ok(email.paragraphs.includes('Great call today.'));

    const token = tokenFrom('client_invite');
    const details = await client().get(`/api/auth/invites/${token}`);
    assert.equal(details.body.invite.businessName, 'Kora Skin Co.');
    assert.equal(details.body.invite.inviterName, 'Eze Mitchel');

    // The account always uses the invited email, whatever the form sends.
    const c = client();
    const res = await c.post('/api/auth/register', signup({ email: 'someone-else@example.com', businessName: 'Kora Skin Co.', inviteToken: token }));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'kemi@kora.co');
    assert.equal(res.body.user.emailVerified, true);
    assert.equal(res.body.user.fullName, 'Kemi Adebayo');

    assert.equal((await client().get(`/api/auth/invites/${token}`)).status, 404); // used up
    const { clients } = (await admin.get('/api/admin/clients')).body;
    assert.deepEqual(clients.map((x) => [x.email, x.status]), [['kemi@kora.co', 'notstarted']]);
  });

  it('refuses expired and revoked invites, and resending issues a new link', async () => {
    const { c: admin } = await staff();
    const invite = await inviteClient(admin);
    const first = tokenFrom('client_invite');

    assert.equal((await admin.post(`/api/admin/invites/${invite.id}/resend`)).status, 200);
    const second = tokenFrom('client_invite');
    assert.notEqual(first, second);
    assert.equal((await client().get(`/api/auth/invites/${first}`)).status, 404);

    await query(`UPDATE invites SET expires_at = now() - interval '1 minute'`);
    const expired = await client().post('/api/auth/register', signup({ inviteToken: second }));
    assert.equal(expired.status, 400);
    assert.match(expired.body.error.message, /expired/);

    assert.equal((await admin.del(`/api/admin/invites/${invite.id}`)).status, 204);
    assert.equal((await client().get(`/api/auth/invites/${second}`)).status, 404);
  });

  it('will not invite an email that already has an account or invite', async () => {
    const { c: admin } = await staff();
    await registered({ email: 'taken@example.com' });
    assert.equal((await admin.post('/api/admin/invites', { businessName: 'X', contactName: 'Y', email: 'taken@example.com' })).status, 409);
    await inviteClient(admin);
    assert.equal((await admin.post('/api/admin/invites', { businessName: 'X', contactName: 'Y', email: 'KEMI@kora.co' })).status, 409);
  });

  it('closes an open invite when that person signs up on their own', async () => {
    const { c: admin } = await staff();
    await inviteClient(admin);
    await registered({ email: 'kemi@kora.co' });
    const { clients } = (await admin.get('/api/admin/clients')).body;
    assert.deepEqual(clients.map((x) => x.status), ['notstarted']);
  });
});

describe('staff access', () => {
  it('keeps clients out of the admin and the staff login', async () => {
    const { c } = await registered();
    assert.equal((await c.get('/api/admin/clients')).status, 403);
    const res = await client().post('/api/auth/login', { email: 'ade@example.com', password: 'correct horse', scope: 'staff' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, "That email and password don't match.");
  });

  it('lets viewers read and export, but not change anything', async () => {
    const { c: viewer } = await staff('viewer');
    const { user } = await submittedClient();
    assert.equal((await viewer.get('/api/admin/clients')).status, 200);
    assert.equal((await viewer.get(`/api/admin/clients/${user.id}`)).status, 200);
    assert.equal((await viewer.get(`/api/admin/clients/${user.id}/products.csv`)).status, 200);
    assert.equal((await viewer.get('/api/admin/leads')).status, 200);

    assert.equal((await viewer.post('/api/admin/invites', { businessName: 'X', contactName: 'Y', email: 'x@y.co' })).status, 403);
    assert.equal((await viewer.post(`/api/admin/clients/${user.id}/archive`)).status, 403);
    assert.equal((await viewer.post(`/api/admin/clients/${user.id}/change-requests`, { step: 0, message: 'Fix' })).status, 403);
    assert.equal((await viewer.get('/api/admin/settings')).status, 403);
  });

  it('gives staff a one hour reset link that opens the admin reset page', async () => {
    await staff();
    await client().post('/api/auth/forgot-password', { email: 'admin@thyra.co' });
    const msg = ctx.sent.find((m) => m.kind === 'password_reset');
    assert.match(msg.link, /\/admin\/reset-password\?token=.+&email=admin%40thyra\.co$/);
    const { rows } = await query('SELECT extract(epoch from (expires_at - created_at)) / 60 AS mins FROM password_resets');
    assert.equal(Math.round(Number(rows[0].mins)), 60);
  });
});

describe('submissions', () => {
  it('lists every client with the status the admin sees', async () => {
    const { c: admin } = await staff();
    await registered({ email: 'new@example.com' });
    const { c: busy } = await registered({ email: 'busy@example.com' });
    await busy.put('/api/onboarding', { businessInfo: { name: 'Busy Co' }, currentStep: 4 });
    await submittedClient('done@example.com');
    await inviteClient(admin, 'invited@example.com');

    const { clients } = (await admin.get('/api/admin/clients')).body;
    const by = Object.fromEntries(clients.map((x) => [x.email, x]));
    assert.equal(by['new@example.com'].status, 'notstarted');
    assert.equal(by['busy@example.com'].status, 'progress');
    assert.equal(by['busy@example.com'].done, 4);
    assert.equal(by['busy@example.com'].name, 'Busy Co');
    assert.equal(by['done@example.com'].status, 'submitted');
    assert.equal(by['done@example.com'].done, 9);
    assert.equal(by['invited@example.com'].status, 'invited');
    assert.equal(by['invited@example.com'].kind, 'invite');
  });

  it('sends a change request that reopens the form, and resubmitting answers it', async () => {
    const { c: admin } = await staff();
    const { c, user } = await submittedClient();

    const req = await admin.post(`/api/admin/clients/${user.id}/change-requests`, {
      step: 6, message: 'Your logo is low resolution.', items: ['logo.png'],
    });
    assert.equal(req.status, 201);
    assert.equal(ctx.sent.find((m) => m.kind === 'changes_requested').to, 'ade@example.com');

    const mine = (await c.get('/api/onboarding')).body.submission;
    assert.equal(mine.status, 'changes_requested');
    assert.deepEqual(mine.changeRequests.map((x) => [x.step, x.message, x.flaggedItems]), [[6, 'Your logo is low resolution.', ['logo.png']]]);
    assert.equal((await admin.get('/api/admin/clients')).body.clients[0].status, 'changes');

    // The client can edit again, then confirms.
    assert.equal((await c.put('/api/onboarding', { visualIdentity: { brandColor: '#111111' } })).status, 200);
    assert.equal((await c.post('/api/onboarding/submit')).body.submission.status, 'submitted');
    assert.deepEqual((await c.get('/api/onboarding')).body.submission.changeRequests, []);

    const detail = (await admin.get(`/api/admin/clients/${user.id}`)).body;
    assert.equal(detail.client.status, 'submitted');
    assert.equal(detail.changeRequests[0].section, 'Visual identity');
    assert.ok(detail.changeRequests[0].resolvedAt);
  });

  it('archives, restores, and deletes only with the exact business name', async () => {
    const { c: admin } = await staff();
    const { c, user } = await submittedClient();
    assert.equal((await admin.post(`/api/admin/clients/${user.id}/archive`)).status, 200);
    assert.equal((await admin.get('/api/admin/clients')).body.clients[0].archived, true);
    assert.equal((await admin.post(`/api/admin/clients/${user.id}/restore`)).status, 200);
    assert.equal((await admin.get('/api/admin/clients')).body.clients[0].archived, false);

    assert.equal((await admin.del(`/api/admin/clients/${user.id}`, { confirmName: 'ade fine jewellery' })).status, 400);
    assert.equal((await admin.del(`/api/admin/clients/${user.id}`, { confirmName: 'Ade Fine Jewellery' })).status, 204);
    assert.equal((await admin.get(`/api/admin/clients/${user.id}`)).status, 404);
    assert.equal((await c.get('/api/onboarding')).status, 401); // their session no longer works
  });

  it('exports products as a WooCommerce CSV using the export settings', async () => {
    const { c: admin } = await staff();
    const { c, user } = await registered();
    const img = { url: 'https://res.cloudinary.com/demo/image/upload/r.jpg', publicId: `${userFolder(user.id)}/r`, name: 'r.jpg', resourceType: 'image' };
    await c.put('/api/onboarding', {
      products: {
        categories: [{ id: 'c1', name: 'Tops', subcategories: [{ id: 's1', name: 'Blouses' }] }],
        items: [
          {
            id: 'p1', name: 'Silk blouse', categoryIds: ['c1'], subcategoryIds: ['s1'], mainImage: img, price: 30000,
            shortDescription: '=HYPERLINK("http://evil")',
            variations: [
              { id: 'v1', name: 'Size', priceVaries: true, options: [{ id: 'o1', label: 'S', price: 30000 }, { id: 'o2', label: 'M', price: 32000 }] },
              { id: 'v2', name: 'Colour', priceVaries: false, options: [{ id: 'o3', label: 'Red' }] },
            ],
          },
          { id: 'p2', name: 'No photo tee', price: 5000 },
        ],
      },
    });

    const csv = (await admin.get(`/api/admin/clients/${user.id}/products.csv`)).body;
    const rows = csv.replace(/^﻿/, '').trim().split('\r\n');
    assert.match(rows[0], /^"Type","SKU","Name","Published"/);
    assert.equal(rows.length, 4); // header, the variable product and its 2 variations; the no-photo tee is left out by default
    assert.match(rows[1], /^"variable","THY-ADE-FINE-JEWELLERY-001","Silk blouse","-1"/);
    assert.match(rows[1], /"Tops > Blouses"/);
    assert.match(rows[1], /"'=HYPERLINK\(""http:\/\/evil""\)"/); // formula neutralised
    assert.match(rows[3], /^"variation","THY-ADE-FINE-JEWELLERY-001-2","Silk blouse - M, Red","-1","","","1","32000"/);

    const current = (await admin.get('/api/admin/settings')).body.settings.export;
    await admin.put('/api/admin/settings/export', { ...current, skuPrefix: 'ADE-', importAs: 'published', includeNoImages: true });
    const again = (await admin.get(`/api/admin/clients/${user.id}/products.csv`)).body.trim().split('\r\n');
    assert.equal(again.length, 5);
    assert.match(again[4], /^"simple","ADE-ADE-FINE-JEWELLERY-002","No photo tee","1"/);

    assert.deepEqual((await admin.get(`/api/admin/clients/${user.id}`)).body.issues.noImages, ['No photo tee']);
  });
});

describe('leads', () => {
  it('accepts the public form, drops bots, and lets admins move stages', async () => {
    const { c: admin } = await staff();
    const form = { businessName: 'Mira Bakes', contactName: 'Mira', businessType: 'Food & drink', email: 'MIRA@bakes.ng', callDate: '2026-10-09' };

    const res = await fetch(`${ctx.base}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify(form),
    });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal((await client().post('/api/leads', { ...form, website: 'spam.example' })).status, 201);

    const { leads } = (await admin.get('/api/admin/leads')).body;
    assert.equal(leads.length, 1);
    assert.equal(leads[0].email, 'mira@bakes.ng');
    assert.equal(leads[0].stage, 'booked'); // a call date means the call is booked
    assert.equal(leads[0].callDate, '2026-10-09');

    assert.equal((await admin.patch(`/api/admin/leads/${leads[0].id}`, { stage: 'won' })).body.lead.stage, 'won');
    assert.equal((await client().post('/api/leads', { businessName: 'X', email: 'nope' })).status, 400);
  });

  it('serves the business types from Settings to the form', async () => {
    const { c: admin } = await staff();
    const current = (await admin.get('/api/admin/settings')).body.settings.onboarding;
    await admin.put('/api/admin/settings/onboarding', { ...current, businessTypes: ['Bakery', 'Bakery', ' ', 'Florist'] });
    assert.deepEqual((await client().get('/api/leads/options')).body.options.businessTypes, ['Bakery', 'Florist']);
  });
});

describe('team', () => {
  it('invites a staff member who joins with their own password', async () => {
    const { c: admin } = await staff();
    assert.equal((await admin.post('/api/admin/team/invites', { email: 'funmi@thyra.co', role: 'viewer' })).status, 201);
    const msg = ctx.sent.find((m) => m.kind === 'staff_invite');
    assert.match(msg.link, /\/admin\/join\?token=.+&role=Viewer&inviter=Eze\+Mitchel/);

    const joined = await client().post('/api/auth/join-team', {
      token: tokenFrom('staff_invite'), fullName: 'Funmi Bello', password: 'funmi password', confirmPassword: 'funmi password',
    });
    assert.equal(joined.status, 201);
    assert.equal(joined.body.user.role, 'viewer');

    const team = (await admin.get('/api/admin/team')).body;
    assert.deepEqual(team.members.map((m) => m.name), ['Eze Mitchel', 'Funmi Bello']);
    assert.deepEqual(team.invites, []);
  });

  it('protects the last admin and your own access', async () => {
    const { c: admin, id } = await staff();
    const { id: otherId } = await staff('viewer', 'funmi@thyra.co');
    assert.equal((await admin.patch(`/api/admin/team/${id}`, { role: 'viewer' })).status, 400);
    assert.equal((await admin.del(`/api/admin/team/${id}`)).status, 400);
    assert.equal((await admin.patch(`/api/admin/team/${otherId}`, { role: 'admin' })).status, 200);
    assert.equal((await admin.del(`/api/admin/team/${otherId}`)).status, 204);
  });
});

describe('settings and account', () => {
  it('saves settings and feeds them to the client form', async () => {
    const { c: admin } = await staff();
    const current = (await admin.get('/api/admin/settings')).body.settings.onboarding;
    assert.equal((await admin.put('/api/admin/settings/onboarding', { ...current, replyTo: 'nope' })).status, 400);
    await admin.put('/api/admin/settings/onboarding', { ...current, voiceInput: false, socialPlatforms: ['Instagram', 'Threads'] });

    const { c } = await registered();
    assert.deepEqual((await c.get('/api/onboarding/options')).body.options, { socialPlatforms: ['Instagram', 'Threads'], voiceInput: false });
  });

  it('needs the current password to change your email or password', async () => {
    const { c: admin } = await staff();
    const base = { fullName: 'Eze M', email: 'admin@thyra.co' };
    assert.equal((await admin.put('/api/admin/me/account', base)).body.user.fullName, 'Eze M');

    const noPw = await admin.put('/api/admin/me/account', { ...base, email: 'eze@thyra.co' });
    assert.equal(noPw.status, 400);
    assert.ok(noPw.body.error.fields.currentPassword);

    const ok = await admin.put('/api/admin/me/account', {
      ...base, email: 'eze@thyra.co', currentPassword: 'staff passphrase 1', newPassword: 'new staff pass', confirmPassword: 'new staff pass',
    });
    assert.equal(ok.status, 200);
    assert.equal((await client().post('/api/auth/login', { email: 'eze@thyra.co', password: 'new staff pass', scope: 'staff' })).status, 200);
  });

  it('stores notification choices per person', async () => {
    const { c: admin } = await staff();
    assert.equal((await admin.get('/api/admin/me/notifications')).body.notifications.to, 'admin@thyra.co');
    const saved = await admin.put('/api/admin/me/notifications', { signup: false, submitted: true, stalled: true, weekly: true, to: 'ops@thyra.co' });
    assert.deepEqual(saved.body.notifications, { signup: false, submitted: true, stalled: true, weekly: true, to: 'ops@thyra.co' });
  });
});

describe('notifications', () => {
  it('tells staff about sign-ups and submissions, respecting their choices', async () => {
    const { c: admin } = await staff();
    const { c: viewer } = await staff('viewer', 'viewer@thyra.co');
    await viewer.put('/api/admin/me/notifications', { signup: false, submitted: true, stalled: true, weekly: false, to: 'viewer@thyra.co' });
    void admin;

    await submittedClient();
    await new Promise((r) => setTimeout(r, 50)); // notifications are sent in the background
    const staffMail = ctx.sent.filter((m) => m.kind === 'staff_notification');
    assert.deepEqual(
      staffMail.map((m) => `${m.to}: ${m.subject}`).sort(),
      [
        'admin@thyra.co: Ade Fine Jewellery submitted their onboarding',
        'admin@thyra.co: New client: Ade Fine Jewellery',
        'viewer@thyra.co: Ade Fine Jewellery submitted their onboarding',
      ],
    );
  });

  it('sends one stalled email per stall', async () => {
    await staff();
    const { c } = await registered();
    await c.put('/api/onboarding', { businessInfo: { name: 'Slow Co' } });
    await query(`UPDATE onboarding_submissions SET updated_at = now() - interval '8 days'`);
    ctx.sent = [];

    assert.equal(await notifyStalled(), 1);
    assert.equal(await notifyStalled(), 0);
    assert.equal(ctx.sent.filter((m) => m.subject === "Slow Co hasn't continued their onboarding").length, 1);
  });

  it('sends the weekly summary once, on Monday morning in Lagos', async () => {
    const { c: admin } = await staff();
    await admin.put('/api/admin/me/notifications', { signup: false, submitted: false, stalled: false, weekly: true, to: 'admin@thyra.co' });
    const tuesday = new Date('2026-10-06T10:00:00Z');
    const mondayEarly = new Date('2026-10-12T05:00:00Z'); // 6am in Lagos
    const mondayLater = new Date('2026-10-12T09:00:00Z'); // 10am in Lagos
    assert.equal(await sendWeeklySummary(tuesday), false);
    assert.equal(await sendWeeklySummary(mondayEarly), false);
    assert.equal(await sendWeeklySummary(mondayLater), true);
    assert.equal(await sendWeeklySummary(mondayLater), false);
    assert.equal(ctx.sent.filter((m) => m.subject?.startsWith('Thyra weekly summary')).length, 1);
  });
});
