import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import routes from "./routes";
import { prisma } from "./db";
import { assertValidNodeEnv, resolveJwtSecret } from "./lib/securityEnv";
import { attachNotificationsWebSocketServer } from "./services/notificationsRealtime";

// Fail closed early on invalid NODE_ENV or missing production secrets.
assertValidNodeEnv();
resolveJwtSecret();

const app = express();
app.set("trust proxy", 1);

app.use(
    helmet({
        // API serves JSON / file downloads; CSP is owned by the frontend apps.
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);

// CORS allowlist: env vars are the source of truth for production hosts.
// HF Space URLs below are safe fallbacks until custom domains are live; add
// https://members-portal.iclubmedasu.com / https://iclubmedasu.com via FRONTEND_ORIGINS.
const frontendOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://iclubmedasu-members-portal.hf.space",
    "https://iclubmedasu-public-website.hf.space",
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_ORIGINS
        ? process.env.FRONTEND_ORIGINS.split(",").map((value) => value.trim())
        : []),
].filter(Boolean) as string[];

const frontendOriginSet = new Set(frontendOrigins);
const isDevelopment = process.env.NODE_ENV !== "production";

function isPrivateNetworkOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        const host = url.hostname;

        if (host.startsWith("192.168.")) return true;
        if (host.startsWith("10.")) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

        return false;
    } catch {
        return false;
    }
}

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }

            if (frontendOriginSet.has(origin)) {
                callback(null, true);
                return;
            }

            // Dev-only: allow LAN origins for mobile testing.
            if (isDevelopment && isPrivateNetworkOrigin(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        },
        credentials: true,
    }),
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
    // Prefer FRONTEND_URL in Space/env settings; HF URL is a fallback until custom domains cut over.
    const membersPortal =
        process.env.FRONTEND_URL?.trim() || "https://iclubmedasu-members-portal.hf.space";
    res.json({
        service: "iClub Members Portal API",
        status: "ok",
        message: "Backend API only. Open the members portal to sign in.",
        membersPortal,
        health: "/health",
        api: "/api",
    });
});

app.use("/api", routes);

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// Debug DB probe — disabled in production.
if (isDevelopment) {
    app.get("/test-db", async (_req: Request, res: Response) => {
        try {
            await prisma.$connect();
            const count = await prisma.team.count();
            res.json({ status: "connected", teamCount: count });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown DB error";
            res.status(500).json({ status: "failed", error: message });
        }
    });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;

    // body-parser / express.json(): bad client body (probes, scanners, typos).
    // Status is 400 — do not promote to 500 or dump a stack as a server failure.
    const parseFailed =
        typeof err === "object" &&
        err !== null &&
        ("type" in err) &&
        (err as { type?: string }).type === "entity.parse.failed";
    const clientBadRequest =
        parseFailed ||
        (err instanceof SyntaxError &&
            typeof err === "object" &&
            err !== null &&
            (("status" in err && (err as { status?: number }).status === 400) ||
                ("statusCode" in err && (err as { statusCode?: number }).statusCode === 400)));

    if (clientBadRequest) {
        console.warn("Invalid JSON body rejected");
        res.status(400).json({ error: "Invalid JSON body" });
        return;
    }

    console.error("Error:", err);
    // Never expose internal error details to clients in production.
    const message =
        isDevelopment && err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
});

const PORT = Number(process.env.PORT ?? 8080);
const server = app.listen(PORT, () => {
    const emailFrom =
        process.env.RESEND_FROM_EMAIL?.trim() || "asu.medicine.iclub@gmail.com";
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Email From: ${emailFrom}`);
});

attachNotificationsWebSocketServer(server);

server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
        console.error(
            `Port ${PORT} is already in use. Kill the other process or use a different port.`,
        );
    } else {
        console.error("Server error:", err);
    }
    process.exit(1);
});
