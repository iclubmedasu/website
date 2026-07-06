import { formatSessionRange } from "@iclub/shared/utils";

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
