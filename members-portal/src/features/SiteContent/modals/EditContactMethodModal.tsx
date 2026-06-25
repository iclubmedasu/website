'use client';

import { useState } from 'react';
import type { ContactMethodType, EditorContactMethod, EditorContactPage } from '@iclub/shared';
import { siteContentAPI } from '@/services/api';
import { PublicVisibilityToggle } from '../components/PublicVisibilityToggle';
import { SiteContentModal } from '../components/SiteContentModal';

interface EditContactMethodModalProps {
    method?: EditorContactMethod;
    onClose: () => void;
    onSaved: (page: EditorContactPage) => void;
}

const METHOD_TYPES: ContactMethodType[] = ['EMAIL', 'PHONE', 'ADDRESS', 'OTHER'];

export function EditContactMethodModal({ method, onClose, onSaved }: EditContactMethodModalProps) {
    const [type, setType] = useState<ContactMethodType>(method?.type ?? 'EMAIL');
    const [label, setLabel] = useState(method?.label ?? '');
    const [value, setValue] = useState(method?.value ?? '');
    const [isActive, setIsActive] = useState(method?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const payload = { type, label, value, isActive };
            const updated = method
                ? ((await siteContentAPI.updateContactMethod(method.id, payload)) as EditorContactPage)
                : ((await siteContentAPI.createContactMethod(payload)) as EditorContactPage);
            onSaved(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contact method');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title={method ? 'Edit contact method' : 'Add contact method'}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                        Save
                    </button>
                </>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}
            <div className="form-group">
                <label htmlFor="contact-method-type" className="form-label">
                    Type
                </label>
                <select
                    id="contact-method-type"
                    className="form-input"
                    value={type}
                    onChange={(event) => setType(event.target.value as ContactMethodType)}
                >
                    {METHOD_TYPES.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="contact-method-label" className="form-label">
                    Label
                </label>
                <input
                    id="contact-method-label"
                    className="form-input"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="contact-method-value" className="form-label">
                    Value
                </label>
                <input
                    id="contact-method-value"
                    className="form-input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                />
            </div>
            <PublicVisibilityToggle checked={isActive} onChange={setIsActive} disabled={busy} />
        </SiteContentModal>
    );
}
