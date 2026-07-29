import { describe, expect, it } from "vitest";
import {
    DEFAULT_TICKET_ACCENT,
    DEFAULT_TICKET_PALETTE,
    deriveTicketPalette,
    normalizeHex,
} from "../ticketDesign";

describe("normalizeHex", () => {
    it("normalizes 6-digit hex with or without hash", () => {
        expect(normalizeHex("#561789")).toBe("#561789");
        expect(normalizeHex("561789")).toBe("#561789");
        expect(normalizeHex("#ABCDEF")).toBe("#abcdef");
    });

    it("expands 3-digit hex", () => {
        expect(normalizeHex("#abc")).toBe("#aabbcc");
        expect(normalizeHex("ABC")).toBe("#aabbcc");
    });

    it("returns null for invalid input", () => {
        expect(normalizeHex(null)).toBeNull();
        expect(normalizeHex(undefined)).toBeNull();
        expect(normalizeHex("")).toBeNull();
        expect(normalizeHex("not-a-color")).toBeNull();
        expect(normalizeHex("#12")).toBeNull();
        expect(normalizeHex("#12345g")).toBeNull();
    });
});

describe("deriveTicketPalette", () => {
    it("returns the default brand palette for missing or invalid accent", () => {
        expect(deriveTicketPalette(null)).toEqual(DEFAULT_TICKET_PALETTE);
        expect(deriveTicketPalette(undefined)).toEqual(DEFAULT_TICKET_PALETTE);
        expect(deriveTicketPalette("")).toEqual(DEFAULT_TICKET_PALETTE);
        expect(deriveTicketPalette("nope")).toEqual(DEFAULT_TICKET_PALETTE);
    });

    it("returns the exact default palette for the brand accent", () => {
        expect(deriveTicketPalette(DEFAULT_TICKET_ACCENT)).toEqual(DEFAULT_TICKET_PALETTE);
        expect(deriveTicketPalette("#561789")).toEqual(DEFAULT_TICKET_PALETTE);
        expect(deriveTicketPalette("561789")).toEqual(DEFAULT_TICKET_PALETTE);
    });

    it("derives a lighter shade scale from a custom accent", () => {
        const palette = deriveTicketPalette("#c41e3a");
        expect(palette[900]).toBe("#c41e3a");
        expect(palette[800]).not.toBe(palette[900]);
        expect(palette[400]).not.toBe(palette[900]);
        // Lighter shades should have higher channel averages than the accent
        const avg = (hex: string) => {
            const n = parseInt(hex.slice(1), 16);
            return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
        };
        expect(avg(palette[400])).toBeGreaterThan(avg(palette[900]));
        expect(avg(palette[600])).toBeGreaterThan(avg(palette[900]));
    });
});
