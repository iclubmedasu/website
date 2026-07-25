import type {
    CreateEventRegistrationPayload,
    PublicAboutPage,
    PublicContactPage,
    PublicContactRequest,
    PublicContactResponse,
    PublicEventCustomField,
    PublicEventDetail,
    PublicEventListItem,
    PublicEventPhoto,
    PublicHighlightPhoto,
    PublicEventRegistrationFormConfig,
    PublicEventSession,
    PublicEventTier,
    PublicMemberDirectory,
    PublicMemberProfile,
    PublicProjectSummary,
    PublicProjectDetail,
    PublicEventJoinResponse,
    PublicRegistrationConfirmation,
    PublicSocialLink,
    PublicSupportPage,
    SubmitIncidentReportPayload,
} from "@iclub/shared";

function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Resolve API base URL at call time (browser-safe; trims HF variable whitespace). */
export function getApiBaseUrl(): string {
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

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

/** @deprecated Use getApiBaseUrl — kept for existing imports */
export const resolveApiBaseUrl = getApiBaseUrl;

export function getPublicProfilePhotoUrl(memberId: number | string | null | undefined): string | null {
    if (!memberId) return null;
    return `${getApiBaseUrl()}/members/${memberId}/profile-photo`;
}

/**
 * Resolve a public event photo download URL against the API base.
 * `downloadUrl` from the API is `/api/public/...`; `getApiBaseUrl()` already ends with `/api`.
 */
export function getPublicEventPhotoUrl(downloadUrl: string | null | undefined): string | null {
    if (!downloadUrl) return null;
    const path = downloadUrl.startsWith("/api/")
        ? downloadUrl.slice(4)
        : downloadUrl.startsWith("/")
          ? downloadUrl
          : `/${downloadUrl}`;
    return `${getApiBaseUrl()}${path}`;
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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${getApiBaseUrl()}${path}`, {
        cache: "no-store",
        ...init,
    });
}

async function fetchPublic<T>(path: string, fallback: T): Promise<T> {
    try {
        const response = await apiFetch(path);
        return await handleResponse<T>(response);
    } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
        return fallback;
    }
}

/** Soft-fail fetch with no console noise (used for optional home Highlights). */
async function fetchPublicSilent<T>(path: string, fallback: T, retries = 1): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await apiFetch(path);
            if (!response.ok) {
                if (attempt < retries) continue;
                return fallback;
            }
            return (await response.json()) as T;
        } catch {
            if (attempt < retries) continue;
            return fallback;
        }
    }
    return fallback;
}

async function fetchPublicOrThrow<T>(path: string): Promise<T | null> {
    try {
        const response = await apiFetch(path);
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

export type PublicCertificateBackgroundFocus = {
    scale: number;
    offsetX: number;
    offsetY: number;
};

/** Public-safe template fields returned with verify JSON when the cert has a template. */
export type PublicCertificateTemplate = {
    canvasWidth: number;
    canvasHeight: number;
    layout: unknown;
    backgroundFocus: PublicCertificateBackgroundFocus | null;
    hasBackground: boolean;
};

export type PublicCertificateVerify = {
    id: number;
    verificationCode: string;
    recipientName: string;
    title: string;
    description: string;
    type: string;
    issuedAt: string | null;
    fieldValues?: Record<string, unknown> | null;
    templateId?: number | null;
    template?: PublicCertificateTemplate | null;
    event?: { id: number; title: string } | null;
    project?: { id: number; title: string } | null;
};

export type PublicMemberCertificate = {
    id: number;
    title: string;
    description: string;
    type: string;
    issuedAt: string | null;
    verificationCode: string;
    event?: { id: number; title: string } | null;
    project?: { id: number; title: string } | null;
};

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

    async getEvent(idOrSlug: number | string): Promise<PublicEventDetail | null> {
        return fetchPublicOrThrow<PublicEventDetail>(`/public/events/${idOrSlug}`);
    },

    async getEventPhotos(idOrSlug: number | string): Promise<PublicEventPhoto[]> {
        return fetchPublic<PublicEventPhoto[]>(`/public/events/${idOrSlug}/photos`, []);
    },

    async getHighlightPhotos(): Promise<PublicHighlightPhoto[]> {
        return fetchPublicSilent<PublicHighlightPhoto[]>("/public/highlights/photos", [], 1);
    },

    async getEventTiers(idOrSlug: number | string): Promise<PublicEventTier[]> {
        return fetchPublic<PublicEventTier[]>(`/public/events/${idOrSlug}/tiers`, []);
    },

    async getEventCustomFields(idOrSlug: number | string): Promise<PublicEventCustomField[]> {
        return fetchPublic<PublicEventCustomField[]>(`/public/events/${idOrSlug}/custom-fields`, []);
    },

    async getEventSessions(idOrSlug: number | string): Promise<PublicEventSession[]> {
        return fetchPublic<PublicEventSession[]>(`/public/events/${idOrSlug}/sessions`, []);
    },

    async getEventRegistrationForm(idOrSlug: number | string): Promise<PublicEventRegistrationFormConfig> {
        const result = await fetchPublicOrThrow<PublicEventRegistrationFormConfig>(`/public/events/${idOrSlug}/registration-form`);
        return result ?? {
            tierFieldShowOnPublic: true,
            tierFieldRequired: true,
            sessionFieldShowOnPublic: false,
            sessionFieldRequired: false,
            phoneFieldRequired: false,
        };
    },

    async getRegistrationConfirmation(
        eventIdOrSlug: number | string,
        code: string,
    ): Promise<PublicRegistrationConfirmation | null> {
        const query = buildQuery({ code });
        return fetchPublicOrThrow<PublicRegistrationConfirmation>(`/public/events/${eventIdOrSlug}/confirmation${query}`);
    },

    async joinEventSession(eventIdOrSlug: number | string, token: string): Promise<PublicEventJoinResponse> {
        try {
            const query = buildQuery({ token });
            const response = await apiFetch(`/events/${eventIdOrSlug}/join${query}`, {
                headers: { Accept: "application/json" },
            });
            const body = (await response.json().catch(() => null)) as PublicEventJoinResponse | null;
            if (body && typeof body.status === "string") {
                return body;
            }
            return {
                status: "error",
                message: "Something went wrong while opening this session. Please try again.",
            };
        } catch (error) {
            console.error(`Failed to join event ${eventIdOrSlug}:`, error);
            return {
                status: "error",
                message: "Something went wrong while opening this session. Please try again.",
            };
        }
    },

    async getPublishedProjects(options?: { limit?: number }): Promise<PublicProjectSummary[]> {
        const query = buildQuery({ limit: options?.limit ?? 50 });
        return fetchPublic<PublicProjectSummary[]>(`/public/projects${query}`, []);
    },

    async getProjects(options?: { limit?: number }): Promise<PublicProjectSummary[]> {
        const query = buildQuery({ limit: options?.limit });
        return fetchPublic<PublicProjectSummary[]>(`/public/projects${query}`, []);
    },

    async getProject(idOrSlug: number | string): Promise<PublicProjectDetail | null> {
        return fetchPublicOrThrow<PublicProjectDetail>(`/public/projects/${idOrSlug}`);
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

    async getCertificate(code: string): Promise<PublicCertificateVerify | null> {
        return fetchPublicOrThrow<PublicCertificateVerify>(
            `/certificates/verify/${encodeURIComponent(code)}`,
        );
    },

    /** URL for the certificate template background (public, keyed by verification code). */
    getCertificateBackgroundUrl(code: string): string {
        return `${getApiBaseUrl()}/certificates/verify/${encodeURIComponent(code)}/background`;
    },


    async getMemberCertificates(memberId: number): Promise<PublicMemberCertificate[]> {
        const query = buildQuery({
            recipientMemberId: memberId,
            status: "ISSUED",
        });
        return fetchPublic<PublicMemberCertificate[]>(`/certificates${query}`, []);
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
        const response = await apiFetch("/public/support/incident-reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return handleResponse<{ id: number }>(response);
    },

    async sendContact(payload: PublicContactRequest): Promise<PublicContactResponse> {
        const response = await apiFetch("/public/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return handleResponse<PublicContactResponse>(response);
    },

    async registerForEvent(
        eventIdOrSlug: number | string,
        payload: CreateEventRegistrationPayload,
    ): Promise<{ confirmationCode: string }> {
        const response = await apiFetch(`/events/${eventIdOrSlug}/registrations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return handleResponse<{ confirmationCode: string }>(response);
    },
};
