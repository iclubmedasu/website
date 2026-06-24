"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { readRegistrationCache } from "@/lib/registrationCache";

interface EventDetailActionsProps {
    eventId: number;
    registrationOpen: boolean;
}

export function EventDetailActions({ eventId, registrationOpen }: EventDetailActionsProps) {
    const [ticketHref, setTicketHref] = useState<string | null>(null);

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            setTicketHref(`/events/${eventId}/confirmation?code=${encodeURIComponent(cached.confirmationCode)}`);
        }
    }, [eventId]);

    return (
        <div className="flex flex-wrap items-center gap-3 pt-2">
            {ticketHref ? (
                <Button href={ticketHref}>View my ticket</Button>
            ) : registrationOpen ? (
                <Button href={`/events/${eventId}/register`}>Register</Button>
            ) : (
                <p className="text-sm font-medium text-slate-600">
                    Registration is currently closed for this event.
                </p>
            )}
        </div>
    );
}
