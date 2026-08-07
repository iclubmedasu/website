import { redirect } from "next/navigation";
import { JoinSessionStatus } from "@/components/events/JoinSessionStatus";
import { publicAPI } from "@/lib/api";
import { isNumericPublicParam, redirectNumericParamToSlug } from "@/lib/publicSlug";
import type { PublicEventJoinResponse } from "@iclub/shared";

interface JoinPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
    const { id } = await params;
    const { token } = await searchParams;
    const trimmedToken = token?.trim();

    if (!trimmedToken) {
        const invalid: PublicEventJoinResponse = {
            status: "invalid_link",
            message: "This join link is missing required details.",
        };
        return <JoinSessionStatus result={invalid} />;
    }

    // Best-effort canonical redirect only for numeric ids (skip Space→Space getEvent for slugs).
    let eventSlug: string | undefined;
    let eventId: number | undefined;
    if (isNumericPublicParam(id)) {
        const event = await publicAPI.getEvent(id);
        if (event) {
            redirectNumericParamToSlug({
                param: id,
                slug: event.slug,
                basePath: "events",
                suffix: "/join",
                searchParams: { token: trimmedToken },
            });
            eventSlug = event.slug;
            eventId = event.id;
        }
    }

    const result = await publicAPI.joinEventSession(eventSlug ?? id, trimmedToken);

    if (result.status === "ready" && result.redirectUrl) {
        redirect(result.redirectUrl);
    }

    return (
        <JoinSessionStatus
            result={{
                ...result,
                eventId: result.eventId ?? eventId,
            }}
            eventSlug={eventSlug ?? (isNumericPublicParam(id) ? undefined : id)}
        />
    );
}
