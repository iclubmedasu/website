"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readRegistrationCache } from "@/lib/registrationCache";
import { publicEventPath } from "@/lib/publicSlug";

interface RegisterPageGuardProps {
    eventId: number;
    eventSlug: string;
    children: React.ReactNode;
}

export function RegisterPageGuard({ eventId, eventSlug, children }: RegisterPageGuardProps) {
    const router = useRouter();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            router.replace(
                `${publicEventPath(eventSlug, "/confirmation")}?code=${encodeURIComponent(cached.confirmationCode)}`,
            );
            return;
        }
        setAllowed(true);
    }, [eventId, eventSlug, router]);

    if (allowed !== true) {
        return null;
    }

    return <>{children}</>;
}
