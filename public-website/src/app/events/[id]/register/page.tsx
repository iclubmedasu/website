import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterPageContent } from "@/components/public-data/RegisterPageContent";
import { publicAPI } from "@/lib/api";
import { redirectNumericParamToSlug } from "@/lib/publicSlug";

interface RegisterPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Register",
};

export default async function RegisterPage({ params }: RegisterPageProps) {
    const { id } = await params;
    const event = await publicAPI.getEvent(id);
    if (!event) {
        notFound();
    }

    redirectNumericParamToSlug({
        param: id,
        slug: event.slug,
        basePath: "events",
        suffix: "/register",
    });

    return <RegisterPageContent idOrSlug={event.slug} />;
}
