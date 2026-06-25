'use client';

import Toggle from '@/components/toggle/Toggle';

interface PublicVisibilityToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function PublicVisibilityToggle({ checked, onChange, disabled }: PublicVisibilityToggleProps) {
    return (
        <div className="site-content-toggle-row">
            <div className="site-content-toggle-copy">
                <span className="form-label site-content-toggle-label">Show on public website</span>
                <span className="site-content-toggle-hint">When off, this item is hidden from the public contact page.</span>
            </div>
            <Toggle
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                aria-label="Show on public website"
            />
        </div>
    );
}
