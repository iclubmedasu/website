import type { CertificateType } from "@prisma/client";

export function normalizeRecipientEmail(email: string | null | undefined): string {
    return String(email ?? "").trim().toLowerCase();
}

/**
 * Identity for "already issued" / duplicate checks.
 * Prefer member id when present; otherwise email (walk-ins share null memberId).
 */
export function certRecipientKey(
    memberId: number | null | undefined,
    type: string,
    email?: string | null,
): string {
    if (memberId != null && memberId > 0) {
        return `m:${memberId}:${type}`;
    }
    return `e:${normalizeRecipientEmail(email)}:${type}`;
}

export function buildAlreadyIssuedSet(
    certs: Array<{
        recipientMemberId: number | null;
        type: CertificateType;
        recipientEmail: string;
    }>,
): Set<string> {
    const set = new Set<string>();
    for (const cert of certs) {
        set.add(certRecipientKey(cert.recipientMemberId, cert.type, cert.recipientEmail));
    }
    return set;
}
