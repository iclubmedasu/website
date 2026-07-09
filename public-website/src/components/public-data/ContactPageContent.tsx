"use client";

import { useEffect, useState } from "react";
import type { PublicContactPage } from "@iclub/shared";
import { PageHeader } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackContactPage } from "@/lib/siteContentFallback";
import { DataLoadingState } from "./DataLoadingState";

export function ContactPageContent() {
    const [data, setData] = useState<PublicContactPage | null>(null);

    useEffect(() => {
        void publicAPI
            .getContactPage()
            .then((page) => setData(page ?? fallbackContactPage))
            .catch(() => setData(fallbackContactPage));
    }, []);

    if (data === null) {
        return <DataLoadingState />;
    }

    return (
        <PageHeader
            eyebrow={data.header.eyebrow}
            title={data.header.title}
            description={data.header.description}
        />
    );
}
