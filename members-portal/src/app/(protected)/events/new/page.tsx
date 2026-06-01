import type { Metadata } from 'next';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import CreateEventModal from '@/features/Events/modals/CreateEventModal';

export const metadata: Metadata = {
    title: 'Create Event | iClub Members Portal',
    description: 'Create a new club event.',
};

export default function NewEventPage() {
    return (
        <AdminProtectedRoute>
            <CreateEventModal />
        </AdminProtectedRoute>
    );
}
