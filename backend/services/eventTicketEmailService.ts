import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../db';
import { getEventDayRange } from './eventDates';
import { sendEmail, type EmailAttachment } from './emailService';

export const TICKET_QR_CONTENT_ID = 'ticket-qr-code';
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

export type EventRegistrationEmailVariant = 'ticket' | 'reminder';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatEventDateLabel(eventDate: Date, eventEndDate: Date): string {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });

    const range = getEventDayRange(eventDate, eventEndDate);
    const startLabel = dateFormatter.format(eventDate);

    if (!range || range.startDay === range.endDay) {
        return `${startLabel} · ${timeFormatter.format(eventDate)}`;
    }

    const endLabel = dateFormatter.format(eventEndDate);
    return `${startLabel} – ${endLabel}`;
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

function buildTicketEmailAttachments(confirmationCode: string): Promise<EmailAttachment[]> {
    return buildTicketQrAttachment(confirmationCode).then((qrAttachment) => ([
        qrAttachment,
        loadEmailAsset('iclub_icon_colored_transparent_outlined_logo.png', ICLUB_AVATAR_CID),
        loadEmailAsset('iclub_full_colored_transparent_outlined_logo.png', ICLUB_LOGO_CID),
        loadEmailAsset('ihub_full_colored_transparent_logo_outlined.png', IHUB_LOGO_CID),
    ]));
}

async function buildTicketQrAttachment(confirmationCode: string): Promise<EmailAttachment> {
    const buffer = await QRCode.toBuffer(confirmationCode, {
        type: 'png',
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
    });

    return {
        contentId: TICKET_QR_CONTENT_ID,
        content: buffer.toString('base64'),
        filename: 'ticket-qr.png',
        contentType: 'image/png',
    };
}

function buildDetailRow(label: string, valueHtml: string, withBorder = true): string {
    const border = withBorder ? `border-bottom:1px solid #f1f5f9;` : '';
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

function buildRegistrationEmailHtml(input: {
    eventTitle: string;
    eventDateLabel: string;
    venue: string;
    attendeeName: string;
    tierName: string;
    confirmationCode: string;
    variant: EventRegistrationEmailVariant;
}): string {
    const eventTitle = escapeHtml(input.eventTitle);
    const eventDateLabel = escapeHtml(input.eventDateLabel);
    const venue = escapeHtml(input.venue);
    const attendeeName = escapeHtml(input.attendeeName);
    const tierName = escapeHtml(input.tierName);
    const confirmationCode = escapeHtml(input.confirmationCode);
    const isReminder = input.variant === 'reminder';

    const pageTitle = isReminder ? `Reminder: ${eventTitle}` : `Your ticket for ${eventTitle}`;
    const eyebrow = isReminder ? 'iClub Med-asu · Event Reminder' : 'iClub Med-asu · Event Ticket';
    const subtitle = isReminder ? 'Reminder for your upcoming event' : 'Issued for personal use only';
    const instruction = isReminder
        ? 'We look forward to seeing you. Present this code or QR code at check-in.'
        : 'Present this code or QR code at the event entrance.';
    const autoNote = isReminder
        ? 'This reminder was issued automatically — please do not reply to this email.'
        : 'This ticket was issued automatically — please do not reply to this email.';
    const introBlock = isReminder
        ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">This is a reminder that you are registered for <strong style="color:${PURPLE[900]};">${eventTitle}</strong>. Your confirmation details are below.</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ebf5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0ebf5;">
    <tr>
      <td align="center" style="padding:16px 12px;">
        ${introBlock}
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
                          <p style="margin:0 0 7px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${PURPLE[400]};font-weight:700;">${eyebrow}</p>
                          <p style="margin:0 0 5px;font-size:17px;font-weight:700;line-height:1.35;color:#ffffff !important;mso-color-alt:#ffffff;"><span style="color:#ffffff;display:block;">${eventTitle}</span></p>
                          <p style="margin:0;font-size:11px;color:${PURPLE[400]};letter-spacing:0.05em;">${subtitle}</p>
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
                      ${buildDetailRow('Date', eventDateLabel)}
                      ${buildDetailRow('Venue', venue)}
                      ${buildDetailRow('Name', attendeeName)}
                      ${buildDetailRow('Tier', `<span style="background:#f3e8ff;color:${PURPLE[900]};font-size:11px;font-weight:700;padding:2px 10px;border-radius:999px;display:inline-block;">${tierName}</span>`, false)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 24px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PURPLE[900]};border-radius:10px;">
                      <tr>
                        <td align="center" style="padding:18px 12px;">
                          <p style="margin:0 0 8px;font-size:8px;letter-spacing:0.22em;text-transform:uppercase;color:${PURPLE[400]};font-weight:700;">Confirmation Code</p>
                          <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.28em;font-family:'Courier New',Courier,monospace;color:#f0f9ff;">${confirmationCode}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding:10px;">
                          <img src="cid:${TICKET_QR_CONTENT_ID}" alt="Check-in QR code" width="130" height="130" style="display:block;width:130px;height:130px;border-radius:6px;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:12px 24px 18px;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">${instruction}</p>
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
              <p style="margin:12px 0 0;font-size:10px;color:#7a8fa6;text-align:center;">${autoNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getEmailSubject(eventTitle: string, variant: EventRegistrationEmailVariant): string {
    return variant === 'reminder'
        ? `Reminder: ${eventTitle}`
        : `Your ticket for ${eventTitle}`;
}

async function sendRegistrationEmail(
    registrationId: number,
    variant: EventRegistrationEmailVariant,
): Promise<void> {
    const registration = await prisma.eventRegistration.findUnique({
        where: { id: registrationId },
        include: {
            event: {
                select: {
                    title: true,
                    venue: true,
                    eventDate: true,
                    eventEndDate: true,
                },
            },
            tier: {
                select: { name: true },
            },
        },
    });

    if (!registration) {
        throw new Error('Registration not found');
    }

    if (!registration.email?.trim()) {
        throw new Error('Registration has no email address');
    }

    if (registration.status === 'CANCELLED') {
        throw new Error('Registration has been cancelled');
    }

    const attachments = await buildTicketEmailAttachments(registration.confirmationCode);
    const html = buildRegistrationEmailHtml({
        eventTitle: registration.event.title,
        eventDateLabel: formatEventDateLabel(registration.event.eventDate, registration.event.eventEndDate),
        venue: registration.event.venue?.trim() || 'TBA',
        attendeeName: registration.fullName,
        tierName: registration.tier?.name || 'General',
        confirmationCode: registration.confirmationCode,
        variant,
    });

    await sendEmail({
        to: registration.email,
        subject: getEmailSubject(registration.event.title, variant),
        html,
        attachments,
    });

    if (variant === 'reminder') {
        await prisma.eventRegistration.update({
            where: { id: registrationId },
            data: { reminderEmailSentAt: new Date() },
        });
        return;
    }

    await prisma.eventRegistration.update({
        where: { id: registrationId },
        data: { ticketEmailSentAt: new Date() },
    });
}

export async function sendEventTicketEmail(registrationId: number): Promise<void> {
    await sendRegistrationEmail(registrationId, 'ticket');
}

export async function sendEventReminderEmail(registrationId: number): Promise<void> {
    await sendRegistrationEmail(registrationId, 'reminder');
}
