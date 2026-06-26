"use client";

import type { PublicConfirmationSession, PublicRegistrationConfirmation } from "@iclub/shared";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui";
import { formatEventDateRange } from "@/lib/customFieldUtils";
import {
    downloadTicketAsPdf,
    // downloadTicketAsPng,
} from "@/lib/ticketDownload";

interface EventTicketDisplayProps {
    confirmation: PublicRegistrationConfirmation;
}

function buildTicketFilename(confirmation: PublicRegistrationConfirmation, extension: "png" | "pdf"): string {
    const slug = confirmation.event.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "event-ticket";
    return `${slug}-ticket.${extension}`;
}

function formatSessionHeader(session: PublicConfirmationSession): string {
    const title = session.label?.trim();
    const parsed = new Date(session.sessionDate);
    const dateLabel = Number.isNaN(parsed.getTime())
        ? session.sessionDate
        : parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeRange = session.startTime && session.endTime
        ? `${session.startTime}–${session.endTime}`
        : null;
    return [title, dateLabel, timeRange].filter(Boolean).join(" · ");
}

export function EventTicketDisplay({ confirmation }: EventTicketDisplayProps) {
    const ticketRef = useRef<HTMLElement>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [exporting, setExporting] = useState<"pdf" | null>(null);
    const [exportError, setExportError] = useState("");

    const sessions = confirmation.sessions ?? [];

    useEffect(() => {
        let cancelled = false;

        void QRCode.toDataURL(confirmation.confirmationCode, {
            margin: 1,
            width: 220,
            color: {
                dark: "#561789",
                light: "#ffffff",
            },
        }).then((url) => {
            if (!cancelled) {
                setQrDataUrl(url);
            }
        }).catch(() => {
            if (!cancelled) {
                setQrDataUrl(null);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [confirmation.confirmationCode]);

    async function handleDownloadPdf() {
        setExportError("");
        setExporting("pdf");
        try {
            if (!ticketRef.current) {
                setExportError("Ticket is not ready to download yet.");
                return;
            }
            await downloadTicketAsPdf(ticketRef.current, buildTicketFilename(confirmation, "pdf"));
        } catch {
            setExportError("Failed to save ticket as PDF.");
        } finally {
            setExporting(null);
        }
    }

    const downloadsDisabled = !qrDataUrl || exporting != null;

    return (
        <div className="event-ticket-display">
            <section ref={ticketRef} className="event-ticket-card" aria-label="Event ticket">
                <div className="event-ticket-card-header">
                    <p className="event-ticket-card-eyebrow">Your ticket</p>
                    <h2 className="event-ticket-card-title">{confirmation.event.title}</h2>
                </div>

                <div className="event-ticket-card-body">
                    {qrDataUrl ? (
                        <img
                            src={qrDataUrl}
                            alt={`QR code for confirmation ${confirmation.confirmationCode}`}
                            className="event-ticket-qr"
                            width={220}
                            height={220}
                        />
                    ) : (
                        <div className="event-ticket-qr event-ticket-qr--loading" aria-hidden="true" />
                    )}

                    <div className="event-ticket-details">
                        <div className="confirmation-detail-row">
                            <span className="confirmation-detail-label">Attendee</span>
                            <span className="confirmation-detail-value">{confirmation.fullName}</span>
                        </div>
                        <div className="confirmation-detail-row">
                            <span className="confirmation-detail-label">Date</span>
                            <span className="confirmation-detail-value">
                                {formatEventDateRange(confirmation.event.eventDate, confirmation.event.eventEndDate)}
                            </span>
                        </div>
                        {confirmation.event.venue ? (
                            <div className="confirmation-detail-row">
                                <span className="confirmation-detail-label">Venue</span>
                                <span className="confirmation-detail-value">{confirmation.event.venue}</span>
                            </div>
                        ) : null}
                        {confirmation.tier ? (
                            <div className="confirmation-detail-row">
                                <span className="confirmation-detail-label">Tier</span>
                                <span className="confirmation-detail-value">{confirmation.tier.name}</span>
                            </div>
                        ) : null}
                        <div className="confirmation-detail-row">
                            <span className="confirmation-detail-label">Code</span>
                            <span className="confirmation-detail-value confirmation-code-value">{confirmation.confirmationCode}</span>
                        </div>
                    </div>
                </div>

                {sessions.length > 0 ? (
                    <div className="event-ticket-sessions">
                        <p className="event-ticket-sessions__title">Your Sessions</p>
                        <ul className="event-ticket-sessions__list">
                            {sessions.map((session) => (
                                <li key={String(session.id)} className="event-ticket-session-row">
                                    <p className="event-ticket-session-row__header">{formatSessionHeader(session)}</p>
                                    {session.mode === "ONSITE" ? (
                                        <p className="event-ticket-session-row__meta">Onsite attendance</p>
                                    ) : session.joinUrl ? (
                                        <>
                                            <a
                                                href={session.joinUrl}
                                                className="event-ticket-session-join-btn"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Join Online Session →
                                            </a>
                                            <p className="event-ticket-session-join-url">{session.joinUrl}</p>
                                        </>
                                    ) : (
                                        <p className="event-ticket-session-row__meta">Join link will be sent when available</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <p className="event-ticket-card-note">
                    Present this QR code or confirmation code at check-in. A copy has also been emailed to{" "}
                    <strong>{confirmation.email}</strong>.
                </p>
            </section>

            <div className="event-ticket-download-actions">
                <Button
                    type="button"
                    variant="secondary"
                    disabled={downloadsDisabled}
                    onClick={() => void handleDownloadPdf()}
                >
                    {exporting === "pdf" ? "Saving…" : "Save as PDF"}
                </Button>
            </div>
            {exportError ? <p className="event-ticket-export-error">{exportError}</p> : null}
        </div>
    );
}
