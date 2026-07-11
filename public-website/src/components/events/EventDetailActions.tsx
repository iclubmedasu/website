"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { readRegistrationCache } from "@/lib/registrationCache";
import { publicEventPath } from "@/lib/publicSlug";

interface EventDetailActionsProps {
    eventId: number;
    eventSlug: string;
    registrationOpen: boolean;
}

export function EventDetailActions({ eventId, eventSlug, registrationOpen }: EventDetailActionsProps) {
    const [ticketHref, setTicketHref] = useState<string | null>(null);

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            setTicketHref(
                `${publicEventPath(eventSlug, "/confirmation")}?code=${encodeURIComponent(cached.confirmationCode)}`,
            );
        }
    }, [eventId, eventSlug]);

    return (
        <div className="flex flex-wrap items-center gap-3 pt-2">
            {ticketHref ? (
                <Button href={ticketHref}>View my ticket</Button>
            ) : registrationOpen ? (
                <Button href={publicEventPath(eventSlug, "/register")}>Register</Button>
            ) : (
                <p className="text-sm font-medium text-slate-600">
                    Registration is currently closed for this event.
                </p>
            )}
        </div>
    );
}
