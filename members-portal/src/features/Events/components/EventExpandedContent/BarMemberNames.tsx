'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { TimetableBarMember } from './EventTasksTimetable';

const TRUNCATION_SUFFIX = '......';

export function formatMemberLabel(members: TimetableBarMember[]): string {
    if (members.length === 0) return 'Unassigned';
    return members.map((member) => `${member.isLeader ? '★ ' : ''}${member.memberName}`).join(', ');
}

function formatMemberPart(member: TimetableBarMember): string {
    return `${member.isLeader ? '★ ' : ''}${member.memberName}`;
}

function joinMemberParts(parts: string[]): string {
    return parts.join(', ');
}

function truncateSingleName(name: string, element: HTMLElement): string {
    if (!name) return TRUNCATION_SUFFIX;

    let low = 0;
    let high = name.length;
    let best = TRUNCATION_SUFFIX;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = `${name.slice(0, mid).trimEnd()}${TRUNCATION_SUFFIX}`;
        element.textContent = candidate;
        if (element.scrollWidth <= element.clientWidth) {
            best = candidate;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return best;
}

function computeTruncatedLabel(members: TimetableBarMember[], element: HTMLElement): string {
    if (members.length === 0) return 'Unassigned';

    const parts = members.map(formatMemberPart);
    const fullLabel = joinMemberParts(parts);

    element.textContent = fullLabel;
    if (element.scrollWidth <= element.clientWidth) {
        return fullLabel;
    }

    if (parts.length === 1) {
        return truncateSingleName(parts[0], element);
    }

    for (let count = parts.length - 1; count >= 1; count -= 1) {
        const candidate = `${joinMemberParts(parts.slice(0, count))}${TRUNCATION_SUFFIX}`;
        element.textContent = candidate;
        if (element.scrollWidth <= element.clientWidth) {
            return candidate;
        }
    }

    return truncateSingleName(parts[0], element);
}

interface BarMemberNamesProps {
    members: TimetableBarMember[];
    className?: string;
}

export default function BarMemberNames({ members, className }: BarMemberNamesProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const [displayLabel, setDisplayLabel] = useState(() => formatMemberLabel(members));
    const fullLabel = formatMemberLabel(members);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        const updateLabel = () => {
            setDisplayLabel(computeTruncatedLabel(members, element));
        };

        updateLabel();

        const observer = new ResizeObserver(updateLabel);
        observer.observe(element);

        return () => observer.disconnect();
    }, [members]);

    return (
        <span
            ref={ref}
            className={className ?? 'ett-bar-member'}
            title={fullLabel}
        >
            {displayLabel}
        </span>
    );
}
