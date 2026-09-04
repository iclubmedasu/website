'use client';

import { X } from 'lucide-react';
import '@/components/modal/modal.css';

export type ConfirmModalVariant = 'primary' | 'danger';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel: string;
    busy?: boolean;
    busyLabel?: string;
    variant?: ConfirmModalVariant;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

export function ConfirmModal({
    title,
    message,
    confirmLabel,
    busy = false,
    busyLabel,
    variant = 'primary',
    onConfirm,
    onClose,
}: ConfirmModalProps) {
    const confirmClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    const defaultBusyLabel = variant === 'danger' ? 'Deleting…' : 'Working…';

    return (
        <>
            <div className="modal-backdrop" onClick={busy ? undefined : onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{title}</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={onClose}
                        type="button"
                        aria-label="Close"
                        disabled={busy}
                    >
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    <p>{message}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={confirmClass}
                        onClick={() => void onConfirm()}
                        disabled={busy}
                    >
                        {busy ? (busyLabel ?? defaultBusyLabel) : confirmLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
