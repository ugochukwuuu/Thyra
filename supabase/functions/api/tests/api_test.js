import assert from 'node:assert/strict';
import { describe, it } from '@std/testing/bdd';
import { client, ctx, passwordOf, query, registered, signup, staff, tokenFrom, useTestApp, userFolder, verifyEmail } from './helpers.js';

useTestApp();

describe('register', () => {
  it('creates a client, a sign-in account and an empty submission', async () => {
    const c = client();
    const res = await c.post('/api/auth/register', signup({ email: '  Ade@Example.com ' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'ade@example.com');
    assert.equal(res.body.user.role, 'client');
    assert.equal(res.body.user.businessName, 'Ade Fine Jewellery');
    assert.equal(passwordOf('ade@example.com'), 'correct horse');

    const { rows } = await query('SELECT status, current_step FROM onboarding_submissions');
    assert.deepEqual(rows, [{ status: 'in_progress', current_step: 0 }]);

    assert.ok(c.signIn('ade@example.com', 'correct horse'));
    const me = await c.get('/api/auth/me');
    assert.equal(me.body.user.email, 'ade@example.com');
  });

  it('rejects bad input with per-field messages', async () => {
    const res = await client().post('/api/auth/register', {
      businessName: ' ',
      email: 'nope',
      password: 'short',
      confirmPassword: 'different',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.fields.businessName, 'Enter your business name.');
    assert.equal(res.body.error.fields.email, 'Enter a valid email address.');
    assert.equal(res.body.error.fields.password, 'Use at least 8 characters.');
  });

  it("flags passwords that don't match", async () => {
    const res = await client().post('/api/auth/register', signup({ confirmPassword: 'other thing' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.fields.confirmPassword, "Those passwords don't match.");
  });

  it('rejects passwords over bcrypt’s 72-byte limit', async () => {
    const long = 'a'.repeat(73);
    const res = await client().post('/api/auth/register', signup({ password: long, confirmPassword: long }));
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.password);
  });

  it('refuses a duplicate email, ignoring case', async () => {
    await registered();
    const res = await client().post('/api/auth/register', signup({ email: 'ADE@example.com' }));
    assert.equal(res.status, 409);
    assert.ok(res.body.error.fields.email);
  });

  it('ignores a role sent in the body', async () => {
    const res = await client().post('/api/auth/register', { ...signup(), role: 'admin' });
    assert.equal(res.body.user.role, 'client');
  });
});

describe('sessions', () => {
  it('needs an access token, and rejects a made-up one', async () => {
    assert.equal((await client().get('/api/auth/me')).status, 401);
    const forged = await client().get('/api/auth/me', { Authorization: 'Bearer abc.def.ghi' });
    assert.equal(forged.status, 401);
  });

  it('stops working once the account is deleted', async () => {
    const { c, user } = await registered();
    await query('DELETE FROM auth.users WHERE id = $1', [user.id]);
    assert.equal((await c.get('/api/auth/me')).status, 401);
  });
});

describe('password reset', () => {
  it('answers identically whether or not the account exists, and only emails real accounts', async () => {
    await registered();
    const known = await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    const unknown = await client().post('/api/auth/forgot-password', { email: 'ghost@example.com' });
    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body);
    const resets = ctx.sent.filter((m) => m.kind === 'password_reset');
    assert.equal(resets.length, 1);
    assert.equal(resets[0].to, 'ade@example.com');
  });

  it('stores only a hash of the token and expires it after 15 minutes', async () => {
    await registered();
    await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    const { rows } = await query(`SELECT token_hash, extract(epoch from (expires_at - created_at)) AS ttl FROM password_resets`);
    assert.notEqual(rows[0].token_hash, tokenFrom('password_reset'));
    assert.equal(Math.round(Number(rows[0].ttl) / 60), 15);
  });

  it('sets a new password once, and the old one stops working', async () => {
    await registered();
    await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    const token = tokenFrom('password_reset');

    const reset = await client().post('/api/auth/reset-password', { token, password: 'brand new pass', confirmPassword: 'brand new pass' });
    assert.equal(reset.status, 200);

    const again = await client().post('/api/auth/reset-password', { token, password: 'another one here', confirmPassword: 'another one here' });
    assert.equal(again.status, 400);

    assert.equal(client().signIn('ade@example.com', 'correct horse'), false);
    assert.equal(client().signIn('ade@example.com', 'brand new pass'), true);
  });

  it('rejects an expired token', async () => {
    await registered();
    await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    await query(`UPDATE password_resets SET expires_at = now() - interval '1 second'`);
    const res = await client().post('/api/auth/reset-password', {
      token: tokenFrom('password_reset'),
      password: 'brand new pass',
      confirmPassword: 'brand new pass',
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /expired/);
  });

  it('only honours the newest link', async () => {
    await registered();
    await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    const first = tokenFrom('password_reset');
    await client().post('/api/auth/forgot-password', { email: 'ade@example.com' });
    const second = tokenFrom('password_reset');
    const body = { password: 'brand new pass', confirmPassword: 'brand new pass' };
    assert.equal((await client().post('/api/auth/reset-password', { token: first, ...body })).status, 400);
    assert.equal((await client().post('/api/auth/reset-password', { token: second, ...body })).status, 200);
  });

  it('rejects a made-up token', async () => {
    const res = await client().post('/api/auth/reset-password', {
      token: 'f'.repeat(64),
      password: 'brand new pass',
      confirmPassword: 'brand new pass',
    });
    assert.equal(res.status, 400);
  });
});

describe('onboarding', () => {
  const goodFile = (userId, name = 'a.jpg', extra = {}) => ({
    url: `https://res.cloudinary.com/demo/image/upload/${name}`,
    publicId: `${userFolder(userId)}/${name}`,
    name,
    resourceType: 'image',
    ...extra,
  });

  const completeDraft = () => ({
    businessInfo: {
      name: 'Ade Fine Jewellery',
      description: 'Handmade gold jewellery.',
      email: 'hello@ade.com',
      phone: '+234 800 000 0000',
      address: '12 Awolowo Road, Lagos',
    },
    aboutBrand: {
      story: 'It began in a small workshop.',
      values: [
        { id: 'v1', title: 'Craft', description: 'Slow work' },
        { id: 'v2', title: 'Honesty', description: '' },
        { id: 'v3', title: 'Care', description: '' },
      ],
    },
  });

  const stepsOf = (res) => [...new Set(res.body.error.problems.map((p) => p.step))].sort((a, b) => a - b);

  it('requires a logged-in client', async () => {
    assert.equal((await client().get('/api/onboarding')).status, 401);
    assert.equal((await client().put('/api/onboarding', {})).status, 401);
  });

  it('keeps staff out', async () => {
    const { c } = await staff('admin', 'boss@thyra.co');
    assert.equal((await c.get('/api/onboarding')).status, 403);
  });

  it('starts empty and in progress, with a section for every step', async () => {
    const { c } = await registered();
    const { submission } = (await c.get('/api/onboarding')).body;
    assert.equal(submission.status, 'in_progress');
    assert.equal(submission.currentStep, 0);
    for (const key of ['businessInfo', 'products', 'homePage', 'aboutBrand', 'contactPage', 'inspiration', 'visualIdentity', 'socialMedia', 'policies']) {
      assert.deepEqual(submission[key], {}, key);
    }
  });

  it('autosaves sections independently and normalises them', async () => {
    const { c } = await registered();
    await c.put('/api/onboarding', { businessInfo: { name: 'Ade' }, currentStep: 3 });
    await c.put('/api/onboarding', { policies: { privacy: { text: 'We keep it private.' } } });

    const { submission } = (await c.get('/api/onboarding')).body;
    assert.equal(submission.currentStep, 3);
    assert.deepEqual(submission.businessInfo, { name: 'Ade', description: '', email: '', phone: '', address: '' });
    assert.deepEqual(submission.policies.privacy, { text: 'We keep it private.', draft: false });
    assert.deepEqual(submission.policies.terms, { text: '', draft: false });
  });

  it('accepts step 9 (review) and rejects anything past it', async () => {
    const { c } = await registered();
    assert.equal((await c.put('/api/onboarding', { currentStep: 9 })).status, 200);
    assert.equal((await c.put('/api/onboarding', { currentStep: 10 })).status, 400);
  });

  it('never saves fields it does not know about', async () => {
    const { c } = await registered();
    await c.put('/api/onboarding', { businessInfo: { name: 'Ade', isAdmin: true }, status: 'submitted' });
    const { submission } = (await c.get('/api/onboarding')).body;
    assert.equal(submission.status, 'in_progress');
    assert.ok(!('isAdmin' in submission.businessInfo));
  });

  it('round-trips every step exactly as sent', async () => {
    const { c, user } = await registered();
    const f = (name, extra) => goodFile(user.id, name, extra);
    const sections = {
      products: {
        count: 24,
        categories: [{ id: 'c1', name: 'Rings', subcategories: [{ id: 's1', name: 'Signet' }] }],
        items: [
          {
            id: 'p1',
            name: 'Signet ring',
            categoryIds: ['c1'],
            subcategoryIds: ['s1'],
            mainImage: f('main.jpg'),
            images: [f('one.jpg'), f('two.jpg')],
            shortDescription: '14k gold',
            longDescription: 'Hand finished.',
            price: 45000,
            variations: [
              {
                id: 'x1',
                name: 'Size',
                priceVaries: true,
                options: [
                  { id: 'o1', label: '6', price: 45000 },
                  { id: 'o2', label: '8', price: 47000 },
                ],
              },
            ],
          },
        ],
      },
      homePage: {
        media: [f('hero.jpg'), f('clip.mp4', { resourceType: 'video' })],
        bestSellers: ['p1'],
        newIn: ['p1'],
        testimonials: [{ id: 't1', name: 'Bola', quote: 'Lovely ring.', photo: f('bola.jpg') }],
        excerpt: 'Warm and short.',
        differentiators: [{ id: 'd1', title: 'Made to order', text: 'Every piece.' }],
      },
      contactPage: {
        phone: '+234 800 000 0000',
        email: 'hello@ade.com',
        address: 'Lagos',
        seeded: true,
        fields: [
          { id: 'f1', type: 'name', required: true, reasons: [] },
          { id: 'f2', type: 'dropdown', required: false, reasons: [{ id: 'r1', label: 'Wholesale' }] },
        ],
      },
      inspiration: { items: [{ id: 'i1', link: 'https://example.com', screenshot: f('shot.png'), note: 'Clean' }] },
      visualIdentity: {
        tones: ['Warm', 'Elegant'],
        logos: { primary: f('logo.svg'), mark: null, light: null, dark: null, favicon: f('fav.ico') },
        brandColor: '#D9714E',
        brandGuide: f('guide.pdf', { resourceType: 'raw' }),
      },
      socialMedia: { items: [{ id: 'sm1', platform: 'Instagram', link: 'https://instagram.com/ade' }] },
      policies: {
        privacy: { text: '', draft: true },
        terms: { text: 'Be nice.', draft: false },
        returns: { text: '', draft: false },
      },
    };
    const put = await c.put('/api/onboarding', sections);
    assert.equal(put.status, 200, JSON.stringify(put.body));
    const { submission } = (await c.get('/api/onboarding')).body;
    for (const [key, value] of Object.entries(sections)) assert.deepEqual(submission[key], value, key);
  });

  it('rejects files that did not come from Cloudinary or belong to someone else', async () => {
    const { c, user } = await registered();
    const withMain = (mainImage) => ({ products: { items: [{ id: 'p1', mainImage }] } });

    const foreignHost = await c.put('/api/onboarding', withMain({ ...goodFile(user.id), url: 'https://evil.example.com/x.jpg' }));
    assert.equal(foreignHost.status, 400);

    const otherUser = await c.put('/api/onboarding', withMain({ ...goodFile(user.id), publicId: 'thyra/onboarding/someone-else/x' }));
    assert.equal(otherUser.status, 400);

    const lookalike = await c.put('/api/onboarding', withMain({ ...goodFile(user.id), url: 'https://res.cloudinary.com.evil.example/x.jpg' }));
    assert.equal(lookalike.status, 400);

    // The same rule protects every other place a file can go.
    const badLogo = await c.put('/api/onboarding', {
      visualIdentity: { logos: { primary: { ...goodFile(user.id), publicId: 'elsewhere/x' } } },
    });
    assert.equal(badLogo.status, 400);
    const badGuide = await c.put('/api/onboarding', {
      visualIdentity: { brandGuide: { ...goodFile(user.id), url: 'http://res.cloudinary.com/x.pdf' } },
    });
    assert.equal(badGuide.status, 400);
  });

  it('rejects non-numeric prices, unknown tones, blank platforms, and more than two tones', async () => {
    const { c } = await registered();
    assert.equal((await c.put('/api/onboarding', { products: { items: [{ id: 'p1', price: 'free' }] } })).status, 400);
    assert.equal((await c.put('/api/onboarding', { visualIdentity: { tones: ['Grumpy'] } })).status, 400);
    assert.equal((await c.put('/api/onboarding', { visualIdentity: { tones: ['Warm', 'Bold', 'Modern'] } })).status, 400);
    assert.equal((await c.put('/api/onboarding', { socialMedia: { items: [{ id: 's', platform: '' }] } })).status, 400);
    assert.equal((await c.put('/api/onboarding', { contactPage: { fields: [{ id: 'f', type: 'checkbox' }] } })).status, 400);
  });

  it('refuses to submit while required details are missing, and says which step', async () => {
    const { c, user } = await registered();
    await verifyEmail(user.id);
    await c.put('/api/onboarding', { businessInfo: { name: 'Ade' } });
    const res = await c.post('/api/onboarding/submit');
    assert.equal(res.status, 422);
    assert.deepEqual(stepsOf(res), [0, 3]); // business info, and the "at least 3 values" rule on About
    assert.equal((await c.get('/api/onboarding')).body.submission.status, 'in_progress');
  });

  it('catches incomplete rows on each step at submit', async () => {
    const { c, user } = await registered();
    await verifyEmail(user.id);
    await c.put('/api/onboarding', {
      ...completeDraft(),
      products: { items: [{ id: 'p1', name: 'Ring', variations: [{ id: 'x', name: 'Size', priceVaries: false, options: [] }] }] },
      homePage: { testimonials: [{ id: 't', name: '', quote: '' }] },
      contactPage: { email: 'not-an-email', fields: [{ id: 'f', type: 'dropdown', reasons: [] }] },
      inspiration: { items: [{ id: 'i', link: 'not a link' }] },
      visualIdentity: { brandColor: 'blue' },
      socialMedia: { items: [{ id: 's', platform: 'Instagram', link: '' }] },
    });
    const res = await c.post('/api/onboarding/submit');
    assert.equal(res.status, 422);
    assert.deepEqual(stepsOf(res), [1, 2, 4, 5, 6, 7]);
  });

  it('submits a complete form, allows blank policies, then locks it', async () => {
    const { c, user } = await registered();
    await verifyEmail(user.id);
    await c.put('/api/onboarding', completeDraft());

    const res = await c.post('/api/onboarding/submit');
    assert.equal(res.status, 200);
    assert.equal(res.body.submission.status, 'submitted');
    assert.ok(res.body.submission.submittedAt);

    assert.equal((await c.post('/api/onboarding/submit')).status, 200); // harmless repeat
    const edit = await c.put('/api/onboarding', { businessInfo: { name: 'Changed' } });
    assert.equal(edit.status, 409);
    assert.equal((await c.get('/api/onboarding')).body.submission.businessInfo.name, 'Ade Fine Jewellery');
  });

  it("keeps each client's submission separate", async () => {
    const a = await registered();
    const b = await registered({ email: 'bola@example.com' });
    await a.c.put('/api/onboarding', { businessInfo: { name: 'A Co' } });
    assert.equal((await b.c.get('/api/onboarding')).body.submission.businessInfo.name, undefined);
  });

  describe('upload signatures', () => {
    it('need a login', async () => {
      assert.equal((await client().post('/api/onboarding/files/signature')).status, 401);
    });

    it('say uploads are not set up when Cloudinary has no keys', async () => {
      const { c } = await registered();
      assert.equal((await c.post('/api/onboarding/files/signature')).status, 503);
    });

    it('are refused once the form is submitted', async () => {
      const { c, user } = await registered();
      await query(`UPDATE onboarding_submissions SET status = 'submitted' WHERE user_id = $1`, [user.id]);
      assert.equal((await c.post('/api/onboarding/files/signature')).status, 409);
    });
  });
});

describe('platform', () => {
  it('answers the health check', async () => {
    assert.deepEqual((await client().get('/api/health')).body, { ok: true });
  });

  it('runs the scheduled jobs only with the shared secret', async () => {
    assert.equal((await client().post('/api/jobs')).status, 401);
    const res = await client().post('/api/jobs', {}, { 'x-jobs-secret': 'test-jobs-secret' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { stalled: 0, weekly: res.body.weekly });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await client().get('/api/nothing-here');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, 'Not found.');
  });
});
