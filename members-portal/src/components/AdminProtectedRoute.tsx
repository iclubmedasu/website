'use client';
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard/AuthGuard";
import { AdminGuard } from "@/components/AuthGuard/AdminGuard";

interface AdminProtectedRouteProps {
    children: ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    return (
        <AuthGuard>
            <AdminGuard>{children}</AdminGuard>
        </AuthGuard>
    );
}
