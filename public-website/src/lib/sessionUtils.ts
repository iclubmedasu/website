export function formatSessionDisplayLabel(input: {
    label?: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode?: string | null;
}): string {
    const title = input.label?.trim();
    const parsed = new Date(`${input.sessionDate.slice(0, 10)}T12:00:00`);
    const dateLabel = Number.isNaN(parsed.getTime())
        ? input.sessionDate
        : parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeRange = input.startTime && input.endTime ? `${input.startTime}–${input.endTime}` : null;
    const modeLabel = input.mode === "ONSITE" ? "Onsite" : input.mode === "ONLINE" ? "Online" : null;
    return [title, dateLabel, timeRange, modeLabel].filter(Boolean).join(" · ");
}
