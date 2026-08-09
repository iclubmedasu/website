import type { NextRequest } from "next/server";

/**
 * Same-origin BFF proxy: browser → /backend-api/* → backend /api/*
 * Avoids Hugging Face Spaces OPTIONS preflight that strips
 * Access-Control-Allow-Credentials (breaks credentialed login CORS).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
]);

function backendOrigin(): string {
    const raw =
        process.env.BACKEND_API_URL?.trim() ||
        "https://iclubmedasu-backend.hf.space";
    return raw.replace(/\/$/, "");
}

function resolveUpstream(pathSegments: string[], search: string): string {
    const path = pathSegments.map(encodeURIComponent).join("/");
    return `${backendOrigin()}/api/${path}${search}`;
}

async function proxyRequest(
    request: NextRequest,
    pathSegments: string[],
): Promise<Response> {
    if (request.method === "OPTIONS") {
        // Same-origin calls never need CORS; answer preflight locally if any.
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Methods":
                    "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers":
                    request.headers.get("access-control-request-headers") ||
                    "Content-Type, Authorization, X-Client-Surface, X-Client-Instance-Id",
                "Access-Control-Max-Age": "600",
            },
        });
    }

    const upstreamUrl = resolveUpstream(pathSegments, request.nextUrl.search);
    const headers = new Headers();
    request.headers.forEach((value, key) => {
        if (HOP_BY_HOP.has(key.toLowerCase())) return;
        headers.set(key, value);
    });

    const init: RequestInit = {
        method: request.method,
        headers,
        redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        const body = await request.arrayBuffer();
        if (body.byteLength > 0) {
            init.body = body;
        }
    }

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, init);
    } catch (error) {
        console.error("backend-api proxy fetch failed:", upstreamUrl, error);
        return Response.json(
            { error: "Upstream API unreachable" },
            { status: 502 },
        );
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP.has(lower)) return;
        // Node fetch may join multiple Set-Cookie values incorrectly if we use forEach;
        // re-apply via getSetCookie when available.
        if (lower === "set-cookie") return;
        responseHeaders.set(key, value);
    });

    const setCookies =
        typeof upstream.headers.getSetCookie === "function"
            ? upstream.headers.getSetCookie()
            : [];
    if (setCookies.length > 0) {
        for (const cookie of setCookies) {
            responseHeaders.append("set-cookie", cookie);
        }
    } else {
        const single = upstream.headers.get("set-cookie");
        if (single) responseHeaders.append("set-cookie", single);
    }

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    if (!path?.length) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }
    return proxyRequest(request, path);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
