'use client';

import type { ReactNode } from 'react';
import { Ban, MoreVertical, Pencil, Power, Trash2 } from 'lucide-react';
import Dropdown from '@/components/dropdown/dropdown';
import '@/components/table/table.css';

export type EventSetupRowActionVariant = 'edit' | 'delete' | 'enable' | 'disable' | 'utility';

export interface EventSetupRowAction {
    id: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    variant?: EventSetupRowActionVariant;
}

export interface EventSetupRowActionsProps {
    actions: EventSetupRowAction[];
    /** Always-visible controls (e.g. Public form toggle) beside chips / ⋮ */
    leading?: ReactNode;
    disabled?: boolean;
    ariaLabel?: string;
}

function actionIcon(variant: EventSetupRowActionVariant | undefined) {
    switch (variant) {
        case 'delete':
            return <Trash2 size={16} />;
        case 'enable':
            return <Power size={16} />;
        case 'disable':
            return <Ban size={16} />;
        case 'utility':
            return null;
        case 'edit':
        default:
            return <Pencil size={16} />;
    }
}

function actionBtnClass(variant: EventSetupRowActionVariant | undefined): string {
    switch (variant) {
        case 'delete':
            return 'table-action-btn deactivate-btn';
        case 'enable':
            return 'table-action-btn reactivate-btn';
        case 'disable':
            return 'table-action-btn hold-btn';
        case 'utility':
            return 'table-action-btn utility-btn';
        case 'edit':
        default:
            return 'table-action-btn edit-btn';
    }
}

function MenuItem({
    label,
    onClick,
    disabled = false,
    danger = false,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}) {
    return (
        <div className="dropdown-item-wrapper">
            <button
                type="button"
                className={`dropdown-item${danger ? ' event-setup-row-menu-item--danger' : ''}`}
                disabled={disabled}
                onClick={onClick}
            >
                <span className="dropdown-item-label">{label}</span>
            </button>
        </div>
    );
}

/**
 * Desktop: visible table-action chips.
 * Phone (≤768px): three-dot Dropdown with the same actions.
 * Optional `leading` stays visible on all breakpoints (e.g. Public form toggle).
 */
export default function EventSetupRowActions({
    actions,
    leading,
    disabled = false,
    ariaLabel = 'Row actions',
}: EventSetupRowActionsProps) {
    return (
        <div className="event-setup-row-actions event-expanded-inline-actions">
            {leading ? <div className="event-setup-row-actions-leading">{leading}</div> : null}

            <div className="event-setup-row-actions-inline">
                {actions.map((action) => {
                    const isDisabled = disabled || action.disabled;
                    const icon = actionIcon(action.variant);
                    return (
                        <button
                            key={action.id}
                            type="button"
                            className={actionBtnClass(action.variant)}
                            onClick={action.onClick}
                            disabled={isDisabled}
                            aria-label={action.label}
                            title={action.label}
                        >
                            {icon ?? action.label}
                        </button>
                    );
                })}
            </div>

            <div className="event-setup-row-actions-menu">
                <Dropdown
                    wrapperClassName="event-setup-row-dropdown"
                    menuClassName="dropdown-menu event-setup-row-menu-panel"
                    openClassName="open"
                    hoverOpen={false}
                    button={
                        <button
                            type="button"
                            className="table-action-btn edit-btn"
                            disabled={disabled}
                            aria-label={ariaLabel}
                        >
                            <MoreVertical size={16} />
                        </button>
                    }
                >
                    {({ closeMenu }) => (
                        <>
                            {actions.map((action) => (
                                <MenuItem
                                    key={action.id}
                                    label={action.label}
                                    danger={action.danger}
                                    disabled={disabled || action.disabled}
                                    onClick={() => {
                                        action.onClick();
                                        closeMenu();
                                    }}
                                />
                            ))}
                        </>
                    )}
                </Dropdown>
            </div>
        </div>
    );
}
