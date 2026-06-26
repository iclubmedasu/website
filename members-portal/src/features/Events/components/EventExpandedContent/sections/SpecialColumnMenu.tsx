import { MoreVertical } from 'lucide-react';
import Dropdown from '@/components/dropdown/dropdown';

interface SpecialColumnMenuProps {
    label: string;
    required: boolean;
    showOnPublic: boolean;
    onToggleRequired: () => void;
    onToggleShowOnPublic: () => void;
}

function MenuItem({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <div className="dropdown-item-wrapper">
            <button
                type="button"
                className="dropdown-item"
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
                        <MenuItem
                            label={required ? 'Unset required' : 'Mark required'}
                            onClick={() => {
                                onToggleRequired();
                                closeMenu();
                            }}
                        />
                        <MenuItem
                            label={showOnPublic ? 'Hide from public' : 'Show on public'}
                            onClick={() => {
                                onToggleShowOnPublic();
                                closeMenu();
                            }}
                        />
                    </>
                )}
            </Dropdown>
        </div>
    );
}
