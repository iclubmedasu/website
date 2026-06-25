import type { Metadata } from 'next';
import AboutEditorPage from '@/features/SiteContent/AboutEditorPage';

export const metadata: Metadata = {
    title: 'About Page',
};

export default function GeneralAboutPage() {
    return <AboutEditorPage />;
}
