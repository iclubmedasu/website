'use client';

import { useState } from 'react';
import type { SitePageHeader } from '@iclub/shared';
import { SiteContentModal } from './SiteContentModal';

interface PageHeaderEditorProps {
    header: SitePageHeader;
    canEdit: boolean;
    busy: boolean;
    description: string;
    onSave: (header: SitePageHeader) => Promise<void>;
}

export function PageHeaderEditor({ header, canEdit, busy, description, onSave }: PageHeaderEditorProps) {
    const [draft, setDraft] = useState(header);
    const [editing, setEditing] = useState(false);

    const startEditing = () => {
        setDraft(header);
        setEditing(true);
    };

    const cancel = () => {
        setDraft(header);
        setEditing(false);
    };

    const save = async () => {
        await onSave({
            ...draft,
            eyebrow: header.eyebrow,
        });
        setEditing(false);
    };

    return (
        <>
            <div className="card site-content-header-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Page header</h3>
                        <p className="card-subtitle">{description}</p>
                    </div>
                    {canEdit ? (
                        <button
                            type="button"
                            className="btn btn-secondary site-content-card-action"
                            onClick={startEditing}
                            disabled={busy}
                        >
                            Edit header
                        </button>
                    ) : null}
                </div>
                <div className="card-body site-content-form">
                    <p className="site-content-preview-eyebrow">{header.eyebrow}</p>
                    <h4 className="site-content-preview-title">{header.title}</h4>
                    <p className="site-content-preview-description">{header.description}</p>
                </div>
            </div>

            {editing ? (
                <SiteContentModal
                    title="Edit page header"
                    subtitle="Update the title and description shown in the purple hero section."
                    onClose={cancel}
                    footer={
                        <>
                            <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                                Save header
                            </button>
                        </>
                    }
                >
                    {/* Eyebrow editing disabled for now — fixed per page (About, Contact, etc.)
                    <label className="site-content-field">
                        <span>Eyebrow</span>
                        <input
                            className="form-input"
                            value={draft.eyebrow}
                            onChange={(event) => setDraft({ ...draft, eyebrow: event.target.value })}
                        />
                    </label>
                    */}
                    <div className="form-group">
                        <label htmlFor="page-header-title" className="form-label">
                            Title
                        </label>
                        <input
                            id="page-header-title"
                            className="form-input"
                            value={draft.title}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="page-header-description" className="form-label">
                            Description
                        </label>
                        <textarea
                            id="page-header-description"
                            className="form-input form-textarea"
                            rows={4}
                            value={draft.description}
                            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                        />
                    </div>
                </SiteContentModal>
            ) : null}
        </>
    );
}
