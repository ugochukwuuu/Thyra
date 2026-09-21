import { Resend } from 'resend';
import { config } from '../config.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

function resetEmail(link) {
  const minutes = config.resetTokenMinutes;
  return {
    subject: 'Reset your Thyra password',
    text:
      `Someone asked to reset the password for your Thyra account.\n\n` +
      `Open this link to choose a new one. It expires in ${minutes} minutes and works once:\n${link}\n\n` +
      `If this wasn't you, you can ignore this email and your password will stay the same.`,
    html: `
<div style="font-family:Arial,sans-serif;background:#F5F1E7;padding:32px;color:#1A1714;">
  <div style="max-width:480px;margin:0 auto;background:#FBFAF6;border:1px solid rgba(26,23,20,0.12);border-radius:16px;padding:32px;">
    <div style="font-weight:700;font-size:18px;margin-bottom:20px;">Thyra</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.5;color:#6B655C;margin:0 0 24px;">
      Use the button below to choose a new password. The link expires in ${minutes} minutes and can only be used once.
    </p>
    <a href="${link}" style="display:inline-block;background:#D9714E;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px;">Choose a new password</a>
    <p style="font-size:13px;line-height:1.5;color:#6B655C;margin:24px 0 0;">
      If this wasn't you, ignore this email and your password will stay the same.
    </p>
  </div>
</div>`,
  };
}

/**
 * Wrapped in an object so tests can swap the transport out.
 * Never throws: a failed email must not change the response to the client.
 */
export const mailer = {
  async sendPasswordReset(to, token) {
    const link = `${config.clientUrl}/reset-password?token=${token}`;
    if (!resend) {
      if (config.isProduction) {
        console.error('RESEND_API_KEY is not set; password reset email was not sent.');
      } else {
        console.log(`\n[dev] Password reset link for ${to}:\n${link}\n`);
      }
      return;
    }
    try {
      const { subject, text, html } = resetEmail(link);
      const { error } = await resend.emails.send({ from: config.emailFrom, to, subject, text, html });
      if (error) console.error('Resend rejected the reset email:', error);
    } catch (err) {
      console.error('Failed to send reset email:', err);
    }
  },
};
