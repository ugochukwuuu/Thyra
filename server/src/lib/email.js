import { Resend } from 'resend';
import { config } from '../config.js';
import { getSettings } from './settings.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

const escape = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The shared Thyra email layout: heading, paragraphs, an optional button, and a small footnote. */
function render({ heading, paragraphs = [], button, footnote }) {
  const text = [heading, '', ...paragraphs.flatMap((p) => [p, '']), button ? `${button.label}: ${button.url}\n` : '', footnote ?? '']
    .join('\n')
    .trim();
  const html = `
<div style="font-family:Arial,sans-serif;background:#F5F1E7;padding:32px;color:#1A1714;">
  <div style="max-width:480px;margin:0 auto;background:#FBFAF6;border:1px solid rgba(26,23,20,0.12);border-radius:16px;padding:32px;">
    <div style="font-weight:700;font-size:18px;margin-bottom:20px;">Thyra</div>
    <h1 style="font-size:22px;margin:0 0 12px;">${escape(heading)}</h1>
    ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;color:#3A342E;margin:0 0 16px;white-space:pre-line;">${escape(p)}</p>`).join('')}
    ${button ? `<a href="${escape(button.url)}" style="display:inline-block;margin-top:8px;background:#D9714E;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px;">${escape(button.label)}</a>` : ''}
    ${footnote ? `<p style="font-size:13px;line-height:1.5;color:#6B655C;margin:24px 0 0;">${escape(footnote)}</p>` : ''}
  </div>
</div>`;
  return { text, html };
}

/** "Thyra <no-reply@x.com>" -> "no-reply@x.com", so the sender name can come from Settings. */
const fromAddress = () => /<([^>]+)>/.exec(config.emailFrom)?.[1] ?? config.emailFrom;

async function sender() {
  const s = await getSettings('onboarding').catch(() => null);
  const name = s?.senderName?.trim();
  return {
    from: name ? `${name.replace(/[<>"]/g, '')} <${fromAddress()}>` : config.emailFrom,
    replyTo: s?.replyTo?.trim() || undefined,
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const hoursLabel = (h) => (h % 24 === 0 && h >= 48 ? plural(h / 24, 'day') : plural(h, 'hour'));

/**
 * Every outgoing email goes through `mailer.deliver`, which tests replace to capture messages.
 * Sending never throws: a failed email must not change the response to the user.
 */
export const mailer = {
  async deliver(msg) {
    if (!resend) {
      if (config.isProduction) console.error(`RESEND_API_KEY is not set; "${msg.subject}" was not sent to ${msg.to}.`);
      else console.log(`\n[dev] Email to ${msg.to}: ${msg.subject}${msg.link ? `\n${msg.link}` : ''}\n`);
      return;
    }
    try {
      const { from, replyTo } = await sender();
      const { text, html } = render(msg);
      const { error } = await resend.emails.send({ from, replyTo, to: msg.to, subject: msg.subject, text, html });
      if (error) console.error(`Resend rejected "${msg.subject}":`, error);
    } catch (err) {
      console.error(`Failed to send "${msg.subject}":`, err);
    }
  },

  sendPasswordReset({ to, token, staff, minutes }) {
    const path = staff ? '/admin/reset-password' : '/reset-password';
    const link = `${config.clientUrl}${path}?token=${token}${staff ? `&email=${encodeURIComponent(to)}` : ''}`;
    const life = minutes >= 60 && minutes % 60 === 0 ? plural(minutes / 60, 'hour') : plural(minutes, 'minute');
    return mailer.deliver({
      kind: 'password_reset', to, link,
      subject: 'Reset your Thyra password',
      heading: 'Reset your password',
      paragraphs: [`Use the button below to choose a new password. The link expires in ${life} and can only be used once.`],
      button: { label: 'Choose a new password', url: link },
      footnote: "If this wasn't you, ignore this email and your password will stay the same.",
    });
  },

  sendEmailVerification({ to, token, hours }) {
    const link = `${config.clientUrl}/verify-email?token=${token}`;
    return mailer.deliver({
      kind: 'verify_email', to, link,
      subject: 'Confirm your email for Thyra',
      heading: 'Confirm your email',
      paragraphs: [`Thanks for creating your Thyra account. Confirm this is your email so we can reach you about your store. The link lasts ${hoursLabel(hours)}.`],
      button: { label: 'Confirm my email', url: link },
      footnote: "If you didn't create a Thyra account, you can ignore this email.",
    });
  },

  sendClientInvite({ to, token, businessName, contactName, note, inviterName }) {
    const link = `${config.clientUrl}/signup?invite=${token}`;
    return mailer.deliver({
      kind: 'client_invite', to, link,
      subject: `Set up ${businessName} on Thyra`,
      heading: `Hi ${contactName}, let's set up your store`,
      paragraphs: [
        ...(note ? [note] : []),
        `${inviterName || 'The Thyra team'} has invited you to start onboarding for ${businessName}. Create your account to tell us about your business, products and brand. The link lasts 7 days.`,
      ],
      button: { label: 'Create my account', url: link },
    });
  },

  sendStaffInvite({ to, token, role, inviterName }) {
    const roleLabel = role === 'admin' ? 'Admin' : 'Viewer';
    const params = new URLSearchParams({ token, email: to, role: roleLabel, inviter: inviterName || 'The Thyra team' });
    const link = `${config.clientUrl}/admin/join?${params}`;
    return mailer.deliver({
      kind: 'staff_invite', to, link,
      subject: 'Join the Thyra admin team',
      heading: 'Join the Thyra team',
      paragraphs: [`${inviterName || 'Someone at Thyra'} invited you to the Thyra admin as ${roleLabel}. The link lasts 7 days.`],
      button: { label: 'Join team', url: link },
    });
  },

  sendChangesRequested({ to, contactName, sectionName, message }) {
    const link = `${config.clientUrl}/onboarding`;
    return mailer.deliver({
      kind: 'changes_requested', to, link,
      subject: `A change is needed in your ${sectionName}`,
      heading: `${contactName ? `Hi ${contactName}, a` : 'A'} quick change is needed`,
      paragraphs: [`We've reviewed your onboarding and need a change in ${sectionName}:`, message, 'Log in to update it, then confirm your details again.'],
      button: { label: 'Update my details', url: link },
    });
  },

  sendStaffNotification({ to, subject, heading, paragraphs, path }) {
    const link = `${config.clientUrl}${path}`;
    return mailer.deliver({ kind: 'staff_notification', to, link, subject, heading, paragraphs, button: { label: 'Open in Thyra admin', url: link } });
  },
};
