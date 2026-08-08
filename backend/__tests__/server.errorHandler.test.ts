/**
 * Mirrors the central error-handler contract in backend/server.ts:
 * production returns a generic message; development/test may expose err.message.
 * Always logs server-side (asserted via console.error spy).
 */
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

function buildAppWithErrorHandler(nodeEnv: string | undefined) {
    const previous = process.env.NODE_ENV;
    if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = nodeEnv;
    }

    const isDevelopment = process.env.NODE_ENV !== "production";
    const app = express();

    app.get("/boom", (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error("secret database connection string leaked"));
    });

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        void _next;
        console.error("Error:", err);
        const message =
            isDevelopment && err instanceof Error ? err.message : "Internal server error";
        res.status(500).json({ error: message });
    });

    return {
        app,
        restore() {
            if (previous === undefined) {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = previous;
            }
        },
    };
}

describe("server error handler (B6)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a generic message in production and still logs the full error", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const { app, restore } = buildAppWithErrorHandler("production");

        try {
            const response = await request(app).get("/boom");
            expect(response.status).toBe(500);
            expect(response.body.error).toBe("Internal server error");
            expect(response.body.error).not.toContain("secret database");
            expect(logSpy).toHaveBeenCalled();
            const logged = logSpy.mock.calls[0];
            expect(logged?.[0]).toBe("Error:");
            expect(logged?.[1]).toBeInstanceOf(Error);
            expect((logged?.[1] as Error).message).toContain("secret database");
        } finally {
            restore();
        }
    });

    it("returns err.message in development", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const { app, restore } = buildAppWithErrorHandler("development");

        try {
            const response = await request(app).get("/boom");
            expect(response.status).toBe(500);
            expect(response.body.error).toBe("secret database connection string leaked");
            expect(logSpy).toHaveBeenCalled();
        } finally {
            restore();
        }
    });

    it("returns err.message in test", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { app, restore } = buildAppWithErrorHandler("test");

        try {
            const response = await request(app).get("/boom");
            expect(response.status).toBe(500);
            expect(response.body.error).toBe("secret database connection string leaked");
        } finally {
            restore();
        }
    });
});
