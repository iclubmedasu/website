import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { getPublicApiUrl } from '../lib/publicApiUrl';
import { getPublicWebsiteUrl } from '../lib/publicWebsiteUrl';
import { sendEmail, type EmailAttachment } from './emailService';
import { runEmailJob } from './emailSendPool';
import { generateCertificatePdfBuffer } from './certificatePdfService';

export const ICLUB_AVATAR_CID = 'iclub-avatar';
export const ICLUB_LOGO_CID = 'iclub-logo';
export const IHUB_LOGO_CID = 'ihub-logo';

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

export function buildCertificateViewUrl(code: string): string {
    const baseUrl = getPublicWebsiteUrl();
    return `${baseUrl}/verify/${encodeURIComponent(code.trim())}`;
}

export function buildCertificatePdfDownloadUrl(code: string): string {
    const baseUrl = getPublicApiUrl();
    return `${baseUrl}/certificates/verify/${encodeURIComponent(code.trim())}/pdf`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatIssuedDateLabel(issuedAt: Date | null): string {
    if (!issuedAt) return '—';
    return issuedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
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

function buildDetailRow(label: string, valueHtml: string, withBorder = true): string {
    const border = withBorder ? 'border-bottom:1px solid #f1f5f9;' : '';
    return `<tr>
  <td style="padding:8px 0;${border}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:72px;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;font-weight:600;vertical-align:middle;">${label}</td>
        <td style="font-size:13px;color:#0f172a;font-weight:500;vertical-align:middle;">${valueHtml}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

export function buildCertificateEmailHtml(input: {
    recipientName: string;
    title: string;
    issuedDateLabel: string;
    verificationCode: string;
    viewUrl: string;
    downloadUrl: string;
}): string {
    const recipientName = escapeHtml(input.recipientName);
    const title = escapeHtml(input.title);
    const issuedDateLabel = escapeHtml(input.issuedDateLabel);
    const verificationCode = escapeHtml(input.verificationCode);
    const viewUrl = escapeHtml(input.viewUrl);
    const downloadUrl = escapeHtml(input.downloadUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your certificate: ${title}</title>
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
                          <p style="margin:0 0 7px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${PURPLE[400]};font-weight:700;">iClub Med-asu · Certificate</p>
                          <p style="margin:0 0 5px;font-size:17px;font-weight:700;line-height:1.35;color:#ffffff !important;mso-color-alt:#ffffff;"><span style="color:#ffffff;display:block;">${title}</span></p>
                          <p style="margin:0;font-size:11px;color:${PURPLE[400]};letter-spacing:0.05em;">Issued for personal use only</p>
                        </td>
                        <td width="42" style="width:42px;vertical-align:top;text-align:right;">
                          <img src="cid:${ICLUB_AVATAR_CID}" alt="iClub" width="42" height="42" style="display:block;width:42px;height:42px;border-radius:50%;border:2px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.08);" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="background:#ffffff;padding:0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="16" style="width:16px;background:#ebe4f2;border-radius:0 8px 8px 0;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="border-top:1.5px dashed #c8d4e0;font-size:0;line-height:0;">&nbsp;</td>
                        <td width="16" style="width:16px;background:#ebe4f2;border-radius:8px 0 0 8px;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 24px 6px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${buildDetailRow('Name', recipientName)}
                      ${buildDetailRow('Title', title)}
                      ${buildDetailRow('Issued', issuedDateLabel, false)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 24px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PURPLE[900]};border-radius:10px;">
                      <tr>
                        <td align="center" style="padding:18px 12px;">
                          <p style="margin:0 0 8px;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:${PURPLE[400]};font-weight:700;">Verification Code</p>
                          <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.28em;font-family:'Courier New',Courier,monospace;color:#f0f9ff;">${verificationCode}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 10px;">
                    <a href="${viewUrl}" style="display:inline-block;padding:12px 20px;background:${PURPLE[800]};color:#ffffff;text-decoration:none;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:0.04em;margin:0 4px 8px;">View certificate</a>
                    <a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#ffffff;color:${PURPLE[900]};text-decoration:none;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:0.04em;border:1px solid ${PURPLE[600]};margin:0 4px 8px;">Download PDF</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 18px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">A PDF copy is attached to this email. Use Download PDF if your client strips attachments.</p>
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
              <p style="margin:12px 0 0;font-size:10px;color:#7a8fa6;text-align:center;">This certificate was issued automatically — please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCertificateEmail(certificateId: number): Promise<void> {
    const certificate = await prisma.certificate.findUnique({
        where: { id: certificateId },
        select: {
            id: true,
            status: true,
            recipientName: true,
            recipientEmail: true,
            title: true,
            verificationCode: true,
            issuedAt: true,
        },
    });

    if (!certificate) {
        throw new Error('Certificate not found');
    }

    if (certificate.status !== 'ISSUED') {
        throw new Error('Certificate is not issued');
    }

    const recipientEmail = certificate.recipientEmail?.trim() ?? '';
    if (!recipientEmail) {
        throw new Error('Certificate has no recipient email');
    }

    const pdfBuffer = await generateCertificatePdfBuffer(certificateId);
    console.log(
        `certificateEmailService: certificate ${certificateId} PDF size ${pdfBuffer.length} bytes`
        + ` (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    );
    const safeCode = certificate.verificationCode.replace(/[^A-Za-z0-9_-]/g, '') || 'certificate';
    const pdfAttachment: EmailAttachment = {
        filename: `certificate-${safeCode}.pdf`,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
    };

    const viewUrl = buildCertificateViewUrl(certificate.verificationCode);
    const downloadUrl = buildCertificatePdfDownloadUrl(certificate.verificationCode);
    const html = buildCertificateEmailHtml({
        recipientName: certificate.recipientName,
        title: certificate.title,
        issuedDateLabel: formatIssuedDateLabel(certificate.issuedAt),
        verificationCode: certificate.verificationCode,
        viewUrl,
        downloadUrl,
    });

    await sendEmail({
        to: recipientEmail,
        subject: `Your certificate: ${certificate.title}`,
        html,
        attachments: [...buildBrandedImageAttachments(), pdfAttachment],
    });

    await prisma.certificate.update({
        where: { id: certificateId },
        data: { certificateEmailSentAt: new Date() },
    });
}

/** Fire-and-forget queue used after issue flows (mirrors ticket email). Shares the email concurrency pool. */
export function queueCertificateEmail(certificateId: number, context: string): void {
    void runEmailJob(() => sendCertificateEmail(certificateId)).catch((error) => {
        console.error(
            `Failed to send certificate email (${context}) for certificate ${certificateId}:`,
            error,
        );
    });
}
