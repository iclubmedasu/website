import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdministrationPage from './pages/Administration/AdministrationPage';
import ProjectsPage from './pages/Projects/ProjectsPage';
import TeamsPage from './pages/Teams/TeamsPage';
import MembersPage from './pages/Members/MembersPage';
import AlumniPage from './pages/Alumni/AlumniPage';
import HelpAndSupportPage from './pages/HelpAndSupport/HelpAndSupportPage';
import UserPage from './pages/User/UserPage';
import ProtectedRoute from './components/ProtectedRoute';
import { SidebarNavigationSlim } from './pages/SideBarNavigationSlim';
import {
    Users01,
    User01,
    BarChartSquare02,
    LifeBuoy01,
    Settings01,
} from "@untitledui/icons";
import { GraduationCap, Shield, UsersRound, FolderKanban } from "lucide-react";
import './app.css';

function AppLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        {
            label: 'Dashboard',
            href: '/dashboard',
            icon: BarChartSquare02,
            // No `items` array → plain link, no flyout
        },
        {
            label: 'Projects',
            href: '/projects',
            icon: FolderKanban,
        },
        {
            label: 'Personnel',
            icon: UsersRound,
            // No `href` because this item only opens a flyout
            items: [
                {
                    label: 'Administration',
                    href: '/administration',
                    icon: Shield,
                },
                {
                    label: 'Teams',
                    href: '/teams',
                    icon: Users01,
                },
                {
                    label: 'Members',
                    href: '/members',
                    icon: User01,
                },
                {
                    label: 'Alumni',
                    href: '/alumni',
                    icon: GraduationCap,
                },
            ],
        },
    ];

    const footerItems = [
        {
            label: 'Support',
            href: '/support',
            icon: LifeBuoy01,
        },
        {
            label: 'Settings',
            href: '/settings',
            icon: Settings01,
        },
    ];

    const isLoginPage = location.pathname === '/login';

    return (
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
                                    <AdministrationPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/projects"
                            element={
                                <ProtectedRoute>
                                    <ProjectsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/teams"
                            element={
                                <ProtectedRoute>
                                    <TeamsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/members"
                            element={
                                <ProtectedRoute>
                                    <MembersPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/alumni"
                            element={
                                <ProtectedRoute>
                                    <AlumniPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/support"
                            element={
                                <ProtectedRoute>
                                    <HelpAndSupportPage />
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
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppLayout />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;