import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowDev = process.env.ALLOW_DEVELOPER_BACKDOOR;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAllowDev === undefined) delete process.env.ALLOW_DEVELOPER_BACKDOOR;
        else process.env.ALLOW_DEVELOPER_BACKDOOR = originalAllowDev;
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAllowDev === undefined) delete process.env.ALLOW_DEVELOPER_BACKDOOR;
        else process.env.ALLOW_DEVELOPER_BACKDOOR = originalAllowDev;
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

    it("denies developer JWT when production backdoor is disabled", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_DEVELOPER_BACKDOOR;

        const res = await request(buildApp({ isDeveloper: true })).get("/secure");
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Developer access required/i);
    });

    it("allows developer JWT in production when backdoor is explicitly enabled", async () => {
        process.env.NODE_ENV = "production";
        process.env.ALLOW_DEVELOPER_BACKDOOR = "true";

        const res = await request(buildApp({ isDeveloper: true })).get("/secure");
        expect(res.status).toBe(200);
    });
});
