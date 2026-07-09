"use client";

import { useEffect, useState } from "react";
import type { PublicRegistrationConfirmation } from "@iclub/shared";
import { RegistrationConfirmation } from "@/components/registration/RegistrationConfirmation";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function ConfirmationPageContent({
    eventId,
    code,
}: {
    eventId: number;
    code: string;
}) {
    const [state, setState] = useState<LoadState>("loading");
    const [confirmation, setConfirmation] = useState<PublicRegistrationConfirmation | null>(null);

    useEffect(() => {
        void publicAPI
            .getRegistrationConfirmation(eventId, code)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setConfirmation(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [eventId, code]);

    if (state === "loading") {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={`/events/${eventId}`} label="Back to event" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !confirmation) {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={`/events/${eventId}`} label="Back to event" />
                <div className="empty-state max-w-lg">
                    <h1 className="empty-state-title">Confirmation not found</h1>
                    <p className="empty-state-text">
                        We could not find a registration with that confirmation code.
                    </p>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="max-w-3xl py-10 sm:py-14">
            <BackLink href={`/events/${eventId}`} label="Back to event" />
            <RegistrationConfirmation confirmation={confirmation} />
        </PageContainer>
    );
}
