import fs from 'fs';
import path from 'path';
import { sendEmail, type EmailAttachment } from './emailService';

export const ICLUB_AVATAR_CID = 'iclub-avatar';
export const ICLUB_LOGO_CID = 'iclub-logo';
export const IHUB_LOGO_CID = 'ihub-logo';

// Reset links target the members portal (FRONTEND_URL), not PUBLIC_WEBSITE_URL.
// Local: set FRONTEND_URL=http://localhost:3001 so links hit a portal with /reset-password.
const DEFAULT_FRONTEND_URL = 'https://iclubmedasu-members-portal.hf.space';

const EMAIL_ASSETS_DIR = (() => {
    const candidates = [
        path.join(__dirname, '../../assets/email'),
        path.join(__dirname, '../assets/email'),
    ];
    const existing = candidates.find((dir) => fs.existsSync(dir));
    return existing ?? candidates[0];
})();

const PURPLE = {
    900: '#561789',
    800: '#662f91',
    700: '#7a47a3',
    600: '#9063b3',
    400: '#af8fc8',
} as const;

function getFrontendUrl(): string {
    return process.env.FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL;
}

export function buildPasswordResetUrl(rawToken: string): string {
    const baseUrl = getFrontendUrl().replace(/\/$/, '');
    return `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function loadEmailAsset(filename: string, contentId: string): EmailAttachment {
    const buffer = fs.readFileSync(path.join(EMAIL_ASSETS_DIR, filename));
    return {
        contentId,
        content: buffer.toString('base64'),
        filename,
        contentType: 'image/png',
    };
}

function buildBrandedImageAttachments(): EmailAttachment[] {
    return [
        loadEmailAsset('iclub_icon_colored_transparent_outlined_logo.png', ICLUB_AVATAR_CID),
        loadEmailAsset('iclub_full_colored_transparent_outlined_logo.png', ICLUB_LOGO_CID),
        loadEmailAsset('ihub_full_colored_transparent_logo_outlined.png', IHUB_LOGO_CID),
    ];
}

export function buildPasswordResetEmailHtml(input: {
    recipientName: string;
    resetUrl: string;
}): string {
    const recipientName = escapeHtml(input.recipientName);
    const resetUrl = escapeHtml(input.resetUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your iClub password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ebf5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0ebf5;">
    <tr>
      <td align="center" style="padding:16px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ebe4f2;border-radius:14px;">
          <tr>
            <td style="padding:24px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dce4ef;">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,${PURPLE[900]},${PURPLE[600]},${PURPLE[400]});font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="background:linear-gradient(135deg,${PURPLE[900]} 0%,${PURPLE[800]} 45%,${PURPLE[700]} 100%);padding:22px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 7px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${PURPLE[400]};font-weight:700;">iClub Med-asu · Password Reset</p>
                          <p style="margin:0 0 5px;font-size:17px;font-weight:700;line-height:1.35;color:#ffffff !important;mso-color-alt:#ffffff;"><span style="color:#ffffff;display:block;">Reset your password</span></p>
                          <p style="margin:0;font-size:11px;color:${PURPLE[400]};letter-spacing:0.05em;">Link expires in 1 hour</p>
                        </td>
                        <td width="42" style="width:42px;vertical-align:top;text-align:right;">
                          <img src="cid:${ICLUB_AVATAR_CID}" alt="iClub" width="42" height="42" style="display:block;width:42px;height:42px;border-radius:50%;border:2px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0f172a;">Hi ${recipientName},</p>
                    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">We received a request to reset your members portal password. Click the button below to choose a new one.</p>
                    <p style="margin:0 0 18px;text-align:center;">
                      <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:${PURPLE[800]};color:#ffffff;text-decoration:none;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:0.04em;">Reset password</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
                    <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;word-break:break-all;">${resetUrl}</p>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you did not request a password reset, you can ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;border-top:1px solid #eef2f7;padding:16px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom:10px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td align="center" style="padding-right:18px;border-right:1px solid #d1dae6;vertical-align:middle;">
                                <img src="cid:${ICLUB_LOGO_CID}" alt="iClub Med-asu" height="28" style="display:block;height:28px;width:auto;" />
                              </td>
                              <td align="center" style="padding-left:18px;vertical-align:middle;">
                                <img src="cid:${IHUB_LOGO_CID}" alt="iHub" height="28" style="display:block;height:28px;width:auto;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <p style="margin:0;font-size:9px;color:#b0bac7;letter-spacing:0.1em;text-transform:uppercase;">Ain Shams University · Faculty of Medicine</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:10px;color:#7a8fa6;text-align:center;">This message was sent automatically — please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(input: {
    to: string;
    recipientName: string;
    rawToken: string;
}): Promise<void> {
    const resetUrl = buildPasswordResetUrl(input.rawToken);
    const html = buildPasswordResetEmailHtml({
        recipientName: input.recipientName || 'Member',
        resetUrl,
    });

    await sendEmail({
        to: input.to,
        subject: 'Reset your iClub password',
        html,
        attachments: buildBrandedImageAttachments(),
    });
}
