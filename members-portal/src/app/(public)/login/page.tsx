import type { Metadata } from 'next';
import LoginPageClient from './page.client';

export const metadata: Metadata = {
    title: 'Login | iClub Members Portal',
    description: 'Sign in to access the iClub members portal.',
};

export default function LoginPage() {
    return <LoginPageClient />;
}
