import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import VerifyCertificateView from "@/components/certificates/VerifyCertificateView";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";

export const metadata: Metadata = {
    title: "Certificate Verification",
};

interface VerifyPageProps {
    params: Promise<{ code: string }>;
}

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
    const { code } = await params;
    const certificate = await publicAPI.getCertificate(code);

    if (!certificate) {
        return (
            <PageContainer className="max-w-xl space-y-6 py-10 sm:py-14">
                <BackLink href="/" label="Back to Home" />
                <div className="empty-state max-w-lg verify-page">
                    <XCircle className="verify-page-icon verify-page-icon--error" strokeWidth={1.5} />
                    <h1 className="empty-state-title verify-page-heading verify-page-heading--error">
                        Certificate Not Found
                    </h1>
                    <p className="empty-state-text verify-page-body">
                        This verification code is invalid or the certificate has not been issued yet.
                    </p>
                </div>
            </PageContainer>
        );
    }

    const hasTemplate = Boolean(certificate.template);

    return (
        <PageContainer
            className={`${hasTemplate ? "max-w-6xl" : "max-w-xl"} space-y-6 py-10 sm:py-14`}
        >
            <BackLink href="/" label="Back to Home" />
            <VerifyCertificateView certificate={certificate} />
        </PageContainer>
    );
}
