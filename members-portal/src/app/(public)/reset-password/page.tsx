import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordPageClient from './page.client';

export const metadata: Metadata = {
    title: 'Reset Password | iClub Members Portal',
    description: 'Choose a new password for your iClub members portal account.',
};

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordPageClient />
        </Suspense>
    );
}
