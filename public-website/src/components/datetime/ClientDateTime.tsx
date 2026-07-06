"use client";

import {
    formatDate,
    formatDateTime,
    formatEventDateRange,
    formatRegistrationDeadline,
    formatSessionRange,
} from "@iclub/shared/utils";
import { useEffect, useState } from "react";

type ClientFormattedInstantVariant =
    | "eventRange"
    | "deadline"
    | "date"
    | "dateTime"
    | "sessionRange";

interface ClientFormattedInstantProps {
    variant: ClientFormattedInstantVariant;
    value?: string | null;
    startIso?: string;
    endIso?: string;
    className?: string;
    prefix?: string;
    inline?: boolean;
}

function formatByVariant(
    variant: ClientFormattedInstantVariant,
    value?: string | null,
    startIso?: string,
    endIso?: string,
): string | null {
    switch (variant) {
        case "eventRange":
            return startIso && endIso ? formatEventDateRange(startIso, endIso) : "—";
        case "deadline":
            return formatRegistrationDeadline(value);
        case "date":
            return value ? formatDate(value) : null;
        case "dateTime":
            return value ? formatDateTime(value) : null;
        case "sessionRange":
            return startIso && endIso ? formatSessionRange(startIso, endIso) : "—";
        default:
            return null;
    }
}

export function ClientFormattedInstant({
    variant,
    value,
    startIso,
    endIso,
    className,
    prefix = "",
    inline = false,
}: ClientFormattedInstantProps) {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        setLabel(formatByVariant(variant, value, startIso, endIso));
    }, [variant, value, startIso, endIso]);

    if (variant === "deadline" && !value) return null;
    if (!label) {
        const Tag = inline ? "span" : "span";
        return <Tag className={className} aria-busy="true">…</Tag>;
    }

    const content = (
        <>
            {prefix}
            {label}
        </>
    );

    if (inline) {
        return <span className={className}>{content}</span>;
    }

    return <span className={className} aria-busy={false}>{content}</span>;
}

interface ClientEventDateRangeProps {
    eventDate: string;
    eventEndDate: string;
    className?: string;
}

export function ClientEventDateRange({ eventDate, eventEndDate, className }: ClientEventDateRangeProps) {
    return (
        <ClientFormattedInstant
            variant="eventRange"
            startIso={eventDate}
            endIso={eventEndDate}
            className={className}
        />
    );
}

interface ClientRegistrationDeadlineProps {
    value?: string | null;
    className?: string;
    prefix?: string;
    inline?: boolean;
}

export function ClientRegistrationDeadline({
    value,
    className,
    prefix = "Registration deadline: ",
    inline = false,
}: ClientRegistrationDeadlineProps) {
    if (!value) return null;

    if (inline) {
        return (
            <ClientFormattedInstant
                variant="deadline"
                value={value}
                className={className}
                prefix={prefix}
                inline
            />
        );
    }

    return (
        <p className={className}>
            <ClientFormattedInstant
                variant="deadline"
                value={value}
                prefix={prefix}
                inline
            />
        </p>
    );
}

export function ClientFormattedDate({ value, className }: { value?: string | null; className?: string }) {
    if (!value) return null;
    return <ClientFormattedInstant variant="date" value={value} className={className} />;
}

export function ClientSessionRange({
    startDateTime,
    endDateTime,
    className,
}: {
    startDateTime: string;
    endDateTime: string;
    className?: string;
}) {
    return (
        <ClientFormattedInstant
            variant="sessionRange"
            startIso={startDateTime}
            endIso={endDateTime}
            className={className}
        />
    );
}
