import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface AdminProtectedRouteProps {
    children: ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.isDeveloper && !user.isOfficer && !user.isAdmin && !user.isLeadership) {
        return <Navigate to="/teams" replace />;
    }

    return <>{children}</>;
}
