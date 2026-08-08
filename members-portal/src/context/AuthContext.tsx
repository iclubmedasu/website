'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setToken, clearToken as clearTokenUtil, initToken, shouldSendCredentials } from '../services/api';
import { apiFetch } from '../services/api';
import type {
    ApiErrorResponse,
    AuthMeResponse,
    AuthUser,
    CheckEmailResponse,
    CheckStudentIdResponse,
    ForgotPasswordInput,
    ForgotPasswordResponse,
    ResetPasswordInput,
    ResetPasswordResponse,
} from "../types/backend-contracts";
import { sanitizePhoneForStorage } from "@/utils/countryCodes";
import { getClientSurface } from "@/lib/standalonePwa";

type AlumniCode = "ALUMNI_ACCESS";

type SuccessResult<T = void> = T extends void
    ? { success: true }
    : { success: true; data: T };

type FailureResult<T = void> = T extends void
    ? { success: false; error: string; code?: AlumniCode }
    : { success: false; error: string; code?: AlumniCode; data: T };

type Result<T = void> = SuccessResult<T> | FailureResult<T>;

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    isAlumni: boolean;
    checkEmail: (email: string) => Promise<Result<CheckEmailResponse>>;
    checkStudentId: (studentId: string | number) => Promise<Result<CheckStudentIdResponse>>;
    completeProfile: (
        studentId: string | number,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        password?: string,
        email2?: string,
        email3?: string,
    ) => Promise<Result>;
    completeOfficerProfile: (
        identifier: string,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        email2?: string,
        email3?: string,
        password?: string,
        confirmPassword?: string,
        officerEmail?: string,
    ) => Promise<Result>;
    updateInvitedProfile: (
        email: string,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        email2?: string,
        email3?: string,
    ) => Promise<Result>;
    setupPassword: (email: string, password: string) => Promise<Result>;
    forgotPassword: (email: string) => Promise<Result<Pick<ForgotPasswordResponse, "message">>>;
    resetPassword: (
        token: string,
        password: string,
        confirmPassword: string,
    ) => Promise<Result<Pick<ResetPasswordResponse, "message">>>;
    login: (email: string, password: string) => Promise<Result>;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function resolveApiUrl(): string {
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

const API_URL = resolveApiUrl();

const NO_SETUP: CheckStudentIdResponse = { canSetup: false };

function toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function readApiError(input: unknown, fallback: string): string {
    if (input && typeof input === "object" && "error" in input) {
        const value = (input as ApiErrorResponse).error;
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }

    return fallback;
}

function isAlumniAccess(input: unknown): input is { code: "ALUMNI_ACCESS"; error?: string } {
    return !!input && typeof input === "object" && (input as { code?: string }).code === "ALUMNI_ACCESS";
}

function authClientHeaders(): Record<string, string> {
    const surface = getClientSurface();
    return {
        "Content-Type": "application/json",
        "X-Client-Surface": surface,
    };
}

function withClientSurface<T extends Record<string, unknown>>(body: T): T & { clientSurface: "pwa" | "web" } {
    return { ...body, clientSurface: getClientSurface() };
}

function applyMeResponse(data: AuthMeResponse): void {
    if (typeof data.token === "string" && data.token.length > 0) {
        setToken(data.token);
    }
}

function isNetworkFetchError(error: unknown): boolean {
    return (
        error instanceof TypeError &&
        (error.message === "Failed to fetch" || error.message.includes("NetworkError") || error.message.includes("fetch"))
    );
}

function logAuthNetworkOrError(label: string, error: unknown): void {
    if (isNetworkFetchError(error)) {
        console.error(`${label}: Backend unreachable at ${API_URL}`);
        return;
    }
    console.error(`${label}:`, error);
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAlumni, setIsAlumni] = useState(false);

    useEffect(() => {
        // PWA: rehydrate bearer from localStorage. Web: no localStorage token —
        // still hit /auth/me so the httpOnly cookie can restore the session.
        initToken();
        void checkAuth();
    }, []);

    const checkAuth = async (): Promise<void> => {
        try {
            const response = await apiFetch(`${API_URL}/auth/me`);

            if (response.ok) {
                const data = (await response.json()) as AuthMeResponse;
                applyMeResponse(data);
                setUser(data.user);
                setIsAlumni(false);
            } else if (response.status === 403) {
                const data = (await response.json().catch(() => ({}))) as unknown;
                if (isAlumniAccess(data)) {
                    setIsAlumni(true);
                    setUser(null);
                } else {
                    setIsAlumni(false);
                    setUser(null);
                }
            } else if (response.status === 401) {
                clearTokenUtil();
                setIsAlumni(false);
                setUser(null);
            } else {
                setIsAlumni(false);
                setUser(null);
            }
        } catch (error) {
            logAuthNetworkOrError("Auth check failed", error);
            setUser(null);
            setIsAlumni(false);
        } finally {
            setLoading(false);
        }
    };

    const refreshUser = async (): Promise<void> => {
        try {
            const response = await apiFetch(`${API_URL}/auth/me`);

            if (response.ok) {
                const data = (await response.json()) as AuthMeResponse;
                applyMeResponse(data);
                setUser(data.user);
                setIsAlumni(false);
            } else if (response.status === 403) {
                const data = (await response.json().catch(() => ({}))) as unknown;
                if (isAlumniAccess(data)) {
                    setIsAlumni(true);
                    setUser(null);
                }
            }
        } catch (error) {
            logAuthNetworkOrError("Refresh user failed", error);
        }
    };

    const checkEmail = async (email: string): Promise<Result<CheckEmailResponse>> => {
        try {
            const response = await fetch(`${API_URL}/auth/check-email`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email }),
            });

            const data = (await response.json()) as CheckEmailResponse;
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to check identifier"),
                data: { exists: false, needsSetup: false },
            };
        }
    };

    const checkStudentId = async (studentId: string | number): Promise<Result<CheckStudentIdResponse>> => {
        try {
            const response = await fetch(`${API_URL}/auth/check-student-id`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ studentId: String(studentId).trim() }),
            });

            const data = (await response.json()) as CheckStudentIdResponse & ApiErrorResponse;
            if (!response.ok) {
                return {
                    success: false,
                    data: NO_SETUP,
                    error: readApiError(data, "Failed to check Student ID"),
                };
            }

            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                data: NO_SETUP,
                error: toErrorMessage(error, "Failed to check Student ID"),
            };
        }
    };

    const completeProfile = async (
        studentId: string | number,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        password?: string,
        email2?: string,
        email3?: string,
    ): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/complete-profile`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: authClientHeaders(),
                body: JSON.stringify(withClientSurface({
                    studentId: String(studentId).trim(),
                    fullName: fullName.trim(),
                    phoneNumber: sanitizePhoneForStorage(phoneNumber),
                    phoneNumber2: phoneNumber2?.trim() ? sanitizePhoneForStorage(phoneNumber2) : undefined,
                    password,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined,
                })),
            });

            const data = (await response.json()) as { user: AuthUser, token?: string } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to complete profile"));
            }
            if (data.token) setToken(data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to complete profile"),
            };
        }
    };

    const completeOfficerProfile = async (
        identifier: string,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        email2?: string,
        email3?: string,
        password?: string,
        confirmPassword?: string,
        officerEmail?: string,
    ): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/complete-officer-profile`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: authClientHeaders(),
                body: JSON.stringify(withClientSurface({
                    identifier: identifier.trim(),
                    fullName: fullName.trim(),
                    phoneNumber: sanitizePhoneForStorage(phoneNumber),
                    phoneNumber2: phoneNumber2?.trim() ? sanitizePhoneForStorage(phoneNumber2) : undefined,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined,
                    officerEmail: officerEmail?.trim() || undefined,
                    password,
                    confirmPassword,
                })),
            });

            const data = (await response.json()) as { user: AuthUser, token?: string } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to complete officer profile"));
            }
            if (data.token) setToken(data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to complete officer profile"),
            };
        }
    };

    const updateInvitedProfile = async (
        email: string,
        fullName: string,
        phoneNumber: string,
        phoneNumber2?: string,
        email2?: string,
        email3?: string,
    ): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/update-invited-profile`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.trim(),
                    fullName: fullName.trim(),
                    phoneNumber: sanitizePhoneForStorage(phoneNumber),
                    phoneNumber2: phoneNumber2?.trim() ? sanitizePhoneForStorage(phoneNumber2) : undefined,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined,
                }),
            });

            const data = (await response.json()) as ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to update profile"));
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to update profile"),
            };
        }
    };

    const setupPassword = async (email: string, password: string): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/setup-password`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: authClientHeaders(),
                body: JSON.stringify(withClientSurface({ email, password })),
            });

            const data = (await response.json()) as { user: AuthUser, token?: string } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Setup failed"));
            }
            if (data.token) setToken(data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Setup failed"),
            };
        }
    };

    const forgotPassword = async (
        email: string,
    ): Promise<Result<Pick<ForgotPasswordResponse, "message">>> => {
        try {
            const body: ForgotPasswordInput = { email: email.trim() };
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const data = (await response.json()) as ForgotPasswordResponse & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to send reset email"));
            }

            return {
                success: true,
                data: { message: data.message },
            };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to send reset email"),
                data: { message: "" },
            };
        }
    };

    const resetPassword = async (
        token: string,
        password: string,
        confirmPassword: string,
    ): Promise<Result<Pick<ResetPasswordResponse, "message">>> => {
        try {
            const body: ResetPasswordInput = { token, password, confirmPassword };
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const data = (await response.json()) as ResetPasswordResponse & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to reset password"));
            }

            return {
                success: true,
                data: { message: data.message },
            };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Failed to reset password"),
                data: { message: "" },
            };
        }
    };

    const login = async (email: string, password: string): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                credentials: shouldSendCredentials() ? "include" : "omit",
                headers: authClientHeaders(),
                body: JSON.stringify(withClientSurface({ email, password })),
            });

            const data = (await response.json()) as { user: AuthUser, token?: string } & ApiErrorResponse;
            if (!response.ok) {
                if (response.status === 403 && isAlumniAccess(data)) {
                    setIsAlumni(true);
                    return {
                        success: false,
                        error: readApiError(data, "Access denied"),
                        code: "ALUMNI_ACCESS",
                    };
                }

                throw new Error(readApiError(data, "Login failed"));
            }
            if (data.token) setToken(data.token);
            setUser(data.user);
            setIsAlumni(false);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error, "Login failed"),
            };
        }
    };

    const logout = (): void => {
        void fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            credentials: shouldSendCredentials() ? "include" : "omit",
        }).catch((error) => {
            console.error("Logout request failed:", error);
        });
        clearTokenUtil();
        setUser(null);
        setIsAlumni(false);
    };

    const value: AuthContextValue = {
        user,
        loading,
        isAlumni,
        login,
        setupPassword,
        forgotPassword,
        resetPassword,
        updateInvitedProfile,
        checkEmail,
        checkStudentId,
        completeProfile,
        completeOfficerProfile,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return context;
}
