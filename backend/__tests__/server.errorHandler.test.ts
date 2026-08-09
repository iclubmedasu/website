/**
 * Mirrors the central error-handler contract in backend/server.ts:
 * - Invalid JSON (body-parser entity.parse.failed) → 400
 * - production returns a generic message for 500s; development/test may expose err.message
 * - Real server errors log via console.error
 */
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

function isClientBadRequest(err: unknown): boolean {
    const parseFailed =
        typeof err === "object" &&
        err !== null &&
        "type" in err &&
        (err as { type?: string }).type === "entity.parse.failed";
    const clientBadRequest =
        parseFailed ||
        (err instanceof SyntaxError &&
            typeof err === "object" &&
            err !== null &&
            (("status" in err && (err as { status?: number }).status === 400) ||
                ("statusCode" in err && (err as { statusCode?: number }).statusCode === 400)));
    return clientBadRequest;
}

function attachErrorHandler(app: express.Express, isDevelopment: boolean) {
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        void _next;

        if (isClientBadRequest(err)) {
            console.warn("Invalid JSON body rejected");
            res.status(400).json({ error: "Invalid JSON body" });
            return;
        }

        console.error("Error:", err);
        const message =
            isDevelopment && err instanceof Error ? err.message : "Internal server error";
        res.status(500).json({ error: message });
    });
}

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

    attachErrorHandler(app, isDevelopment);

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

/** App that mounts express.json() so body-parser raises entity.parse.failed. */
function buildAppWithJsonParser(nodeEnv: string | undefined) {
    const previous = process.env.NODE_ENV;
    if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = nodeEnv;
    }

    const isDevelopment = process.env.NODE_ENV !== "production";
    const app = express();
    app.use(express.json());
    app.post("/echo", (req: Request, res: Response) => {
        res.json({ ok: true, body: req.body });
    });
    attachErrorHandler(app, isDevelopment);

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

    it("rejects invalid JSON bodies with 400 and does not log as a server Error", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { app, restore } = buildAppWithJsonParser("production");

        try {
            const response = await request(app)
                .post("/echo")
                .set("Content-Type", "application/json")
                .send("not json");

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: "Invalid JSON body" });
            expect(errorSpy).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith("Invalid JSON body rejected");
        } finally {
            restore();
        }
    });
});
