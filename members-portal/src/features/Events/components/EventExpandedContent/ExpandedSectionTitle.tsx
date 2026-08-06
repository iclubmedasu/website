'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ExpandedSectionTitleProps {
    label: string;
    onReload: () => void | Promise<void>;
}

export default function ExpandedSectionTitle({ label, onReload }: ExpandedSectionTitleProps) {
    const [reloading, setReloading] = useState(false);

    const handleReload = async () => {
        if (reloading) return;
        setReloading(true);
        try {
            await onReload();
        } finally {
            setReloading(false);
        }
    };

    return (
        <div className="expanded-section-title-row">
            <h2 className="expanded-section-title">{label}</h2>
            <button
                type="button"
                className={`event-section-reload-btn${reloading ? ' event-section-reload-btn--spinning' : ''}`}
                onClick={() => { void handleReload(); }}
                disabled={reloading}
                aria-label={`Reload ${label}`}
                title={`Reload ${label}`}
            >
                <RefreshCw size={14} aria-hidden />
            </button>
        </div>
    );
}
