import { describe, expect, it, afterEach, vi } from "vitest";
import {
    isCrossOriginApiUrl,
    isPortalBffEnabled,
    PORTAL_BACKEND_API_PREFIX,
    resolveApiBaseUrl,
    resolveBackendOriginForWebSocket,
    resolveDirectBackendApiUrl,
} from "../apiBaseUrl";

describe("isPortalBffEnabled", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("defaults to false (direct mode)", () => {
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", undefined);
        expect(isPortalBffEnabled()).toBe(false);
    });

    it("is true only when NEXT_PUBLIC_PORTAL_USE_BFF=true", () => {
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", "true");
        expect(isPortalBffEnabled()).toBe(true);
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", "1");
        expect(isPortalBffEnabled()).toBe(false);
    });
});

describe("resolveApiBaseUrl (default direct mode)", () => {
    const portalOrigin = "https://iclubmedasu-members-portal.hf.space";
    const backendApi = "https://iclubmedasu-backend.hf.space/api";

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("detects cross-origin API configuration", () => {
        expect(isCrossOriginApiUrl(backendApi, portalOrigin)).toBe(true);
        expect(isCrossOriginApiUrl(`${portalOrigin}/backend-api`, portalOrigin)).toBe(false);
        expect(isCrossOriginApiUrl("/backend-api", portalOrigin)).toBe(false);
    });

    it("keeps cross-origin HF API URL direct when BFF flag is off", () => {
        expect(
            resolveApiBaseUrl({
                configuredApiUrl: backendApi,
                pageOrigin: portalOrigin,
            }),
        ).toBe(backendApi);
    });

    it("remaps cross-origin HF API URL to /backend-api when BFF enabled", () => {
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", "true");
        expect(
            resolveApiBaseUrl({
                configuredApiUrl: backendApi,
                pageOrigin: portalOrigin,
            }),
        ).toBe(`${portalOrigin}${PORTAL_BACKEND_API_PREFIX}`);
    });

    it("keeps localhost API direct when page is localhost", () => {
        expect(
            resolveApiBaseUrl({
                configuredApiUrl: "http://localhost:3000/api",
                pageOrigin: "http://localhost:3001",
                pageHostname: "localhost",
            }),
        ).toBe("http://localhost:3000/api");
    });

    it("rewrites loopback API host for LAN mobile testing", () => {
        expect(
            resolveApiBaseUrl({
                configuredApiUrl: "http://localhost:3000/api",
                pageOrigin: "http://192.168.1.9:3001",
                pageHostname: "192.168.1.9",
            }),
        ).toBe("http://192.168.1.9:3000/api");
    });

    it("honors explicit /backend-api configuration", () => {
        expect(
            resolveApiBaseUrl({
                configuredApiUrl: "/backend-api",
                pageOrigin: portalOrigin,
            }),
        ).toBe(`${portalOrigin}${PORTAL_BACKEND_API_PREFIX}`);
    });

    it("defaults local without env to localhost:3000/api", () => {
        expect(
            resolveApiBaseUrl({
                pageOrigin: "http://localhost:3001",
            }),
        ).toBe("http://localhost:3000/api");
    });

    it("defaults production host without env to backend /api when BFF off", () => {
        expect(
            resolveApiBaseUrl({
                pageOrigin: portalOrigin,
            }),
        ).toBe("https://iclubmedasu-backend.hf.space/api");
    });

    it("defaults production host without env to BFF when flag enabled", () => {
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", "true");
        expect(
            resolveApiBaseUrl({
                pageOrigin: portalOrigin,
            }),
        ).toBe(`${portalOrigin}${PORTAL_BACKEND_API_PREFIX}`);
    });
});

describe("resolveDirectBackendApiUrl", () => {
    const portalOrigin = "https://iclubmedasu-members-portal.hf.space";
    const backendApi = "https://iclubmedasu-backend.hf.space/api";

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("matches browsing URL in default direct mode", () => {
        expect(
            resolveDirectBackendApiUrl({
                configuredApiUrl: backendApi,
                pageOrigin: portalOrigin,
            }),
        ).toBe(backendApi);
    });

    it("returns backend /api on HF when BFF browsing is enabled", () => {
        vi.stubEnv("NEXT_PUBLIC_PORTAL_USE_BFF", "true");
        expect(
            resolveDirectBackendApiUrl({
                configuredApiUrl: backendApi,
                pageOrigin: portalOrigin,
            }),
        ).toBe(backendApi);
    });

    it("uses NEXT_PUBLIC_BACKEND_ORIGIN when configured is /backend-api", () => {
        vi.stubEnv("NEXT_PUBLIC_BACKEND_ORIGIN", "https://iclubmedasu-backend.hf.space");
        expect(
            resolveDirectBackendApiUrl({
                configuredApiUrl: "/backend-api",
                pageOrigin: portalOrigin,
            }),
        ).toBe("https://iclubmedasu-backend.hf.space/api");
    });

    it("keeps localhost API unchanged (same as resolveApiBaseUrl)", () => {
        expect(
            resolveDirectBackendApiUrl({
                configuredApiUrl: "http://localhost:3000/api",
                pageOrigin: "http://localhost:3001",
                pageHostname: "localhost",
            }),
        ).toBe(
            resolveApiBaseUrl({
                configuredApiUrl: "http://localhost:3000/api",
                pageOrigin: "http://localhost:3001",
                pageHostname: "localhost",
            }),
        );
    });

    it("keeps LAN-rewritten API unchanged", () => {
        expect(
            resolveDirectBackendApiUrl({
                configuredApiUrl: "http://localhost:3000/api",
                pageOrigin: "http://192.168.1.9:3001",
                pageHostname: "192.168.1.9",
            }),
        ).toBe("http://192.168.1.9:3000/api");
    });
});

describe("resolveBackendOriginForWebSocket", () => {
    it("uses absolute backend host from configured API when cross-origin", () => {
        expect(
            resolveBackendOriginForWebSocket({
                pageOrigin: "https://iclubmedasu-members-portal.hf.space",
                configuredApiUrl: "https://iclubmedasu-backend.hf.space/api",
            }),
        ).toBe("https://iclubmedasu-backend.hf.space");
    });
});
