'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface EventStaffModalProps {
    open: boolean;
    title: string;
    subtitle?: string;
    titleId: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
    closeDisabled?: boolean;
}

export default function EventStaffModal({
    open,
    title,
    subtitle,
    titleId,
    onClose,
    children,
    footer,
    closeDisabled = false,
}: EventStaffModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open || !mounted) return null;

    return createPortal(
        <>
            <div
                className="modal-backdrop"
                onClick={closeDisabled ? undefined : onClose}
                aria-hidden="true"
            />
            <div
                className="modal-container event-staff-action-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id={titleId}>{title}</h2>
                        {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
                    </div>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                        disabled={closeDisabled}
                    >
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    {footer}
                </div>
            </div>
        </>,
        document.body,
    );
}
