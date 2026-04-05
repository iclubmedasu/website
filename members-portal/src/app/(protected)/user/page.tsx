import type { Metadata } from 'next';
import UserPageClient from './page.client';

export const metadata: Metadata = {
    title: 'My Profile | iClub Members Portal',
    description: 'Manage your profile, security, and account settings.',
};

export default function UserPage() {
    return <UserPageClient />;
}
