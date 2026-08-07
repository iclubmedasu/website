import type { Metadata } from "next";
import { EmbedRegisterContent } from "@/components/registration/EmbedRegisterContent";
import {
    buildEmbedThemeCss,
    parseEmbedStyleSearchParams,
} from "@/lib/embedStyleParams";

interface EmbedRegisterPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
    title: "Register",
    robots: { index: false, follow: false },
};

export default async function EmbedRegisterPage({
    params,
    searchParams,
}: EmbedRegisterPageProps) {
    const { id } = await params;
    const query = await searchParams;
    const styleParams = parseEmbedStyleSearchParams(query);
    const themeCss = buildEmbedThemeCss(styleParams);

    return (
        <>
            {styleParams.customCssUrl ? (
                // Tier 2: host-provided stylesheet, loaded inside the embed document.
                // eslint-disable-next-line @next/next/no-css-tags -- dynamic host CSS URL by design
                <link rel="stylesheet" href={styleParams.customCssUrl} />
            ) : null}
            <EmbedRegisterContent
                idOrSlug={id}
                themeCss={themeCss}
                layout={styleParams.layout}
            />
        </>
    );
}
