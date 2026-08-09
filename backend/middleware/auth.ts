import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import {
    canEditSiteContent,
    canEditSupportForms,
    isHrHeadOrVice,
} from "../lib/supportPermissions";
import { canViewFinance, isFrHeadOrVice } from "../lib/financePermissions";
import { isProductionEnv, resolveJwtSecret } from "../lib/securityEnv";
import type { RequestUser } from "../types/auth";

const JWT_SECRET = resolveJwtSecret();
const ADMINISTRATION_TEAM_NAME = "Administration";
const JWT_VERIFY_OPTS = { algorithms: ["HS256"] as jwt.Algorithm[] };

/**
 * Query-string JWT (`?token=`) is opt-in only.
 * Remaining callers that still need it (document intentionally):
 * - WebSocket upgrade (`/api/notifications/ws`) — browsers cannot set Authorization on WS handshake;
 *   prefer httpOnly cookie when present, query token as fallback.
 * - File download/version routes that may be opened as bare browser navigation (`<a href>`).
 * Prefer Authorization header or cookie for normal API/fetch traffic.
 */
type AuthTokenSourceOptions = {
    allowQueryToken?: boolean;
};

type AuthTokenSource = {
    headers?: {
        authorization?: string | string[];
        cookie?: string;
    };
    cookies?: {
        token?: string;
    };
    query?: {
        token?: string | string[];
    };
    url?: string;
    originalUrl?: string;
};

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};

    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .reduce<Record<string, string>>((acc, entry) => {
            const index = entry.indexOf('=');
            if (index <= 0) return acc;
            const key = entry.slice(0, index).trim();
            const value = entry.slice(index + 1).trim();
            if (!key) return acc;
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
}

const extractAuthToken = (req: AuthTokenSource, options: AuthTokenSourceOptions = {}): string | undefined => {
    const cookieToken = req.cookies?.token ?? parseCookies(req.headers?.cookie)['token'];
    const authorization = req.headers?.authorization;
    const bearerToken = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '') : undefined;

    if (bearerToken) {
        return bearerToken;
    }

    if (cookieToken) {
        return cookieToken;
    }

    if (options.allowQueryToken) {
        const queryToken = req.query?.token;
        if (typeof queryToken === 'string') return queryToken;
        if (Array.isArray(queryToken)) return queryToken[0];

        const rawUrl = req.url ?? req.originalUrl;
        if (rawUrl) {
            try {
                const parsed = new URL(rawUrl, 'http://localhost');
                const token = parsed.searchParams.get('token');
                if (token) return token;
            } catch {
                // Ignore malformed URLs and fall through.
            }
        }
    }

    return undefined;
};

const authenticateToken = (req: Request, res: Response, next: NextFunction): Response | void => {
    const token = extractAuthToken(req);

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }

        req.user = (user as RequestUser) ?? {};
        return next();
    });
};

const optionalAuthenticateToken = (req: Request, res: Response, next: NextFunction): Response | void => {
    const token = extractAuthToken(req);

    if (!token) {
        req.user = undefined;
        return next();
    }

    jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }

        req.user = (user as RequestUser) ?? {};
        return next();
    });
};

/**
 * Developer JWT privileges only stick while the backdoor is still allowed.
 * Production requires ALLOW_DEVELOPER_BACKDOOR=true (same gate as login).
 */
function isDeveloperBackdoorCurrentlyAllowed(): boolean {
    if (isProductionEnv() && process.env.ALLOW_DEVELOPER_BACKDOOR !== "true") {
        return false;
    }
    return true;
}

function hasActiveDeveloperClaim(user: RequestUser | undefined): boolean {
    return Boolean(user?.isDeveloper && isDeveloperBackdoorCurrentlyAllowed());
}

/** Require user to be developer or in Administration team. Use after authenticateToken. */
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    if (hasActiveDeveloperClaim(req.user)) {
        return next();
    }

    if (!req.user?.memberId) {
        return res.status(403).json({ error: "Admin access required" });
    }

    const adminMembership = await prisma.teamMember.findFirst({
        where: {
            memberId: req.user.memberId,
            isActive: true,
            team: { name: ADMINISTRATION_TEAM_NAME },
        },
    });

    if (!adminMembership) {
        return res.status(403).json({ error: "Admin access required" });
    }

    return next();
};

/** Officers, Administration, or developers may edit public site content. */
const requireSiteContentEditor = (req: Request, res: Response, next: NextFunction): Response | void => {
    if (hasActiveDeveloperClaim(req.user) || req.user?.isOfficer || req.user?.isAdmin) {
        return next();
    }

    return res.status(403).json({ error: "Site content editor access required" });
};

/** Developers, officers, or administration may edit support page header and guidance blocks. */
const requireSupportPageEditor = (req: Request, res: Response, next: NextFunction): Response | void => {
    if (canEditSiteContent(req.user)) {
        return next();
    }

    return res.status(403).json({ error: "Support page editor access required" });
};

/** Developers, officers, administration, or HR head/vice may edit forms and submissions. */
const requireSupportFormsEditor = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<Response | void> => {
    if (canEditSupportForms(req.user)) {
        return next();
    }

    if (req.user?.memberId && await isHrHeadOrVice(req.user.memberId)) {
        return next();
    }

    return res.status(403).json({ error: "Support forms editor access required" });
};

/** Developers, officers, administration, or FR head/vice may view finance dashboard. */
const requireFinanceViewer = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<Response | void> => {
    if (canViewFinance(req.user)) {
        return next();
    }

    if (req.user?.memberId && await isFrHeadOrVice(req.user.memberId)) {
        return next();
    }

    return res.status(403).json({ error: "Finance viewer access required" });
};

/** Strict developer-only access (not officers/admins). Used for internal usage analytics. */
const requireDeveloperOnly = (
    req: Request,
    res: Response,
    next: NextFunction,
): Response | void => {
    if (hasActiveDeveloperClaim(req.user)) {
        return next();
    }
    return res.status(403).json({ error: "Developer access required" });
};

export {
    authenticateToken,
    optionalAuthenticateToken,
    requireAdmin,
    requireSiteContentEditor,
    requireSupportPageEditor,
    requireSupportFormsEditor,
    requireFinanceViewer,
    requireDeveloperOnly,
    JWT_SECRET,
    extractAuthToken,
};