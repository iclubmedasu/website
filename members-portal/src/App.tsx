import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdministrationPage from "./pages/Personnel/Administration/AdministrationPage";
import ProjectsPage from "./pages/Projects/ProjectsPage";
import PastProjectsPage from "./pages/Projects/PastProjectsPage";
import TeamsPage from "./pages/Personnel/Teams/TeamsPage";
import MembersPage from "./pages/Personnel/Members/MembersPage";
import AlumniPage from "./pages/Personnel/Alumni/AlumniPage";
import HelpAndSupportPage from "./pages/HelpAndSupport/HelpAndSupportPage";
import UserPage from "./pages/User/UserPage";
import ProtectedRoute from "./components/ProtectedRoute";
import UnassignedGate from "./components/UnassignedGate/UnassignedGate";
import AlumniGate from "./components/AlumniGate/AlumniGate";
import { SidebarNavigationSlim } from "./pages/SideBarNavigationSlim";
import {
    BarChartSquare02,
    LifeBuoy01,
    Settings01,
    User01,
    Users01,
} from "@untitledui/icons";
import {
    FolderCheck,
    FolderKanban,
    FolderOpen,
    GraduationCap,
    Shield,
    UsersRound,
} from "lucide-react";
import "./app.css";

function AppLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: BarChartSquare02,
        },
        {
            label: "Projects",
            icon: FolderKanban,
            items: [
                {
                    label: "Ongoing Projects",
                    href: "/projects",
                    icon: FolderOpen,
                },
                {
                    label: "Past Projects",
                    href: "/past-projects",
                    icon: FolderCheck,
                },
            ],
        },
        {
            label: "Personnel",
            icon: UsersRound,
            items: [
                {
                    label: "Administration",
                    href: "/administration",
                    icon: Shield,
                },
                {
                    label: "Teams",
                    href: "/teams",
                    icon: Users01,
                },
                {
                    label: "Members",
                    href: "/members",
                    icon: User01,
                },
                {
                    label: "Alumni",
                    href: "/alumni",
                    icon: GraduationCap,
                },
            ],
        },
    ];

    const footerItems = [
        {
            label: "Support",
            href: "/support",
            icon: LifeBuoy01,
        },
        {
            label: "Settings",
            href: "/settings",
            icon: Settings01,
        },
    ];

    const isLoginPage = location.pathname === "/login";

    return (
        <AlumniGate>
            <div className="app-container">
                <div className="app-body">
                    {user && !isLoginPage && (
                        <SidebarNavigationSlim
                            items={navItems}
                            footerItems={footerItems}
                            user={user}
                            onLogout={logout}
                        />
                    )}

                    <main className="main-content">
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route
                                path="/administration"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <AdministrationPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/projects"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <ProjectsPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/past-projects"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <PastProjectsPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/teams"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <TeamsPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/members"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <MembersPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/alumni"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <AlumniPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/support"
                                element={
                                    <ProtectedRoute>
                                        <UnassignedGate>
                                            <HelpAndSupportPage />
                                        </UnassignedGate>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/user"
                                element={
                                    <ProtectedRoute>
                                        <UserPage />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="/" element={<Navigate to="/teams" replace />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </AlumniGate>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppLayout />
            </BrowserRouter>
        </AuthProvider>
    );
}
