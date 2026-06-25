import type { Metadata } from 'next';
import ContactEditorPage from '@/features/SiteContent/ContactEditorPage';

export const metadata: Metadata = {
    title: 'Contact Page',
};

export default function GeneralContactPage() {
    return <ContactEditorPage />;
}
