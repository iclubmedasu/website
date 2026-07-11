import type { PublicEventJoinResponse } from "@iclub/shared";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicEventPath } from "@/lib/publicSlug";
import { JoinSessionCountdown } from "./JoinSessionCountdown";

function statusCopy(result: PublicEventJoinResponse): { title: string; description: string } {
    switch (result.status) {
        case "not_started":
            return {
                title: "Session has not started yet",
                description:
                    result.message ??
                    "Online join opens when the session begins. You can keep this page open.",
            };
        case "ended":
            return {
                title: "This session has ended",
                description:
                    result.message ??
                    "Online join is only available during the session time. Thank you for registering.",
            };
        case "cancelled":
            return {
                title: "Registration cancelled",
                description:
                    result.message ??
                    "Your registration for this event has been cancelled, so this join link is no longer active.",
            };
        case "not_online":
            return {
                title: "Online join unavailable",
                description:
                    result.message ??
                    "This session is not set up for online join. Please check your ticket or contact the organizers.",
            };
        case "invalid_link":
            return {
                title: "Join link unavailable",
                description:
                    result.message ??
                    "This join link is invalid or no longer available. Please use the link from your ticket email.",
            };
        case "error":
        default:
            return {
                title: "Unable to join right now",
                description:
                    result.message ??
                    "Something went wrong while opening this session. Please try again in a moment.",
            };
    }
}

export function JoinSessionStatus({
    result,
    eventSlug,
}: {
    result: PublicEventJoinResponse;
    eventSlug?: string;
}) {
    const { title, description } = statusCopy(result);
    const eventHref = eventSlug
        ? publicEventPath(eventSlug)
        : typeof result.eventId === "number" && result.eventId > 0
          ? publicEventPath(result.eventId)
          : "/events";
    const backLabel = eventHref === "/events" ? "Back to Events" : "Back to event";

    return (
        <PageContainer className="space-y-10 py-10 sm:py-14">
            <BackLink href={eventHref} label={backLabel} />
            <div className="empty-state mx-auto max-w-lg">
                {result.eventTitle ? (
                    <p className="mb-2 text-sm font-medium text-purple-700">{result.eventTitle}</p>
                ) : null}
                {result.sessionLabel ? (
                    <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">{result.sessionLabel}</p>
                ) : null}
                <h1 className="empty-state-title">{title}</h1>
                {result.status === "not_started" && result.startsAt ? (
                    <>
                        <p className="empty-state-text">{description}</p>
                        <div className="mt-3">
                            <JoinSessionCountdown startsAt={result.startsAt} />
                        </div>
                    </>
                ) : (
                    <p className="empty-state-text">{description}</p>
                )}
            </div>
        </PageContainer>
    );
}
