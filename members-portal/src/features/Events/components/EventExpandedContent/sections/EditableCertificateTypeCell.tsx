import type { CertificateType } from '@/services/certificatesAPI';
import { FormSelect } from '@/components/input/FormSelect';

const CERTIFICATE_TYPES: CertificateType[] = [
    'ATTENDANCE',
    'ORGANIZATION',
    'CONTRIBUTION',
    'LEADERSHIP',
    'ADMINISTRATION',
    'SUPERVISION',
    'PARTICIPATION',
];

function formatCertificateType(type: CertificateType): string {
    return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
}

interface EditableCertificateTypeCellProps {
    value: CertificateType;
    disabled?: boolean;
    recipientName?: string;
    onChange: (next: CertificateType) => void;
}

export default function EditableCertificateTypeCell({
    value,
    disabled = false,
    recipientName,
    onChange,
}: EditableCertificateTypeCellProps) {
    if (disabled) {
        return (
            <td>
                <span className="badge">
                    {formatCertificateType(value)}
                </span>
            </td>
        );
    }

    return (
        <td>
            <FormSelect
                aria-label={
                    recipientName
                        ? `Certificate type for ${recipientName}`
                        : 'Certificate type'
                }
                value={value}
                onChange={(event) => onChange(event.target.value as CertificateType)}
                className="event-registrations-table-input form-input"
            >
                {CERTIFICATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                        {formatCertificateType(type)}
                    </option>
                ))}
            </FormSelect>
        </td>
    );
}
