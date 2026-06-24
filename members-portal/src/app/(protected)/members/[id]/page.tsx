import type { Metadata } from 'next';
import MemberProfilePage from './page.client';

type PageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    return {
        title: `Member Profile | iClub Members Portal`,
        description: `View member profile ${id}`,
    };
}

export default function MemberProfileRoutePage() {
    return <MemberProfilePage />;
}
