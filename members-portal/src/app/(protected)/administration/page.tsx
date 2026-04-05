import type { Metadata } from 'next';

import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import AdministrationPage from "@/features/Personnel/Administration/AdministrationPage";

export const metadata: Metadata = {
    title: 'Administration | iClub Members Portal',
    description: 'Manage administrative roles and operations.',
};

export default function AdministrationRoutePage() {
    return (
        <AdminProtectedRoute>
            <AdministrationPage />
        </AdminProtectedRoute>
    );
}
