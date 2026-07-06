const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
};

const DEADLINE_FORMAT: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
};

function parseInstant(value: string): Date | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

/** Format event start/end for display in the viewer's local timezone. */
export function formatEventDateRange(eventDate: string, eventEndDate: string): string {
    const start = parseInstant(eventDate);
    const end = parseInstant(eventEndDate);
    if (!start || !end) return "—";

    const sameDay = start.toDateString() === end.toDateString();
    const dateFormatter = new Intl.DateTimeFormat("en-US", DATE_FORMAT);
    const timeFormatter = new Intl.DateTimeFormat("en-US", TIME_FORMAT);

    if (sameDay) {
        return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
    }

    return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function formatRegistrationDeadline(value?: string | null): string | null {
    if (!value) return null;
    const date = parseInstant(value);
    if (!date) return null;
    return new Intl.DateTimeFormat("en-US", DEADLINE_FORMAT).format(date);
}
