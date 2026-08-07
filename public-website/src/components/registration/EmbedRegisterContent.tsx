"use client";

import { useEffect, useState } from "react";
import type { PublicEventDetail } from "@iclub/shared";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { EmbedHeightReporter } from "@/components/registration/EmbedHeightReporter";
import { publicAPI } from "@/lib/api";

type LoadState = "loading" | "not_found" | "ready";

export function EmbedRegisterContent({
    idOrSlug,
    themeCss,
    layout,
}: {
    idOrSlug: string;
    themeCss: string;
    layout: "default" | "compact" | "spacious";
}) {
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

    return (
        <div className="embed-root" data-layout={layout} data-iclub-embed="registration">
            {themeCss ? (
                <style dangerouslySetInnerHTML={{ __html: themeCss }} />
            ) : null}

            {state === "loading" ? (
                <p className="registration-loading text-sm text-slate-600">Loading registration form…</p>
            ) : null}

            {state === "not_found" || (state === "ready" && !event) ? (
                <div className="registration-error-banner" data-registration="not-found" role="alert">
                    This event may have been removed or is not published.
                </div>
            ) : null}

            {state === "ready" && event ? (
                !event.registrationOpen ? (
                    <div className="registration-error-banner" data-registration="closed" role="alert">
                        Registration is closed for this event. It may be full or past the registration deadline.
                    </div>
                ) : (
                    <RegistrationForm
                        eventId={event.id}
                        eventSlug={event.slug}
                        eventTitle={event.title}
                        isEmbedded
                    />
                )
            ) : null}

            <EmbedHeightReporter />
        </div>
    );
}
