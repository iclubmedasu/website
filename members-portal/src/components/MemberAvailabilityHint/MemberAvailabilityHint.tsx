'use client';

import { AlertTriangle, Check, X } from 'lucide-react';
import {
    availabilityChipTitle,
    chipTone,
    type AvailabilityConflict,
    type AvailabilityStatus,
} from '@/features/Announcements/announcementAvailability';
import './MemberAvailabilityHint.css';

interface MemberAvailabilityHintProps {
    status: AvailabilityStatus;
    periodsLabel?: string;
    conflict?: AvailabilityConflict;
    conflictNote?: string | null;
    announcementTitle?: string | null;
    compact?: boolean;
}

function statusLabel(
    status: AvailabilityStatus,
    conflict: AvailabilityConflict,
): string {
    if (conflict === 'partial') return 'Partial';
    if (conflict === 'outside_periods') return 'Outside periods';
    if (status === 'UNAVAILABLE' || conflict === 'unavailable') return 'Not available';
    return 'Available';
}

export default function MemberAvailabilityHint({
    status,
    periodsLabel = '',
    conflict = 'none',
    conflictNote = null,
    announcementTitle = null,
    compact = false,
}: MemberAvailabilityHintProps) {
    const summary = {
        status,
        label: statusLabel(status, conflict),
        conflict,
        periodsLabel,
        conflictNote,
    };
    const tone = chipTone(summary);
    const title = availabilityChipTitle(summary, announcementTitle);

    const Icon =
        tone === 'available' ? Check
            : tone === 'unavailable' ? X
                : tone === 'partial' ? AlertTriangle
                    : null;

    return (
        <div
            className={`member-availability-hint member-availability-hint--${tone}${compact ? ' member-availability-hint--compact' : ''}`}
            title={title}
        >
            {Icon ? <Icon className="member-availability-hint-icon" size={14} aria-hidden /> : null}
            <span className="member-availability-hint-status">{statusLabel(status, conflict)}</span>
            {periodsLabel ? (
                <span className="member-availability-hint-periods">{periodsLabel}</span>
            ) : null}
        </div>
    );
}
