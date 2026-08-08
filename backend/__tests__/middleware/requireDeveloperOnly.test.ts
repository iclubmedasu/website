import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireDeveloperOnly } from "../../middleware/auth";

function buildApp(user?: { isDeveloper?: boolean }) {
    const app = express();
    app.use((req, _res, next) => {
        (req as { user?: typeof user }).user = user;
        next();
    });
    app.get("/secure", requireDeveloperOnly, (_req, res) => {
        res.json({ ok: true });
    });
    return app;
}

describe("requireDeveloperOnly", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows developer users", async () => {
        const res = await request(buildApp({ isDeveloper: true })).get("/secure");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it("rejects non-developer users", async () => {
        const res = await request(buildApp({ isDeveloper: false })).get("/secure");
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Developer access required/i);
    });

    it("rejects missing user", async () => {
        const res = await request(buildApp(undefined)).get("/secure");
        expect(res.status).toBe(403);
    });
});
