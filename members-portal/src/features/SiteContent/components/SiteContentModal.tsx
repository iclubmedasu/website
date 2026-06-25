'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface SiteContentModalProps {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}

export function SiteContentModal({ title, subtitle, onClose, children, footer, wide }: SiteContentModalProps) {
    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className={`modal-container${wide ? ' site-content-modal-wide' : ''}`}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{title}</h2>
                        {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
                    </div>
                    <button className="modal-close-btn" onClick={onClose} type="button" aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer ? <div className="modal-footer">{footer}</div> : null}
            </div>
        </>
    );
}
