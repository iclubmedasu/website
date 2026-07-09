"use client";

import { useEffect, useState } from "react";
import type { PublicSupportPage } from "@iclub/shared";
import { IncidentReportForm } from "@/components/support/IncidentReportForm";
import { SupportNotices } from "@/components/support/SupportNotices";
import { PageHeader } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackSupportPage, normalizeSupportPage } from "@/lib/siteContentFallback";
import { DataLoadingState } from "./DataLoadingState";

export function SupportPageContent() {
    const [data, setData] = useState<PublicSupportPage | null>(null);

    useEffect(() => {
        void publicAPI
            .getSupportPage()
            .then((page) => setData(normalizeSupportPage(page)))
            .catch(() => setData(normalizeSupportPage(fallbackSupportPage)));
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
            <div className="mx-auto max-w-3xl space-y-8">
                <SupportNotices notices={data.notices} />
                <IncidentReportForm forms={data.forms} />
            </div>
        </>
    );
}
