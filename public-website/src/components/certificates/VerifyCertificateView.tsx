"use client";

import { CheckCircle } from "lucide-react";
import CertificateCanvas from "@/components/certificates/CertificateCanvas";
import type { PublicCertificateVerify } from "@/lib/api";

function formatIssuedOn(issuedAt: string | null): string | null {
    if (!issuedAt) return null;
    const date = new Date(issuedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export interface VerifyCertificateViewProps {
    certificate: PublicCertificateVerify;
}

/**
 * Client wrapper: verification meta + live certificate canvas when a template is linked.
 */
export default function VerifyCertificateView({ certificate }: VerifyCertificateViewProps) {
    const issuedOn = formatIssuedOn(certificate.issuedAt);
    const hasTemplate = Boolean(certificate.template);

    const meta = (
        <div className="verify-page-meta-panel">
            <CheckCircle className="verify-page-icon verify-page-icon--success" strokeWidth={1.5} />
            <h1 className="verify-page-heading">Certificate Verified</h1>
            <p className="verify-page-recipient">{certificate.recipientName}</p>
            {issuedOn ? <p className="verify-page-meta">Issued on {issuedOn}</p> : null}
            <p className="verify-page-code">Code: {certificate.verificationCode}</p>
        </div>
    );

    return (
        <div className={`verify-page${hasTemplate ? " verify-page--with-canvas" : ""}`}>
            {meta}
            {certificate.template ? (
                <div className="verify-page-canvas">
                    <CertificateCanvas
                        certificate={certificate}
                        template={certificate.template}
                        verificationCode={certificate.verificationCode}
                    />
                </div>
            ) : null}
        </div>
    );
}
