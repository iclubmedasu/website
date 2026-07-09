"use client";

import { useEffect, useState } from "react";
import type { PublicAboutPage } from "@iclub/shared";
import { AboutSections } from "@/components/about/AboutSections";
import { PageHeader } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackAboutPage } from "@/lib/siteContentFallback";
import { DataLoadingState } from "./DataLoadingState";

export function AboutPageContent() {
    const [data, setData] = useState<PublicAboutPage | null>(null);

    useEffect(() => {
        void publicAPI
            .getAboutPage()
            .then((page) => setData(page ?? fallbackAboutPage))
            .catch(() => setData(fallbackAboutPage));
    }, []);

    if (data === null) {
        return <DataLoadingState />;
    }

    return (
        <>
            <PageHeader
                eyebrow={data.header.eyebrow}
                title={data.header.title}
                description={data.header.description}
            />
            <AboutSections sections={data.sections} />
        </>
    );
}
