import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    memberFindFirst: vi.fn(),
    memberFindUnique: vi.fn(),
    memberUpdate: vi.fn(),
    teamMemberFindMany: vi.fn(),
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
    userCreate: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        member: {
            findFirst: prismaMocks.memberFindFirst,
            findUnique: prismaMocks.memberFindUnique,
            update: prismaMocks.memberUpdate,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        user: {
            findFirst: prismaMocks.userFindFirst,
            update: prismaMocks.userUpdate,
            create: prismaMocks.userCreate,
        },
        $transaction: prismaMocks.transaction,
    },
}));

import authRouter from "../../routes/auth";
import { JWT_SECRET } from "../../middleware/auth";

function buildAuthApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/", authRouter);
    return app;
}

describe("GET /auth/ws-ticket", () => {
    const originalDevEmail = process.env.DEVELOPER_EMAIL;
    const originalDevPassword = process.env.DEVELOPER_PASSWORD;

    afterEach(() => {
        if (originalDevEmail === undefined) delete process.env.DEVELOPER_EMAIL;
        else process.env.DEVELOPER_EMAIL = originalDevEmail;
        if (originalDevPassword === undefined) delete process.env.DEVELOPER_PASSWORD;
        else process.env.DEVELOPER_PASSWORD = originalDevPassword;
        vi.clearAllMocks();
    });

    it("returns 401 without cookie or bearer", async () => {
        const response = await request(buildAuthApp()).get("/ws-ticket");
        expect(response.status).toBe(401);
        expect(response.body.error).toBeTruthy();
    });

    it("returns a short-lived token for a valid cookie session", async () => {
        process.env.DEVELOPER_EMAIL = "dev@iclub.com";
        process.env.DEVELOPER_PASSWORD = "dev123456";

        const login = await request(buildAuthApp())
            .post("/login")
            .send({ email: "dev@iclub.com", password: "dev123456" });

        expect(login.status).toBe(200);
        const cookies = login.headers["set-cookie"];
        expect(cookies).toBeTruthy();

        const response = await request(buildAuthApp())
            .get("/ws-ticket")
            .set("Cookie", cookies);

        expect(response.status).toBe(200);
        expect(typeof response.body.token).toBe("string");
        const decoded = jwt.verify(response.body.token, JWT_SECRET) as {
            exp: number;
            iat: number;
            isDeveloper?: boolean;
        };
        expect(decoded.isDeveloper).toBe(true);
        // 2 minute ticket
        expect(decoded.exp - decoded.iat).toBe(120);
    });

    it("returns a short-lived token for bearer auth", async () => {
        const token = jwt.sign(
            {
                userId: 0,
                memberId: 0,
                email: "dev@iclub.com",
                isDeveloper: true,
                isSupportFormsEditor: true,
                isFinanceViewer: true,
            },
            JWT_SECRET,
            { expiresIn: "1h" },
        );

        const response = await request(buildAuthApp())
            .get("/ws-ticket")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(typeof response.body.token).toBe("string");
    });
});
