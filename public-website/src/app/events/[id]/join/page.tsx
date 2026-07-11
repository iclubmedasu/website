import { redirect } from "next/navigation";
import { JoinSessionStatus } from "@/components/events/JoinSessionStatus";
import { publicAPI } from "@/lib/api";
import { redirectNumericParamToSlug } from "@/lib/publicSlug";
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

    // Best-effort canonical redirect when the event is publicly resolvable.
    const event = await publicAPI.getEvent(id);
    if (event) {
        redirectNumericParamToSlug({
            param: id,
            slug: event.slug,
            basePath: "events",
            suffix: "/join",
            searchParams: { token: trimmedToken },
        });
    }

    const result = await publicAPI.joinEventSession(event?.slug ?? id, trimmedToken);

    if (result.status === "ready" && result.redirectUrl) {
        redirect(result.redirectUrl);
    }

    return (
        <JoinSessionStatus
            result={{
                ...result,
                eventId: result.eventId ?? event?.id,
            }}
            eventSlug={event?.slug}
        />
    );
}
