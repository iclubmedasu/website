'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface FinanceModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

export function FinanceModal({ title, onClose, children, footer }: FinanceModalProps) {
    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container finance-modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
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
