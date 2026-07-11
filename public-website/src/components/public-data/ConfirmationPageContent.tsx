"use client";

import { useEffect, useState } from "react";
import type { PublicRegistrationConfirmation } from "@iclub/shared";
import { RegistrationConfirmation } from "@/components/registration/RegistrationConfirmation";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { publicEventPath } from "@/lib/publicSlug";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function ConfirmationPageContent({
    idOrSlug,
    code,
}: {
    idOrSlug: string;
    code: string;
}) {
    const [state, setState] = useState<LoadState>("loading");
    const [confirmation, setConfirmation] = useState<PublicRegistrationConfirmation | null>(null);

    useEffect(() => {
        void publicAPI
            .getRegistrationConfirmation(idOrSlug, code)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setConfirmation(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [idOrSlug, code]);

    const backHref = confirmation ? publicEventPath(confirmation.event.slug) : publicEventPath(idOrSlug);

    if (state === "loading") {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={publicEventPath(idOrSlug)} label="Back to event" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !confirmation) {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={publicEventPath(idOrSlug)} label="Back to event" />
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
            <BackLink href={backHref} label="Back to event" />
            <RegistrationConfirmation confirmation={confirmation} />
        </PageContainer>
    );
}
