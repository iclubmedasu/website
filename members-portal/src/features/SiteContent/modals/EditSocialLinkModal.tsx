'use client';

import { useState } from 'react';
import type { EditorContactPage, EditorSocialLink, SocialPlatform } from '@iclub/shared';
import { siteContentAPI } from '@/services/api';
import { PublicVisibilityToggle } from '../components/PublicVisibilityToggle';
import { SiteContentModal } from '../components/SiteContentModal';

interface EditSocialLinkModalProps {
    link?: EditorSocialLink;
    onClose: () => void;
    onSaved: (page: EditorContactPage) => void;
}

const PLATFORMS: SocialPlatform[] = ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'LINKEDIN', 'IHUB', 'OTHER'];

export function EditSocialLinkModal({ link, onClose, onSaved }: EditSocialLinkModalProps) {
    const [platform, setPlatform] = useState<SocialPlatform>(link?.platform ?? 'INSTAGRAM');
    const [url, setUrl] = useState(link?.url ?? '');
    const [isActive, setIsActive] = useState(link?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const payload = { platform, url, isActive };
            const updated = link
                ? ((await siteContentAPI.updateSocialLink(link.id, payload)) as EditorContactPage)
                : ((await siteContentAPI.createSocialLink(payload)) as EditorContactPage);
            onSaved(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save social link');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title={link ? 'Edit social link' : 'Add social link'}
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
                <label htmlFor="social-link-platform" className="form-label">
                    Platform
                </label>
                <select
                    id="social-link-platform"
                    className="form-input"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value as SocialPlatform)}
                >
                    {PLATFORMS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="social-link-url" className="form-label">
                    URL
                </label>
                <input id="social-link-url" className="form-input" value={url} onChange={(event) => setUrl(event.target.value)} />
            </div>
            <PublicVisibilityToggle checked={isActive} onChange={setIsActive} disabled={busy} />
        </SiteContentModal>
    );
}
