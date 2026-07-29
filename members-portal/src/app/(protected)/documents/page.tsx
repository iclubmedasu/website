import type { Metadata } from 'next';
import DocumentsPage from '@/features/Documents/DocumentsPage';

export const metadata: Metadata = {
    title: 'Documents | iClub Members Portal',
    description: 'Browse and manage club documents.',
};

export default function DocumentsRoutePage() {
    return <DocumentsPage />;
}
