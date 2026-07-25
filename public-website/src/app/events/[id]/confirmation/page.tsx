import type { Metadata } from "next";
import { ConfirmationFromCache } from "@/components/registration/ConfirmationFromCache";
import { ConfirmationPageContent } from "@/components/public-data/ConfirmationPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { isNumericPublicParam, publicEventPath, redirectNumericParamToSlug } from "@/lib/publicSlug";

interface ConfirmationPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ code?: string }>;
}

export const metadata: Metadata = {
    title: "Registration Confirmed",
};

function confirmationWithoutCode(idOrSlug: string) {
    return (
        <PageContainer className="max-w-3xl py-10 sm:py-14">
            <BackLink href={publicEventPath(idOrSlug)} label="Back to event" />
            <ConfirmationFromCache idOrSlug={idOrSlug} />
        </PageContainer>
    );
}

export default async function ConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
    const { id } = await params;
    const { code } = await searchParams;
    const trimmedCode = code?.trim();

    if (!isNumericPublicParam(id)) {
        if (!trimmedCode) {
            return confirmationWithoutCode(id);
        }
        return <ConfirmationPageContent idOrSlug={id} code={trimmedCode} />;
    }

    const event = await publicAPI.getEvent(id);
    if (event) {
        redirectNumericParamToSlug({
            param: id,
            slug: event.slug,
            basePath: "events",
            suffix: "/confirmation",
            searchParams: { code },
        });

        if (!trimmedCode) {
            return confirmationWithoutCode(event.slug);
        }

        return <ConfirmationPageContent idOrSlug={event.slug} code={trimmedCode} />;
    }

    // SSR miss (real 404 or HF 503): client component resolves
    if (!trimmedCode) {
        return confirmationWithoutCode(id);
    }

    return <ConfirmationPageContent idOrSlug={id} code={trimmedCode} />;
}
