import type { Metadata } from 'next';
import { Suspense } from 'react';
import ForgotPasswordPageClient from './page.client';

export const metadata: Metadata = {
    title: 'Forgot Password | iClub Members Portal',
    description: 'Request a password reset link for your iClub members portal account.',
};

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ForgotPasswordPageClient />
        </Suspense>
    );
}
