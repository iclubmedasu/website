import type { PublicEventSession } from "@iclub/shared";
import { formatSessionRange, formatSessionRangeDual } from "@iclub/shared/utils";

export function isSessionEnded(
    session: Pick<PublicEventSession, "hasEnded" | "endDateTime">,
    now: Date = new Date(),
): boolean {
    if (session.hasEnded != null) return session.hasEnded;
    if (!session.endDateTime) return false;
    const end = new Date(session.endDateTime);
    return !Number.isNaN(end.getTime()) && now.getTime() >= end.getTime();
}

export function formatSessionDisplayLabel(input: {
    label?: string | null;
    startDateTime?: string | null;
    endDateTime?: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode?: string | null;
}): string {
    const title = input.label?.trim();
    const scheduleLabel = input.startDateTime && input.endDateTime
        ? formatSessionRange(input.startDateTime, input.endDateTime)
        : null;
    const modeLabel = input.mode === "ONSITE" ? "Onsite" : input.mode === "ONLINE" ? "Online" : null;
    return [title, scheduleLabel, modeLabel].filter(Boolean).join(" · ");
}

export function formatSessionDisplayLabelDual(
    input: Parameters<typeof formatSessionDisplayLabel>[0],
    eventTimezone: string,
): string {
    const title = input.label?.trim();
    const scheduleLabel = input.startDateTime && input.endDateTime
        ? formatSessionRangeDual(input.startDateTime, input.endDateTime, eventTimezone)
        : null;
    const modeLabel = input.mode === "ONSITE" ? "Onsite" : input.mode === "ONLINE" ? "Online" : null;
    return [title, scheduleLabel, modeLabel].filter(Boolean).join(" · ");
}
