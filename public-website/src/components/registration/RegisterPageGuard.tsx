"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readRegistrationCache } from "@/lib/registrationCache";

interface RegisterPageGuardProps {
    eventId: number;
    children: React.ReactNode;
}

export function RegisterPageGuard({ eventId, children }: RegisterPageGuardProps) {
    const router = useRouter();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        const cached = readRegistrationCache(eventId);
        if (cached?.confirmationCode) {
            router.replace(
                `/events/${eventId}/confirmation?code=${encodeURIComponent(cached.confirmationCode)}`,
            );
            return;
        }
        setAllowed(true);
    }, [eventId, router]);

    if (allowed !== true) {
        return null;
    }

    return <>{children}</>;
}
