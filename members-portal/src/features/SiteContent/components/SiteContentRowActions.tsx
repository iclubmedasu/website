'use client';

import { ArrowDown, ArrowUp, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import Dropdown from '@/components/dropdown/dropdown';
import '@/components/table/table.css';

export interface SiteContentRowActionsProps {
    busy?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onEdit: () => void;
    onDelete: () => void;
    deleteDisabled?: boolean;
    ariaLabel?: string;
    editLabel?: string;
    deleteLabel?: string;
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
                className={`dropdown-item${danger ? ' site-content-row-menu-item--danger' : ''}`}
                disabled={disabled}
                onClick={onClick}
            >
                <span className="dropdown-item-label">{label}</span>
            </button>
        </div>
    );
}

/**
 * Desktop: visible icon row (Up / Down / Edit / Delete) via table-action-btn.
 * Phone (≤768px): three-dot app-chrome Dropdown with the same actions.
 */
export function SiteContentRowActions({
    busy = false,
    canMoveUp = true,
    canMoveDown = true,
    onMoveUp,
    onMoveDown,
    onEdit,
    onDelete,
    deleteDisabled = false,
    ariaLabel = 'Row actions',
    editLabel = 'Edit',
    deleteLabel = 'Delete',
}: SiteContentRowActionsProps) {
    const moveUpDisabled = busy || !canMoveUp;
    const moveDownDisabled = busy || !canMoveDown;
    const deleteDisabledCombined = busy || deleteDisabled;

    return (
        <div className="site-content-row-actions">
            <div className="site-content-row-actions-inline">
                <button
                    type="button"
                    className="table-action-btn utility-btn"
                    onClick={onMoveUp}
                    disabled={moveUpDisabled}
                    aria-label="Move up"
                    title="Move up"
                >
                    <ArrowUp size={16} />
                </button>
                <button
                    type="button"
                    className="table-action-btn utility-btn"
                    onClick={onMoveDown}
                    disabled={moveDownDisabled}
                    aria-label="Move down"
                    title="Move down"
                >
                    <ArrowDown size={16} />
                </button>
                <button
                    type="button"
                    className="table-action-btn edit-btn"
                    onClick={onEdit}
                    disabled={busy}
                    aria-label={editLabel}
                    title={editLabel}
                >
                    <Pencil size={16} />
                </button>
                <button
                    type="button"
                    className="table-action-btn deactivate-btn"
                    onClick={onDelete}
                    disabled={deleteDisabledCombined}
                    aria-label={deleteLabel}
                    title={deleteLabel}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="site-content-row-actions-menu">
                <Dropdown
                    wrapperClassName="site-content-row-dropdown"
                    menuClassName="dropdown-menu site-content-row-menu-panel"
                    openClassName="open"
                    hoverOpen={false}
                    button={
                        <button
                            type="button"
                            className="table-action-btn edit-btn"
                            disabled={busy}
                            aria-label={ariaLabel}
                        >
                            <MoreVertical size={16} />
                        </button>
                    }
                >
                    {({ closeMenu }) => (
                        <>
                            <MenuItem
                                label="Move up"
                                disabled={moveUpDisabled}
                                onClick={() => {
                                    onMoveUp();
                                    closeMenu();
                                }}
                            />
                            <MenuItem
                                label="Move down"
                                disabled={moveDownDisabled}
                                onClick={() => {
                                    onMoveDown();
                                    closeMenu();
                                }}
                            />
                            <MenuItem
                                label={editLabel}
                                disabled={busy}
                                onClick={() => {
                                    onEdit();
                                    closeMenu();
                                }}
                            />
                            <MenuItem
                                label={deleteLabel}
                                danger
                                disabled={deleteDisabledCombined}
                                onClick={() => {
                                    onDelete();
                                    closeMenu();
                                }}
                            />
                        </>
                    )}
                </Dropdown>
            </div>
        </div>
    );
}
