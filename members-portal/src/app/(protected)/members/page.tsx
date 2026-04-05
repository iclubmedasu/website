import type { Metadata } from 'next';

import MembersPage from "@/features/Personnel/Members/MembersPage";

export const metadata: Metadata = {
    title: 'Members | iClub Members Portal',
    description: 'View and manage member profiles.',
};

export default function MembersRoutePage() {
    return <MembersPage />;
}
