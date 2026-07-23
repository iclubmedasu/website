'use client';

import { Fragment, useState, type ReactNode } from 'react';

export interface CollapsibleChipItem {
    key: string;
    label: string;
    node: ReactNode;
}

interface CollapsibleChipGroupProps {
    chips: CollapsibleChipItem[];
    collapsible?: boolean;
    emptyLabel?: ReactNode;
    collapseTitle?: string;
}

/**
 * Shared expand/collapse chip row (same UX as attendance chips):
 * collapsed → first chip + "…"; expanded → all chips + "…".
 */
export default function CollapsibleChipGroup({
    chips,
    collapsible = true,
    emptyLabel = '—',
    collapseTitle = 'Show fewer',
}: CollapsibleChipGroupProps) {
    const [expanded, setExpanded] = useState(false);

    if (chips.length === 0) return <>{emptyLabel}</>;

    const shouldCollapse = collapsible && chips.length > 1 && !expanded;
    const hiddenLabels = chips.slice(1).map((chip) => chip.label).join(', ');

    return (
        <span className={[
            'event-attendance-days',
            shouldCollapse ? 'event-attendance-days--collapsed' : '',
        ].filter(Boolean).join(' ')}>
            {shouldCollapse ? (
                <>
                    {chips[0].node}
                    <button
                        type="button"
                        className="event-attendance-day-chip event-attendance-day-chip--more"
                        aria-expanded={false}
                        title={hiddenLabels}
                        onClick={() => setExpanded(true)}
                    >
                        …
                    </button>
                </>
            ) : (
                <>
                    {chips.map((chip) => (
                        <Fragment key={chip.key}>{chip.node}</Fragment>
                    ))}
                    {collapsible && chips.length > 1 ? (
                        <button
                            type="button"
                            className="event-attendance-day-chip event-attendance-day-chip--more"
                            aria-expanded
                            title={collapseTitle}
                            onClick={() => setExpanded(false)}
                        >
                            …
                        </button>
                    ) : null}
                </>
            )}
        </span>
    );
}
