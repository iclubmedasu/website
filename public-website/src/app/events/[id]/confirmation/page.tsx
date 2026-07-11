import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmationFromCache } from "@/components/registration/ConfirmationFromCache";
import { ConfirmationPageContent } from "@/components/public-data/ConfirmationPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { publicEventPath, redirectNumericParamToSlug } from "@/lib/publicSlug";

interface ConfirmationPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ code?: string }>;
}

export const metadata: Metadata = {
    title: "Registration Confirmed",
};

export default async function ConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
    const { id } = await params;
    const { code } = await searchParams;
    const event = await publicAPI.getEvent(id);
    if (!event) {
        notFound();
    }

    redirectNumericParamToSlug({
        param: id,
        slug: event.slug,
        basePath: "events",
        suffix: "/confirmation",
        searchParams: { code },
    });

    if (!code?.trim()) {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={publicEventPath(event.slug)} label="Back to event" />
                <ConfirmationFromCache eventId={event.id} eventSlug={event.slug} />
            </PageContainer>
        );
    }

    return <ConfirmationPageContent idOrSlug={event.slug} code={code.trim()} />;
}
