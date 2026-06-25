'use client';

import { SiteContentModal } from './SiteContentModal';

interface ConfirmDeleteModalProps {
    title: string;
    message: string;
    itemLabel?: string;
    confirmLabel?: string;
    busy?: boolean;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

export function ConfirmDeleteModal({
    title,
    message,
    itemLabel,
    confirmLabel = 'Delete',
    busy = false,
    onConfirm,
    onClose,
}: ConfirmDeleteModalProps) {
    return (
        <SiteContentModal
            title={title}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => void onConfirm()} disabled={busy}>
                        {busy ? 'Deleting…' : confirmLabel}
                    </button>
                </>
            }
        >
            <p>{message}</p>
            {itemLabel ? <p className="site-content-delete-target">{itemLabel}</p> : null}
        </SiteContentModal>
    );
}
