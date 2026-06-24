"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readRegistrationCache } from "@/lib/registrationCache";

interface ConfirmationFromCacheProps {
    eventId: number;
}

export function ConfirmationFromCache({ eventId }: ConfirmationFromCacheProps) {
    const router = useRouter();

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            router.replace(`/events/${eventId}/confirmation?code=${encodeURIComponent(cached.confirmationCode)}`);
        }
    }, [eventId, router]);

    return (
        <p className="text-sm text-slate-600">
            Looking for your saved registration…
        </p>
    );
}
