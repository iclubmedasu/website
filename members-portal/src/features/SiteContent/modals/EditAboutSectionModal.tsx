'use client';

import { useState } from 'react';
import type { EditorAboutPage, EditorAboutSection } from '@iclub/shared';
import { Plus, Trash2 } from 'lucide-react';
import { siteContentAPI } from '@/services/api';
import { SiteContentModal } from '../components/SiteContentModal';

interface EditAboutSectionModalProps {
    section: EditorAboutSection;
    onClose: () => void;
    onSaved: (page: EditorAboutPage) => void;
    onPartialSave: (page: EditorAboutPage) => void;
}

export function EditAboutSectionModal({ section, onClose, onSaved, onPartialSave }: EditAboutSectionModalProps) {
    const [title, setTitle] = useState(section.title);
    const [leftLabel, setLeftLabel] = useState(section.type === 'TWO_COLUMN' ? section.leftLabel : '');
    const [leftText, setLeftText] = useState(section.type === 'TWO_COLUMN' ? section.leftText : '');
    const [rightLabel, setRightLabel] = useState(section.type === 'TWO_COLUMN' ? section.rightLabel : '');
    const [rightText, setRightText] = useState(section.type === 'TWO_COLUMN' ? section.rightText : '');
    const [bullets, setBullets] = useState(section.type === 'BULLET_LIST' ? [...section.bullets] : ['']);
    const [emptyMessage, setEmptyMessage] = useState(section.type === 'SPONSORS' ? section.emptyMessage ?? '' : '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const saveSection = async () => {
        setBusy(true);
        setError('');
        try {
            const payload =
                section.type === 'TWO_COLUMN'
                    ? { title, leftLabel, leftText, rightLabel, rightText }
                    : section.type === 'BULLET_LIST'
                      ? { title, bullets: bullets.filter((item) => item.trim()) }
                      : { title, emptyMessage };

            const updated = (await siteContentAPI.updateAboutSection(section.id, payload)) as EditorAboutPage;
            onSaved(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save section');
        } finally {
            setBusy(false);
        }
    };

    const addSponsor = async () => {
        if (section.type !== 'SPONSORS') return;
        setBusy(true);
        setError('');
        try {
            const updated = (await siteContentAPI.createSponsor(section.id, {
                name: 'New sponsor',
            })) as EditorAboutPage;
            onPartialSave(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add sponsor');
        } finally {
            setBusy(false);
        }
    };

    const updateSponsor = async (
        sponsorId: number,
        payload: { name?: string; description?: string; logoUrl?: string; websiteUrl?: string },
    ) => {
        if (section.type !== 'SPONSORS') return;
        setBusy(true);
        setError('');
        try {
            const updated = (await siteContentAPI.updateSponsor(section.id, sponsorId, payload)) as EditorAboutPage;
            onPartialSave(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update sponsor');
        } finally {
            setBusy(false);
        }
    };

    const removeSponsor = async (sponsorId: number) => {
        if (section.type !== 'SPONSORS') return;
        if (!window.confirm('Delete this sponsor?')) return;
        setBusy(true);
        setError('');
        try {
            const updated = (await siteContentAPI.deleteSponsor(section.id, sponsorId)) as EditorAboutPage;
            onPartialSave(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete sponsor');
        } finally {
            setBusy(false);
        }
    };

    const currentSponsors = section.type === 'SPONSORS' ? section.sponsors : [];

    return (
        <SiteContentModal
            title="Edit section"
            onClose={onClose}
            wide
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void saveSection()} disabled={busy}>
                        Save section
                    </button>
                </>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}

            <div className="form-group">
                <label htmlFor="about-section-title" className="form-label">
                    Title
                </label>
                <input
                    id="about-section-title"
                    className="form-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </div>

            {section.type === 'TWO_COLUMN' ? (
                <>
                    <div className="form-group">
                        <label htmlFor="about-section-left-label" className="form-label">
                            Left label
                        </label>
                        <input
                            id="about-section-left-label"
                            className="form-input"
                            value={leftLabel}
                            onChange={(event) => setLeftLabel(event.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="about-section-left-text" className="form-label">
                            Left text
                        </label>
                        <textarea
                            id="about-section-left-text"
                            className="form-input form-textarea"
                            rows={4}
                            value={leftText}
                            onChange={(event) => setLeftText(event.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="about-section-right-label" className="form-label">
                            Right label
                        </label>
                        <input
                            id="about-section-right-label"
                            className="form-input"
                            value={rightLabel}
                            onChange={(event) => setRightLabel(event.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="about-section-right-text" className="form-label">
                            Right text
                        </label>
                        <textarea
                            id="about-section-right-text"
                            className="form-input form-textarea"
                            rows={4}
                            value={rightText}
                            onChange={(event) => setRightText(event.target.value)}
                        />
                    </div>
                </>
            ) : null}

            {section.type === 'BULLET_LIST' ? (
                <div className="site-content-field">
                    <span>Bullet points</span>
                    {bullets.map((bullet, index) => (
                        <div key={`bullet-${index}`} className="site-content-bullet-row">
                            <input
                                className="form-input"
                                value={bullet}
                                onChange={(event) => {
                                    const next = [...bullets];
                                    next[index] = event.target.value;
                                    setBullets(next);
                                }}
                            />
                            <button
                                type="button"
                                className="btn btn-danger btn-icon"
                                onClick={() => setBullets(bullets.filter((_, itemIndex) => itemIndex !== index))}
                                aria-label="Remove bullet"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    <button type="button" className="btn btn-secondary site-content-inline-action" onClick={() => setBullets([...bullets, ''])}>
                        <Plus size={16} aria-hidden />
                        <span>Add bullet</span>
                    </button>
                </div>
            ) : null}

            {section.type === 'SPONSORS' ? (
                <>
                    <div className="form-group">
                        <label htmlFor="about-section-empty-message" className="form-label">
                            Empty message
                        </label>
                        <textarea
                            id="about-section-empty-message"
                            className="form-input form-textarea"
                            rows={2}
                            value={emptyMessage}
                            onChange={(event) => setEmptyMessage(event.target.value)}
                        />
                    </div>
                    <div className="site-content-field">
                        <span>Sponsors</span>
                        {currentSponsors.map((sponsor) => (
                            <div key={sponsor.id} className="site-content-sponsor-block">
                                <input
                                    className="form-input"
                                    defaultValue={sponsor.name}
                                    placeholder="Name"
                                    onBlur={(event) => void updateSponsor(sponsor.id, { name: event.target.value })}
                                />
                                <textarea
                                    className="form-input form-textarea"
                                    rows={2}
                                    defaultValue={sponsor.description ?? ''}
                                    placeholder="Description"
                                    onBlur={(event) => void updateSponsor(sponsor.id, { description: event.target.value })}
                                />
                                <input
                                    className="form-input"
                                    defaultValue={sponsor.logoUrl ?? ''}
                                    placeholder="Logo URL"
                                    onBlur={(event) => void updateSponsor(sponsor.id, { logoUrl: event.target.value })}
                                />
                                <input
                                    className="form-input"
                                    defaultValue={sponsor.websiteUrl ?? ''}
                                    placeholder="Website URL"
                                    onBlur={(event) => void updateSponsor(sponsor.id, { websiteUrl: event.target.value })}
                                />
                                <button type="button" className="btn btn-danger site-content-inline-action" onClick={() => void removeSponsor(sponsor.id)}>
                                    Remove sponsor
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-secondary site-content-inline-action" onClick={() => void addSponsor()} disabled={busy}>
                            <Plus size={16} aria-hidden />
                            <span>Add sponsor</span>
                        </button>
                    </div>
                </>
            ) : null}
        </SiteContentModal>
    );
}
