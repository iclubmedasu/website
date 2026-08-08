import express, { Request, Response } from "express";
import { prisma } from "../db";
import { requireDeveloperOnly } from "../middleware/auth";
import { USAGE_ACTION_TYPES } from "../services/usageEventService";

const router = express.Router();

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACTION_KEYS = [
    USAGE_ACTION_TYPES.EVENT_CREATED,
    USAGE_ACTION_TYPES.CERTIFICATE_ISSUED,
    USAGE_ACTION_TYPES.CHECK_IN_SCANNED,
    USAGE_ACTION_TYPES.REGISTRATION_CREATED,
    USAGE_ACTION_TYPES.DATA_EXPORTED,
    USAGE_ACTION_TYPES.LOGIN,
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyStart(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function parseDateOnlyEnd(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function resolveWindow(query: Request["query"]):
    | { ok: true; since: Date; until: Date; windowDays: number }
    | { ok: false; status: number; error: string } {
    const fromRaw = typeof query.from === "string" ? query.from.trim() : "";
    const toRaw = typeof query.to === "string" ? query.to.trim() : "";
    const hasCustom = Boolean(fromRaw || toRaw);

    if (hasCustom) {
        if (!fromRaw || !toRaw) {
            return { ok: false, status: 400, error: "Both from and to (YYYY-MM-DD) are required" };
        }
        const since = parseDateOnlyStart(fromRaw);
        const until = parseDateOnlyEnd(toRaw);
        if (!since || !until) {
            return { ok: false, status: 400, error: "from and to must be valid YYYY-MM-DD dates" };
        }
        if (since.getTime() > until.getTime()) {
            return { ok: false, status: 400, error: "from must be on or before to" };
        }
        const spanDays = Math.floor((until.getTime() - since.getTime()) / DAY_MS) + 1;
        if (spanDays > MAX_DAYS) {
            return { ok: false, status: 400, error: `Date range cannot exceed ${MAX_DAYS} days` };
        }
        return { ok: true, since, until, windowDays: spanDays };
    }

    let days = DEFAULT_DAYS;
    if (query.days !== undefined && query.days !== null && String(query.days).trim() !== "") {
        const parsed = Number.parseInt(String(query.days), 10);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
            return { ok: false, status: 400, error: `days must be an integer between 1 and ${MAX_DAYS}` };
        }
        days = parsed;
    }

    const until = new Date();
    const since = new Date(until.getTime() - days * DAY_MS);
    return { ok: true, since, until, windowDays: days };
}

/**
 * GET /api/usage-dashboard/summary
 * Developer-only product analytics. Query: days=1..366 (default 30) OR from&to=YYYY-MM-DD.
 */
router.get("/summary", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const { since, until, windowDays } = window;
        const createdAtFilter = { gte: since, lte: until };

        const grouped = await prisma.usageEvent.groupBy({
            by: ["actionType"],
            where: { createdAt: createdAtFilter },
            _count: { _all: true },
        });

        const counts: Record<string, number> = {};
        for (const key of ACTION_KEYS) {
            counts[key] = 0;
        }
        for (const row of grouped) {
            if (Object.prototype.hasOwnProperty.call(counts, row.actionType)) {
                counts[row.actionType] = row._count._all;
            }
        }

        const distinctLoginMembers = await prisma.usageEvent.findMany({
            where: {
                actionType: USAGE_ACTION_TYPES.LOGIN,
                createdAt: createdAtFilter,
                memberId: { not: null },
            },
            select: { memberId: true },
            distinct: ["memberId"],
        });

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            counts: {
                eventsCreated: counts[USAGE_ACTION_TYPES.EVENT_CREATED],
                certificatesIssued: counts[USAGE_ACTION_TYPES.CERTIFICATE_ISSUED],
                checkInsScanned: counts[USAGE_ACTION_TYPES.CHECK_IN_SCANNED],
                registrationsCreated: counts[USAGE_ACTION_TYPES.REGISTRATION_CREATED],
                dataExports: counts[USAGE_ACTION_TYPES.DATA_EXPORTED],
                logins: counts[USAGE_ACTION_TYPES.LOGIN],
                activeMembers: distinctLoginMembers.length,
            },
        });
    } catch (error) {
        console.error("GET /usage-dashboard/summary error:", error);
        return res.status(500).json({ error: "Failed to load usage summary" });
    }
});

export default router;
