'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
    ApiErrorResponse,
    AuthMeResponse,
    AuthUser,
    CheckEmailResponse,
    CheckStudentIdResponse,
} from "../types/backend-contracts";

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
    login: (email: string, password: string) => Promise<Result>;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

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

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAlumni, setIsAlumni] = useState(false);

    useEffect(() => {
        void checkAuth();
    }, []);

    const checkAuth = async (): Promise<void> => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                credentials: "include",
            });

            if (response.ok) {
                const data = (await response.json()) as AuthMeResponse;
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
            } else {
                setIsAlumni(false);
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
            setIsAlumni(false);
        } finally {
            setLoading(false);
        }
    };

    const refreshUser = async (): Promise<void> => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                credentials: "include",
            });

            if (response.ok) {
                const data = (await response.json()) as AuthMeResponse;
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
            console.error("Refresh user failed:", error);
        }
    };

    const checkEmail = async (email: string): Promise<Result<CheckEmailResponse>> => {
        try {
            const response = await fetch(`${API_URL}/auth/check-email`, {
                method: "POST",
                credentials: "include",
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
                credentials: "include",
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
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    studentId: String(studentId).trim(),
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    phoneNumber2: phoneNumber2?.trim() || undefined,
                    password,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined,
                }),
            });

            const data = (await response.json()) as { user: AuthUser } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to complete profile"));
            }

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
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    identifier: identifier.trim(),
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    phoneNumber2: phoneNumber2?.trim() || undefined,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined,
                    officerEmail: officerEmail?.trim() || undefined,
                    password,
                    confirmPassword,
                }),
            });

            const data = (await response.json()) as { user: AuthUser } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Failed to complete officer profile"));
            }

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
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.trim(),
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    phoneNumber2: phoneNumber2?.trim() || undefined,
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
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = (await response.json()) as { user: AuthUser } & ApiErrorResponse;
            if (!response.ok) {
                throw new Error(readApiError(data, "Setup failed"));
            }

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

    const login = async (email: string, password: string): Promise<Result> => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = (await response.json()) as { user: AuthUser } & ApiErrorResponse;
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
            credentials: "include",
        }).catch((error) => {
            console.error("Logout request failed:", error);
        });
        setUser(null);
        setIsAlumni(false);
    };

    const value: AuthContextValue = {
        user,
        loading,
        isAlumni,
        login,
        setupPassword,
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
