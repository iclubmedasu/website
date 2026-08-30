import { describe, expect, it } from "vitest";
import { isValidSessionToken } from "../sessionToken";

describe("isValidSessionToken", () => {
    it("accepts JWT-shaped non-empty strings", () => {
        expect(isValidSessionToken("aaa.bbb.ccc")).toBe(true);
        expect(isValidSessionToken("  eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig  ")).toBe(true);
    });

    it("rejects empty, non-string, and non-JWT garbage", () => {
        expect(isValidSessionToken("")).toBe(false);
        expect(isValidSessionToken("   ")).toBe(false);
        expect(isValidSessionToken(null)).toBe(false);
        expect(isValidSessionToken(123)).toBe(false);
        expect(isValidSessionToken("not-a-jwt")).toBe(false);
        expect(isValidSessionToken("only.two")).toBe(false);
        expect(isValidSessionToken("a..c")).toBe(false);
        expect(isValidSessionToken(`${"x".repeat(5000)}.b.c`)).toBe(false);
    });
});
