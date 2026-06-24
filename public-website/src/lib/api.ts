import type {
    CreateEventRegistrationPayload,
    PublicContactRequest,
    PublicContactResponse,
    PublicEventCustomField,
    PublicEventDetail,
    PublicEventListItem,
    PublicEventTier,
    PublicProjectSummary,
    PublicProjectDetail,
    PublicRegistrationConfirmation,
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

    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:3000/api`;
    }

    return "http://localhost:3000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

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
        const response = await fetch(`${API_BASE_URL}${path}`, {
            next: { revalidate: 60 },
        });
        return await handleResponse<T>(response);
    } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
        return fallback;
    }
}

async function fetchPublicOrThrow<T>(path: string): Promise<T | null> {
    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            next: { revalidate: 60 },
        });
        if (response.status === 404) {
            return null;
        }
        return await handleResponse<T>(response);
    } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
        return null;
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
            limit: options?.limit,
            past: true,
        });
        return fetchPublic<PublicEventListItem[]>(`/public/events${query}`, []);
    },

    async getEvent(id: number): Promise<PublicEventDetail | null> {
        return fetchPublicOrThrow<PublicEventDetail>(`/public/events/${id}`);
    },

    async getEventTiers(id: number): Promise<PublicEventTier[]> {
        return fetchPublic<PublicEventTier[]>(`/public/events/${id}/tiers`, []);
    },

    async getEventCustomFields(id: number): Promise<PublicEventCustomField[]> {
        return fetchPublic<PublicEventCustomField[]>(`/public/events/${id}/custom-fields`, []);
    },

    async getRegistrationConfirmation(
        eventId: number,
        code: string,
    ): Promise<PublicRegistrationConfirmation | null> {
        const query = buildQuery({ code });
        return fetchPublicOrThrow<PublicRegistrationConfirmation>(`/public/events/${eventId}/confirmation${query}`);
    },

    async getProjects(options?: { limit?: number }): Promise<PublicProjectSummary[]> {
        const query = buildQuery({ limit: options?.limit });
        return fetchPublic<PublicProjectSummary[]>(`/public/projects${query}`, []);
    },

    async getProject(id: number): Promise<PublicProjectDetail | null> {
        return fetchPublicOrThrow<PublicProjectDetail>(`/public/projects/${id}`);
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
