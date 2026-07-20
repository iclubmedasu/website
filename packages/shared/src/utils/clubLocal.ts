import { CLUB_TIMEZONE } from "./constants";
import {
    combineEventLocalDateTime,
    extractEventLocalTime,
    toEventDayString,
} from "./eventLocal";

/** Extract YYYY-MM-DD calendar day from a Date in the club timezone. */
export function toClubDayString(value: string | Date): string | null {
    return toEventDayString(value, CLUB_TIMEZONE);
}

/** Combine club calendar day + HH:mm wall-clock into a UTC ISO instant. */
export function combineClubLocalDateTime(day: string, hhmm: string): string | null {
    return combineEventLocalDateTime(day, hhmm, CLUB_TIMEZONE);
}

export function extractClubLocalTime(value: string | Date): string | null {
    return extractEventLocalTime(value, CLUB_TIMEZONE);
}
