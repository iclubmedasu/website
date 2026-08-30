import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, isValidSessionToken, POST } from "../route";

const cookieSet = vi.fn();

vi.mock("next/headers", () => ({
    cookies: vi.fn(async () => ({
        set: cookieSet,
    })),
}));

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

describe("POST /api/session", () => {
    beforeEach(() => {
        cookieSet.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("sets httpOnly token cookie on valid token", async () => {
        const token = "header.payload.signature";
        const response = await POST(
            new Request("http://localhost:3001/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            }),
        );

        expect(response.status).toBe(200);
        expect(cookieSet).toHaveBeenCalledWith(
            "token",
            token,
            expect.objectContaining({
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                maxAge: 7 * 24 * 60 * 60,
            }),
        );
    });

    it("rejects invalid token bodies", async () => {
        const response = await POST(
            new Request("http://localhost:3001/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: "garbage" }),
            }),
        );

        expect(response.status).toBe(400);
        expect(cookieSet).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/session", () => {
    beforeEach(() => {
        cookieSet.mockReset();
    });

    it("clears the token cookie", async () => {
        const response = await DELETE();

        expect(response.status).toBe(200);
        expect(cookieSet).toHaveBeenCalledWith(
            "token",
            "",
            expect.objectContaining({
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                maxAge: 0,
            }),
        );
    });
});
