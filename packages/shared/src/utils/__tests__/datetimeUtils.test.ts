import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { combineClubLocalDateTime, toClubDayString } from "../clubLocal";
import { fromEventDateTimeLocalValue, toEventDateTimeLocalValue } from "../eventDateTimeLocal";
import { fromDateInputValue, toDateInputValue } from "../dateInput";
import {
    fromDateTimeLocalValue,
    toDateTimeLocalValue,
} from "../datetimeLocal";
import { formatEventDateRange } from "../eventDateTime";
import { formatSessionRange } from "../formatSession";
import { formatEventDateRangeDual } from "../formatDual";
import { formatEventDateRangeInTimezone } from "../formatInstant";

const ORIGINAL_TZ = process.env.TZ;
const EVENT_START_ISO = "2026-07-01T19:00:00.000Z";
const EVENT_END_ISO = "2026-07-01T20:00:00.000Z";

describe("shared datetime utils", () => {
    afterEach(() => {
        if (ORIGINAL_TZ === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = ORIGINAL_TZ;
        }
    });

    describe("datetimeLocal", () => {
        beforeEach(() => {
            process.env.TZ = "Africa/Cairo";
        });

        it("round-trips datetime-local values", () => {
            expect(toDateTimeLocalValue("2026-06-30T21:00:00.000Z")).toBe("2026-07-01T00:00");
            expect(fromDateTimeLocalValue("2026-07-01T00:00")).toBe("2026-06-30T21:00:00.000Z");
        });
    });

    describe("dateInput", () => {
        beforeEach(() => {
            process.env.TZ = "Africa/Cairo";
        });

        it("round-trips date-only values", () => {
            expect(toDateInputValue("2026-06-30T21:00:00.000Z")).toBe("2026-07-01");
            expect(fromDateInputValue("2026-07-01")).toBe("2026-06-30T21:00:00.000Z");
        });
    });

    describe("clubLocal", () => {
        it("combines Cairo wall-clock to UTC", () => {
            expect(combineClubLocalDateTime("2026-07-01", "22:00")).toBe("2026-07-01T19:00:00.000Z");
            expect(toClubDayString("2026-07-01T19:00:00.000Z")).toBe("2026-07-01");
        });
    });

    describe("formatters", () => {
        beforeEach(() => {
            process.env.TZ = "Africa/Cairo";
        });

        it("formats event ranges in local time", () => {
            const label = formatEventDateRange(EVENT_START_ISO, EVENT_END_ISO);
            expect(label).toContain("10:00");
            expect(label).toContain("11:00");
        });

        it("formats session ranges in local time", () => {
            const label = formatSessionRange(EVENT_START_ISO, EVENT_END_ISO);
            expect(label).toContain("10:00");
        });
    });

    describe("eventDateTimeLocal", () => {
        it("round-trips wall-clock in event timezone regardless of process TZ", () => {
            process.env.TZ = "Africa/Cairo";
            const londonTz = "Europe/London";
            // 18:00 London on 2026-07-01 = 17:00 UTC (BST)
            const local = "2026-07-01T18:00";
            const iso = fromEventDateTimeLocalValue(local, londonTz);
            expect(iso).toBe("2026-07-01T17:00:00.000Z");
            expect(toEventDateTimeLocalValue(iso!, londonTz)).toBe(local);
        });
    });

    describe("formatDual", () => {
        it("shows venue and viewer labels when timezones differ", () => {
            const start = "2026-07-01T19:00:00.000Z";
            const end = "2026-07-01T20:00:00.000Z";
            const eventTimezone = "Pacific/Auckland";
            const inEvent = formatEventDateRange(start, end, eventTimezone);
            const inViewer = formatEventDateRange(start, end);
            if (inEvent === inViewer) return;

            const dual = formatEventDateRangeDual(start, end, eventTimezone);
            expect(dual).toContain("your time");
            expect(dual).toContain("Auckland");
        });

        it("formats venue-only when viewer matches venue", () => {
            const start = EVENT_START_ISO;
            const end = EVENT_END_ISO;
            const eventTimezone = "Africa/Cairo";
            if (formatEventDateRange(start, end, eventTimezone) !== formatEventDateRange(start, end)) {
                return;
            }
            const venue = formatEventDateRangeInTimezone(start, end, eventTimezone);
            const dual = formatEventDateRangeDual(start, end, eventTimezone);
            expect(dual).toBe(venue);
        });
    });
});
