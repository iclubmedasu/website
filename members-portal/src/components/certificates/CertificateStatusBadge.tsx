type CertificateStatusBadgeStatus = 'ISSUED' | 'REVOKED' | string;

interface CertificateStatusBadgeProps {
    status: CertificateStatusBadgeStatus;
    label: string;
    canRevoke: boolean;
    onRevoke: () => void;
    recipientName?: string;
}

function statusBadgeClass(status: CertificateStatusBadgeStatus): string {
    if (status === 'ISSUED') return 'status-badge active';
    if (status === 'REVOKED') return 'status-badge revoked';
    return 'status-badge offline';
}

export default function CertificateStatusBadge({
    status,
    label,
    canRevoke,
    onRevoke,
    recipientName,
}: CertificateStatusBadgeProps) {
    const className = statusBadgeClass(status);

    if (canRevoke) {
        const title = recipientName
            ? `Revoke certificate for ${recipientName}`
            : 'Revoke certificate';
        return (
            <button
                type="button"
                className={`${className} status-badge--revocable`}
                title={title}
                onClick={onRevoke}
            >
                {label}
                <span className="status-badge__remove" aria-hidden="true">
                    ×
                </span>
            </button>
        );
    }

    return <span className={className}>{label}</span>;
}
