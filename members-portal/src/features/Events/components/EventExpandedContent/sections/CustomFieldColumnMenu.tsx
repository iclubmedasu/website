import { MoreVertical } from 'lucide-react';
import Dropdown from '@/components/dropdown/dropdown';
import type { EventCustomFieldRef } from '@/types/backend-contracts';

interface CustomFieldColumnMenuProps {
    field: EventCustomFieldRef;
    index: number;
    total: number;
    onEdit: () => void;
    onToggleRequired: () => void;
    onToggleShowOnPublic: () => void;
    onDelete: () => void;
    onMoveLeft: () => void;
    onMoveRight: () => void;
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
                className={`dropdown-item${danger ? ' event-registrations-col-menu-danger' : ''}`}
                disabled={disabled}
                onClick={onClick}
            >
                <span className="dropdown-item-label">{label}</span>
            </button>
        </div>
    );
}

export default function CustomFieldColumnMenu({
    field,
    index,
    total,
    onEdit,
    onToggleRequired,
    onToggleShowOnPublic,
    onDelete,
    onMoveLeft,
    onMoveRight,
}: CustomFieldColumnMenuProps) {
    return (
        <div className="event-registrations-col-header">
            <span className="event-registrations-col-label" title={field.label}>
                {field.label}
                {field.required ? ' *' : ''}
            </span>
            <Dropdown
                wrapperClassName="event-registrations-col-dropdown"
                menuClassName="dropdown-menu event-registrations-col-menu-panel"
                openClassName="open"
                hoverOpen={false}
                button={(
                    <button
                        type="button"
                        className="table-action-btn edit-btn"
                        aria-label={`Actions for ${field.label}`}
                    >
                        <MoreVertical size={14} />
                    </button>
                )}
            >
                {({ closeMenu }) => (
                    <>
                        <MenuItem
                            label="Move left"
                            disabled={index === 0}
                            onClick={() => {
                                onMoveLeft();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label="Move right"
                            disabled={index >= total - 1}
                            onClick={() => {
                                onMoveRight();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label="Edit"
                            onClick={() => {
                                onEdit();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label={field.required ? 'Unset required' : 'Mark required'}
                            onClick={() => {
                                onToggleRequired();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label={field.showOnPublic ? 'Hide from public' : 'Show on public'}
                            onClick={() => {
                                onToggleShowOnPublic();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label="Delete"
                            danger
                            onClick={() => {
                                onDelete();
                                closeMenu();
                            }}
                        />
                    </>
                )}
            </Dropdown>
        </div>
    );
}
