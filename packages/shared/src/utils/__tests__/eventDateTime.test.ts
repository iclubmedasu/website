import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatEventDateRange, formatRegistrationDeadline } from "../eventDateTime";

const ORIGINAL_TZ = process.env.TZ;
const EVENT_START_ISO = "2026-07-01T19:00:00.000Z"; // 10:00 PM in Africa/Cairo (UTC+3)
const EVENT_END_ISO = "2026-07-01T20:00:00.000Z"; // 11:00 PM in Africa/Cairo

describe("eventDateTime", () => {
    afterEach(() => {
        if (ORIGINAL_TZ === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = ORIGINAL_TZ;
        }
    });

    describe("Africa/Cairo", () => {
        beforeEach(() => {
            process.env.TZ = "Africa/Cairo";
        });

        it("formats same-day event range in local time", () => {
            const label = formatEventDateRange(EVENT_START_ISO, EVENT_END_ISO);
            expect(label).toContain("10:00");
            expect(label).toContain("11:00");
        });

        it("formats registration deadline in local time", () => {
            const label = formatRegistrationDeadline(EVENT_START_ISO);
            expect(label).toContain("10:00");
        });
    });

    describe("timezone behavior", () => {
        it("represents the same UTC instant differently per IANA zone", () => {
            const formatHour = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone,
            }).format(new Date(iso));

            const cairo = formatHour(EVENT_START_ISO, "Africa/Cairo");
            const newYork = formatHour(EVENT_START_ISO, "America/New_York");

            expect(cairo).toMatch(/10:00/);
            expect(newYork).toMatch(/3:00/);
            expect(cairo).not.toBe(newYork);
        });
    });

    it("returns em dash for invalid instants", () => {
        expect(formatEventDateRange("invalid", EVENT_END_ISO)).toBe("—");
    });

    it("returns null for empty registration deadline", () => {
        expect(formatRegistrationDeadline(null)).toBeNull();
        expect(formatRegistrationDeadline("")).toBeNull();
    });
});
