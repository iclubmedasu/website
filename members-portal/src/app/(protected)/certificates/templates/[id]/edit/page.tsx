import { redirect } from 'next/navigation';

export default async function EditCertificateTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/certificates?template=${id}`);
}
