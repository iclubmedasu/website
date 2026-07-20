import type { Metadata } from 'next';
import { Suspense } from 'react';
import CertificatesPage from '@/features/Certificates/CertificatesPage';

export const metadata: Metadata = {
    title: 'Certificates | iClub Members Portal',
    description: 'View and manage certificates.',
};

export default function CertificatesRoute() {
    return (
        <Suspense
            fallback={
                <main className="certificates-page">
                    <div className="loading-message">Loading certificates…</div>
                </main>
            }
        >
            <CertificatesPage />
        </Suspense>
    );
}
