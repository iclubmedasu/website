import type { Metadata } from "next";
import { RegisterPageContent } from "@/components/public-data/RegisterPageContent";
import { publicAPI } from "@/lib/api";
import { isNumericPublicParam, redirectNumericParamToSlug } from "@/lib/publicSlug";

interface RegisterPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Register",
};

export default async function RegisterPage({ params }: RegisterPageProps) {
    const { id } = await params;

    if (!isNumericPublicParam(id)) {
        return <RegisterPageContent idOrSlug={id} />;
    }

    const event = await publicAPI.getEvent(id);
    if (event) {
        redirectNumericParamToSlug({
            param: id,
            slug: event.slug,
            basePath: "events",
            suffix: "/register",
        });
        return <RegisterPageContent idOrSlug={event.slug} />;
    }

    // SSR miss (real 404 or HF 503): client component resolves
    return <RegisterPageContent idOrSlug={id} />;
}
