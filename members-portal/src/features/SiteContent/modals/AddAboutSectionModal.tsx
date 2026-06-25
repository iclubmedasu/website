'use client';

import { useState } from 'react';
import type { AboutSectionType, EditorAboutPage } from '@iclub/shared';
import { siteContentAPI } from '@/services/api';
import { SiteContentModal } from '../components/SiteContentModal';

interface AddAboutSectionModalProps {
    onClose: () => void;
    onCreated: (page: EditorAboutPage) => void;
}

const SECTION_TYPES: { type: AboutSectionType; label: string; description: string }[] = [
    {
        type: 'TWO_COLUMN',
        label: 'Two-column',
        description: 'Title with two labeled text blocks, such as mission and vision.',
    },
    {
        type: 'BULLET_LIST',
        label: 'Bullet list',
        description: 'Title with a list of bullet points.',
    },
    {
        type: 'SPONSORS',
        label: 'Sponsors',
        description: 'Title with sponsor cards including name, description, logo URL, and website.',
    },
];

export function AddAboutSectionModal({ onClose, onCreated }: AddAboutSectionModalProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const createSection = async (type: AboutSectionType) => {
        setBusy(true);
        setError('');
        try {
            const payload =
                type === 'TWO_COLUMN'
                    ? {
                          type,
                          title: 'New section',
                          leftLabel: 'Left',
                          leftText: '',
                          rightLabel: 'Right',
                          rightText: '',
                      }
                    : type === 'BULLET_LIST'
                      ? { type, title: 'New section', bullets: [''] }
                      : { type, title: 'Partners & Sponsors', emptyMessage: 'Coming soon.' };

            const result = (await siteContentAPI.createAboutSection(payload)) as { page: EditorAboutPage };
            onCreated(result.page);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create section');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title="Add section"
            subtitle="Choose the section type for the public about page."
            onClose={onClose}
            footer={
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                    Cancel
                </button>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}
            <div className="site-content-type-picker">
                {SECTION_TYPES.map((option) => (
                    <button
                        key={option.type}
                        type="button"
                        className="site-content-type-option"
                        disabled={busy}
                        onClick={() => void createSection(option.type)}
                    >
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                    </button>
                ))}
            </div>
        </SiteContentModal>
    );
}
