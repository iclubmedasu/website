import { MoreVertical } from 'lucide-react';
import Dropdown from '@/components/dropdown/dropdown';

interface SpecialColumnMenuProps {
    label: string;
    required: boolean;
    showOnPublic?: boolean;
    onToggleRequired: () => void;
    onToggleShowOnPublic?: () => void;
    onMoveLeft?: () => void;
    onMoveRight?: () => void;
    canMoveLeft?: boolean;
    canMoveRight?: boolean;
}

function MenuItem({
    label,
    onClick,
    disabled = false,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="dropdown-item-wrapper">
            <button
                type="button"
                className="dropdown-item"
                disabled={disabled}
                onClick={onClick}
            >
                <span className="dropdown-item-label">{label}</span>
            </button>
        </div>
    );
}

export default function SpecialColumnMenu({
    label,
    required,
    showOnPublic,
    onToggleRequired,
    onToggleShowOnPublic,
    onMoveLeft,
    onMoveRight,
    canMoveLeft = false,
    canMoveRight = false,
}: SpecialColumnMenuProps) {
    return (
        <div className="event-registrations-col-header">
            <span className="event-registrations-col-label" title={label}>
                {label}
                {required ? ' *' : ''}
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
                        aria-label={`Actions for ${label}`}
                    >
                        <MoreVertical size={14} />
                    </button>
                )}
            >
                {({ closeMenu }) => (
                    <>
                        {onMoveLeft ? (
                            <MenuItem
                                label="Move left"
                                disabled={!canMoveLeft}
                                onClick={() => {
                                    onMoveLeft();
                                    closeMenu();
                                }}
                            />
                        ) : null}
                        {onMoveRight ? (
                            <MenuItem
                                label="Move right"
                                disabled={!canMoveRight}
                                onClick={() => {
                                    onMoveRight();
                                    closeMenu();
                                }}
                            />
                        ) : null}
                        <MenuItem
                            label={required ? 'Unset required' : 'Mark required'}
                            onClick={() => {
                                onToggleRequired();
                                closeMenu();
                            }}
                        />
                        {onToggleShowOnPublic !== undefined && showOnPublic !== undefined ? (
                            <MenuItem
                                label={showOnPublic ? 'Hide from public' : 'Show on public'}
                                onClick={() => {
                                    onToggleShowOnPublic();
                                    closeMenu();
                                }}
                            />
                        ) : null}
                    </>
                )}
            </Dropdown>
        </div>
    );
}
