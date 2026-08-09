import { describe, expect, it } from "vitest";
import {
    isCrossOriginApiUrl,
    PORTAL_BACKEND_API_PREFIX,
    resolveApiBaseUrl,
    resolveBackendOriginForWebSocket,
} from "../apiBaseUrl";

describe("resolveApiBaseUrl (HF BFF proxy)", () => {
    const portalOrigin = "https://iclubmedasu-members-portal.hf.space";
    const backendApi = "https://iclubmedasu-backend.hf.space/api";

    it("detects cross-origin API configuration", () => {
        expect(isCrossOriginApiUrl(backendApi, portalOrigin)).toBe(true);
        expect(isCrossOriginApiUrl(`${portalOrigin}/backend-api`, portalOrigin)).toBe(false);
        expect(isCrossOriginApiUrl("/backend-api", portalOrigin)).toBe(false);
    });

    it("remaps cross-origin HF API URL to same-origin /backend-api", () => {
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
