import { describe, expect, it } from "vitest";
import {
    buildAlreadyIssuedSet,
    certRecipientKey,
    normalizeRecipientEmail,
} from "../../lib/certificateRecipientKey";

describe("certificateRecipientKey", () => {
    it("normalizes email casing and whitespace", () => {
        expect(normalizeRecipientEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    });

    it("keys by member id when present", () => {
        expect(certRecipientKey(12, "ATTENDANCE", "a@example.com")).toBe("m:12:ATTENDANCE");
        expect(certRecipientKey(12, "ATTENDANCE", "b@example.com")).toBe("m:12:ATTENDANCE");
    });

    it("keys by email when member id is missing so walk-ins stay distinct", () => {
        expect(certRecipientKey(null, "ATTENDANCE", "a@example.com")).toBe("e:a@example.com:ATTENDANCE");
        expect(certRecipientKey(undefined, "ATTENDANCE", "B@Example.com")).toBe(
            "e:b@example.com:ATTENDANCE",
        );
        expect(certRecipientKey(null, "ATTENDANCE", "a@example.com")).not.toBe(
            certRecipientKey(null, "ATTENDANCE", "c@example.com"),
        );
    });

    it("marks only the matching recipient as already issued", () => {
        const issued = buildAlreadyIssuedSet([
            {
                recipientMemberId: null,
                type: "ATTENDANCE",
                recipientEmail: "walkin@example.com",
            },
            {
                recipientMemberId: 7,
                type: "ORGANIZATION",
                recipientEmail: "staff@example.com",
            },
        ]);

        expect(issued.has(certRecipientKey(null, "ATTENDANCE", "walkin@example.com"))).toBe(true);
        expect(issued.has(certRecipientKey(null, "ATTENDANCE", "other@example.com"))).toBe(false);
        expect(issued.has(certRecipientKey(7, "ORGANIZATION", "staff@example.com"))).toBe(true);
        expect(issued.has(certRecipientKey(8, "ORGANIZATION", "other@example.com"))).toBe(false);
        expect(issued.has(certRecipientKey(7, "ATTENDANCE", "staff@example.com"))).toBe(false);
    });
});
