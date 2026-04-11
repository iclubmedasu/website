import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import routes from "./routes";
import { prisma } from "./db";
import { attachNotificationsWebSocketServer } from "./services/notificationsRealtime";

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "loaded" : "NOT LOADED");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "loaded" : "NOT LOADED");
console.log("DEVELOPER_EMAIL:", process.env.DEVELOPER_EMAIL || "dev@iclub.com");
console.log(
    "GITHUB_STORAGE_REPO:",
    process.env.GITHUB_STORAGE_REPO ? "loaded" : "NOT SET",
);
console.log(
    "GITHUB_STORAGE_TOKEN:",
    process.env.GITHUB_STORAGE_TOKEN ? "loaded" : "NOT SET",
);

const app = express();

const frontendOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://iclubmedasu-members-portal.netlify.app",
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
app.use("/api", routes);

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
});

const PORT = Number(process.env.PORT ?? 8080);
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS enabled for ${frontendOrigins.join(", ")}`);
    if (isDevelopment) {
        console.log("CORS also allows private-network origins in development mode.");
    }
    console.log(`Notifications websocket: ws://localhost:${PORT}/api/notifications/ws`);
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
