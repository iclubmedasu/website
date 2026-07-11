"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

export function JoinSessionCountdown({ startsAt }: { startsAt: string }) {
    const router = useRouter();
    const startMs = new Date(startsAt).getTime();
    const [remainingMs, setRemainingMs] = useState(() => startMs - Date.now());

    useEffect(() => {
        const tick = () => {
            const next = startMs - Date.now();
            setRemainingMs(next);
            if (next <= 0) {
                router.refresh();
            }
        };

        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [router, startMs]);

    if (remainingMs <= 0) {
        return <p className="empty-state-text">Opening your session…</p>;
    }

    return (
        <p className="empty-state-text">
            Session starting in <span className="font-semibold text-purple-900">{formatRemaining(remainingMs)}</span>
        </p>
    );
}
