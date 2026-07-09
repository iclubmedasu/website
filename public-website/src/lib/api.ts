import type {
    CreateEventRegistrationPayload,
    PublicAboutPage,
    PublicContactPage,
    PublicContactRequest,
    PublicContactResponse,
    PublicEventCustomField,
    PublicEventDetail,
    PublicEventListItem,
    PublicEventRegistrationFormConfig,
    PublicEventSession,
    PublicEventTier,
    PublicMemberDirectory,
    PublicMemberProfile,
    PublicProjectSummary,
    PublicProjectDetail,
    PublicRegistrationConfirmation,
    PublicSocialLink,
    PublicSupportPage,
    SubmitIncidentReportPayload,
} from "@iclub/shared";

function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function resolveApiBaseUrl(): string {
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (configuredApiUrl) {
        if (typeof window !== "undefined") {
            try {
                const parsed = new URL(configuredApiUrl);
                if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(window.location.hostname)) {
                    parsed.hostname = window.location.hostname;
                    return parsed.toString();
                }
            } catch {
                // Keep configured value when it's not an absolute URL.
            }
        }

        return configuredApiUrl;
    }

    if (process.env.NODE_ENV === "production") {
        console.error(
            "NEXT_PUBLIC_API_URL is not set. Public pages will fail to load data. "
            + "Set it in the Hugging Face Space → Settings → Variables "
            + "(e.g. https://iclubmedasu-backend.hf.space/api) and rebuild the Space.",
        );
    }

    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:3000/api`;
    }

    return "http://localhost:3000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

if (process.env.NODE_ENV === "production") {
    console.info(`[public-website] API_BASE_URL=${API_BASE_URL}`);
}

export type PublicFetchStatus = "ok" | "not_found" | "unavailable";

export type PublicFetchResult<T> =
    | { status: "ok"; data: T }
    | { status: "not_found" }
    | { status: "unavailable" };

const RETRY_DELAYS_MS = [2000, 4000];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function fetchWithRetry(
    url: string,
    init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
    let lastError: unknown;
    const attempts = RETRY_DELAYS_MS.length + 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(url, init);
            if (response.status === 503 && attempt < attempts - 1) {
                await sleep(RETRY_DELAYS_MS[attempt]);
                continue;
            }
            return response;
        } catch (error) {
            lastError = error;
            if (attempt < attempts - 1) {
                await sleep(RETRY_DELAYS_MS[attempt]);
                continue;
            }
            throw error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Fetch failed after retries");
}

export function getPublicProfilePhotoUrl(memberId: number | string | null | undefined): string | null {
    if (!memberId) return null;
    return `${API_BASE_URL}/members/${memberId}/profile-photo`;
}

export class ApiRequestError extends Error {
    fieldErrors?: Record<string, string>;

    constructor(message: string, fieldErrors?: Record<string, string>) {
        super(message);
        this.name = "ApiRequestError";
        this.fieldErrors = fieldErrors;
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = (await response.json().catch(() => ({ error: "An error occurred" }))) as {
            error?: string;
            fieldErrors?: Record<string, string>;
        };
        throw new ApiRequestError(error.error || `HTTP error! status: ${response.status}`, error.fieldErrors);
    }

    return (await response.json()) as T;
}

async function fetchPublic<T>(path: string, fallback: T): Promise<T> {
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
            next: { revalidate: 60 },
        });
        return await handleResponse<T>(response);
    } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
        return fallback;
    }
}

async function fetchPublicOrThrow<T>(path: string): Promise<T | null> {
    const result = await fetchPublicDetail<T>(path);
    if (result.status === "ok") {
        return result.data;
    }
    return null;
}

async function fetchPublicDetail<T>(path: string): Promise<PublicFetchResult<T>> {
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
            next: { revalidate: 60 },
        });
        if (response.status === 404) {
            return { status: "not_found" };
        }
        if (response.status === 503) {
            console.error(`Failed to fetch ${path}: backend unavailable (503 after retries)`);
            return { status: "unavailable" };
        }
        const data = await handleResponse<T>(response);
        return { status: "ok", data };
    } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
        return { status: "unavailable" };
    }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : "";
}

export const publicAPI = {
    async getPublishedEvents(options?: { limit?: number }): Promise<PublicEventListItem[]> {
        const query = buildQuery({
            limit: options?.limit ?? 50,
            upcoming: false,
        });
        return fetchPublic<PublicEventListItem[]>(`/public/events${query}`, []);
    },

    async getEvents(options?: { limit?: number; upcoming?: boolean }): Promise<PublicEventListItem[]> {
        const query = buildQuery({
            limit: options?.limit,
            upcoming: options?.upcoming ?? true,
        });
        return fetchPublic<PublicEventListItem[]>(`/public/events${query}`, []);
    },

    async getRegisterableEvents(options?: { limit?: number }): Promise<PublicEventListItem[]> {
        const query = buildQuery({
            limit: options?.limit,
            registerable: true,
            upcoming: true,
        });
        return fetchPublic<PublicEventListItem[]>(`/public/events${query}`, []);
    },

    async getPastEvents(options?: { limit?: number }): Promise<PublicEventListItem[]> {
        const query = buildQuery({
            limit: options?.limit ?? 50,
            past: true,
        });
        return fetchPublic<PublicEventListItem[]>(`/public/events${query}`, []);
    },

    async getEvent(id: number): Promise<PublicEventDetail | null> {
        const result = await this.getEventWithStatus(id);
        return result.status === "ok" ? result.data : null;
    },

    async getEventWithStatus(id: number): Promise<PublicFetchResult<PublicEventDetail>> {
        return fetchPublicDetail<PublicEventDetail>(`/public/events/${id}`);
    },

    async getEventTiers(id: number): Promise<PublicEventTier[]> {
        return fetchPublic<PublicEventTier[]>(`/public/events/${id}/tiers`, []);
    },

    async getEventCustomFields(id: number): Promise<PublicEventCustomField[]> {
        return fetchPublic<PublicEventCustomField[]>(`/public/events/${id}/custom-fields`, []);
    },

    async getEventSessions(id: number): Promise<PublicEventSession[]> {
        return fetchPublic<PublicEventSession[]>(`/public/events/${id}/sessions`, []);
    },

    async getEventRegistrationForm(id: number): Promise<PublicEventRegistrationFormConfig> {
        const result = await fetchPublicOrThrow<PublicEventRegistrationFormConfig>(`/public/events/${id}/registration-form`);
        return result ?? {
            tierFieldShowOnPublic: true,
            tierFieldRequired: true,
            sessionFieldShowOnPublic: false,
            sessionFieldRequired: false,
        };
    },

    async getRegistrationConfirmation(
        eventId: number,
        code: string,
    ): Promise<PublicRegistrationConfirmation | null> {
        const query = buildQuery({ code });
        return fetchPublicOrThrow<PublicRegistrationConfirmation>(`/public/events/${eventId}/confirmation${query}`);
    },

    async getPublishedProjects(options?: { limit?: number }): Promise<PublicProjectSummary[]> {
        const query = buildQuery({ limit: options?.limit ?? 50 });
        return fetchPublic<PublicProjectSummary[]>(`/public/projects${query}`, []);
    },

    async getProjects(options?: { limit?: number }): Promise<PublicProjectSummary[]> {
        const query = buildQuery({ limit: options?.limit });
        return fetchPublic<PublicProjectSummary[]>(`/public/projects${query}`, []);
    },

    async getProject(id: number): Promise<PublicProjectDetail | null> {
        return fetchPublicOrThrow<PublicProjectDetail>(`/public/projects/${id}`);
    },

    async getMembersDirectory(): Promise<PublicMemberDirectory> {
        const fallback: PublicMemberDirectory = {
            officer: null,
            president: null,
            vicePresident: null,
            teamLeadership: [],
            filterTeams: [],
            members: [],
        };
        const data = await fetchPublic<Partial<PublicMemberDirectory>>("/public/members/directory", fallback);
        return {
            officer: data.officer ?? null,
            president: data.president ?? null,
            vicePresident: data.vicePresident ?? null,
            teamLeadership: data.teamLeadership ?? [],
            filterTeams: data.filterTeams ?? [],
            members: data.members ?? [],
        };
    },

    async getMemberProfile(id: number): Promise<PublicMemberProfile | null> {
        return fetchPublicOrThrow<PublicMemberProfile>(`/public/members/${id}/profile`);
    },

    async getAboutPage(): Promise<PublicAboutPage | null> {
        return fetchPublicOrThrow<PublicAboutPage>("/public/site/about");
    },

    async getContactPage(): Promise<PublicContactPage | null> {
        return fetchPublicOrThrow<PublicContactPage>("/public/site/contact");
    },

    async getSocialLinks(): Promise<PublicSocialLink[]> {
        return fetchPublic<PublicSocialLink[]>("/public/site/social-links", []);
    },

    async getSupportPage(): Promise<PublicSupportPage | null> {
        return fetchPublicOrThrow<PublicSupportPage>("/public/site/support");
    },

    async submitIncidentReport(payload: SubmitIncidentReportPayload): Promise<{ id: number }> {
        const response = await fetch(`${API_BASE_URL}/public/support/incident-reports`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return handleResponse<{ id: number }>(response);
    },

    async sendContact(payload: PublicContactRequest): Promise<PublicContactResponse> {
        const response = await fetch(`${API_BASE_URL}/public/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return handleResponse<PublicContactResponse>(response);
    },

    async registerForEvent(
        eventId: number,
        payload: CreateEventRegistrationPayload,
    ): Promise<{ confirmationCode: string }> {
        const response = await fetch(`${API_BASE_URL}/events/${eventId}/registrations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await handleResponse<{ confirmationCode: string }>(response);
        return data;
    },
};
