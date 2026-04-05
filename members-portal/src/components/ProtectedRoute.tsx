'use client';
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard/AuthGuard";
import "./ProtectedRoute.css";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    return <AuthGuard>{children}</AuthGuard>;
}
