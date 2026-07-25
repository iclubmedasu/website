"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { publicAPI } from "@/lib/api";
import { publicEventPath } from "@/lib/publicSlug";
import { readRegistrationCache } from "@/lib/registrationCache";

interface ConfirmationFromCacheProps {
    idOrSlug: string;
}

export function ConfirmationFromCache({ idOrSlug }: ConfirmationFromCacheProps) {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        void publicAPI.getEvent(idOrSlug).then((event) => {
            if (cancelled || !event) return;
            const cached = readRegistrationCache(event.id);
            if (cached?.confirmationCode) {
                router.replace(
                    `${publicEventPath(event.slug, "/confirmation")}?code=${encodeURIComponent(cached.confirmationCode)}`,
                );
            }
        });

        return () => {
            cancelled = true;
        };
    }, [idOrSlug, router]);

    return (
        <p className="text-sm text-slate-600">
            Looking for your saved registration…
        </p>
    );
}
