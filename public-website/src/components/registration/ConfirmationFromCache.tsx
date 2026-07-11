"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readRegistrationCache } from "@/lib/registrationCache";
import { publicEventPath } from "@/lib/publicSlug";

interface ConfirmationFromCacheProps {
    eventId: number;
    eventSlug: string;
}

export function ConfirmationFromCache({ eventId, eventSlug }: ConfirmationFromCacheProps) {
    const router = useRouter();

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            router.replace(
                `${publicEventPath(eventSlug, "/confirmation")}?code=${encodeURIComponent(cached.confirmationCode)}`,
            );
        }
    }, [eventId, eventSlug, router]);

    return (
        <p className="text-sm text-slate-600">
            Looking for your saved registration…
        </p>
    );
}
