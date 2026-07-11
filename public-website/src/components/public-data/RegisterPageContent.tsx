"use client";

import { useEffect, useState } from "react";
import type { PublicEventDetail } from "@iclub/shared";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { RegisterPageGuard } from "@/components/registration/RegisterPageGuard";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { publicEventPath } from "@/lib/publicSlug";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function RegisterPageContent({ idOrSlug }: { idOrSlug: string }) {
    const [state, setState] = useState<LoadState>("loading");
    const [event, setEvent] = useState<PublicEventDetail | null>(null);

    useEffect(() => {
        void publicAPI
            .getEvent(idOrSlug)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setEvent(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [idOrSlug]);

    if (state === "loading") {
        return (
            <PageContainer className="max-w-3xl space-y-6 py-10 sm:py-14">
                <BackLink href={publicEventPath(idOrSlug)} label="Back to event" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !event) {
        return (
            <PageContainer className="max-w-3xl space-y-6 py-10 sm:py-14">
                <BackLink href="/events" label="Back to Events" />
                <div className="empty-state max-w-lg">
                    <h1 className="empty-state-title">Event not found</h1>
                    <p className="empty-state-text">This event may have been removed or is not published.</p>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="max-w-3xl space-y-6 py-10 sm:py-14">
            <BackLink href={publicEventPath(event.slug)} label="Back to event" />
            {!event.registrationOpen ? (
                <div className="registration-error-banner">
                    Registration is closed for this event. It may be full or past the registration deadline.
                </div>
            ) : (
                <RegisterPageGuard eventId={event.id} eventSlug={event.slug}>
                    <RegistrationForm eventId={event.id} eventSlug={event.slug} eventTitle={event.title} />
                </RegisterPageGuard>
            )}
        </PageContainer>
    );
}
