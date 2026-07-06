import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { combineClubLocalDateTime, toClubDayString } from "../clubLocal";
import { fromDateInputValue, toDateInputValue } from "../dateInput";
import {
    fromDateTimeLocalValue,
    toDateTimeLocalValue,
} from "../datetimeLocal";
import { formatEventDateRange } from "../eventDateTime";
import { formatSessionRange } from "../formatSession";

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
});
