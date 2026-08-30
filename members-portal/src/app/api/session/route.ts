import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "token";
/** Match backend web session TTL (7 days), in seconds for Next cookie maxAge. */
const WEB_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;
/** Reject absurdly large bodies pretending to be JWTs. */
const MAX_TOKEN_LENGTH = 4096;

function sessionCookieOptions(maxAge: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge,
    };
}

/** Accept only non-empty JWT-shaped strings (three non-empty segments). */
export function isValidSessionToken(token: unknown): token is string {
    if (typeof token !== "string") return false;
    const trimmed = token.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return false;
    const parts = trimmed.split(".");
    return parts.length === 3 && parts.every((part) => part.length > 0);
}

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const token =
        body && typeof body === "object" && "token" in body
            ? (body as { token: unknown }).token
            : undefined;

    if (!isValidSessionToken(token)) {
        return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token.trim(), sessionCookieOptions(WEB_COOKIE_MAX_AGE_SEC));

    return NextResponse.json({ ok: true });
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, "", sessionCookieOptions(0));

    return NextResponse.json({ ok: true });
}
