import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidSessionToken } from "@/lib/sessionToken";

const AUTH_COOKIE_NAME = "token";
/** Match backend web session TTL (7 days), in seconds for Next cookie maxAge. */
const WEB_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function sessionCookieOptions(maxAge: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge,
    };
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
