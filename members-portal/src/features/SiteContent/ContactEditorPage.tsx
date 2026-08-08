'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { EditorContactPage, EditorContactMethod, EditorSocialLink, SitePageHeader } from '@iclub/shared';
import { useAuth } from '@/context/AuthContext';
import { siteContentAPI } from '@/services/api';
import { PageHeaderEditor } from './components/PageHeaderEditor';
import { SiteContentRowActions } from './components/SiteContentRowActions';
import { EditContactMethodModal } from './modals/EditContactMethodModal';
import { EditSocialLinkModal } from './modals/EditSocialLinkModal';
import './SiteContent.css';
import '@/components/modal/modal.css';
import '@/components/table/table.css';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function ContactEditorPage() {
    const { user } = useAuth();
    const router = useRouter();
    const canEdit = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);

    const [page, setPage] = useState<EditorContactPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [editingMethod, setEditingMethod] = useState<EditorContactMethod | null>(null);
    const [editingLink, setEditingLink] = useState<EditorSocialLink | null>(null);
    const [showMethodModal, setShowMethodModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = (await siteContentAPI.getContact()) as EditorContactPage;
            setPage(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load contact page'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        if (!canEdit) {
            router.replace('/help');
        }
    }, [user, canEdit, router]);

    useEffect(() => {
        void loadPage();
    }, [loadPage]);

    const saveHeader = async (header: SitePageHeader) => {
        setBusy(true);
        try {
            await siteContentAPI.updateContactHeader(header);
            setPage((current) => (current ? { ...current, header } : current));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save header'));
        } finally {
            setBusy(false);
        }
    };

    const moveItem = async (
        items: { id: number }[],
        index: number,
        direction: -1 | 1,
        reorderFn: (orderedIds: number[]) => Promise<unknown>,
    ) => {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const orderedIds = items.map((item) => item.id);
        [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
        setBusy(true);
        try {
            const updated = (await reorderFn(orderedIds)) as EditorContactPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to reorder items'));
        } finally {
            setBusy(false);
        }
    };

    const deleteMethod = async (methodId: number) => {
        if (!window.confirm('Delete this contact method?')) return;
        setBusy(true);
        try {
            const updated = (await siteContentAPI.deleteContactMethod(methodId)) as EditorContactPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete contact method'));
        } finally {
            setBusy(false);
        }
    };

    const deleteLink = async (linkId: number) => {
        if (!window.confirm('Delete this social link?')) return;
        setBusy(true);
        try {
            const updated = (await siteContentAPI.deleteSocialLink(linkId)) as EditorContactPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete social link'));
        } finally {
            setBusy(false);
        }
    };

    if (!canEdit) {
        return <div className="members-page site-content-page"><p>Redirecting…</p></div>;
    }

    if (loading) {
        return <div className="members-page site-content-page"><p>Loading contact page…</p></div>;
    }

    return (
        <div className="members-page site-content-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Contact Page</h1>
                <p className="site-content-subtitle">Manage the public website contact page header, methods, and social links.</p>
            </div>

            <hr className="title-divider" />

            {!canEdit ? (
                <div className="card site-content-readonly">
                    <p>You can view this page, but only officers and administration can edit site content.</p>
                </div>
            ) : null}

            {error ? <p className="site-content-error">{error}</p> : null}

            {page ? (
                <>
                    <PageHeaderEditor
                        header={page.header}
                        canEdit={canEdit}
                        busy={busy}
                        onSave={saveHeader}
                        description="Purple hero section at the top of the public contact page."
                    />

                    <div className="card site-content-sections-card">
                        <div className="card-header">
                            <div className="card-header-with-action">
                                <div className="card-header-left">
                                    <h3 className="card-title">Contact methods</h3>
                                </div>
                                {canEdit ? (
                                    <button
                                        type="button"
                                        className="card-add-btn"
                                        onClick={() => setShowMethodModal(true)}
                                        disabled={busy}
                                        title="Add method"
                                        aria-label="Add contact method"
                                    >
                                        <Plus />
                                    </button>
                                ) : null}
                            </div>
                            <p className="card-subtitle">Email, phone, address, and other ways to reach the club.</p>
                        </div>
                        <div className="card-body site-content-section-list">
                            {page.methods.map((method, index) => (
                                <div key={method.id} className="site-content-section-row">
                                    <div>
                                        <p className="site-content-section-type">{method.type}</p>
                                        <h4 className="site-content-section-title">{method.label}</h4>
                                        <p className="site-content-section-meta">{method.value}</p>
                                        {!method.isActive ? <span className="site-content-badge">Hidden</span> : null}
                                    </div>
                                    {canEdit ? (
                                        <SiteContentRowActions
                                            busy={busy}
                                            canMoveUp={index > 0}
                                            canMoveDown={index < page.methods.length - 1}
                                            onMoveUp={() =>
                                                moveItem(page.methods, index, -1, siteContentAPI.reorderContactMethods)
                                            }
                                            onMoveDown={() =>
                                                moveItem(page.methods, index, 1, siteContentAPI.reorderContactMethods)
                                            }
                                            onEdit={() => setEditingMethod(method)}
                                            onDelete={() => deleteMethod(method.id)}
                                            ariaLabel={`Actions for contact method`}
                                            editLabel="Edit method"
                                            deleteLabel="Delete method"
                                        />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card site-content-sections-card">
                        <div className="card-header">
                            <div className="card-header-with-action">
                                <div className="card-header-left">
                                    <h3 className="card-title">Social links</h3>
                                </div>
                                {canEdit ? (
                                    <button
                                        type="button"
                                        className="card-add-btn"
                                        onClick={() => setShowLinkModal(true)}
                                        disabled={busy}
                                        title="Add link"
                                        aria-label="Add social link"
                                    >
                                        <Plus />
                                    </button>
                                ) : null}
                            </div>
                            <p className="card-subtitle">Shown on the contact page and site footer.</p>
                        </div>
                        <div className="card-body site-content-section-list">
                            {page.socialLinks.map((link, index) => (
                                <div key={link.id} className="site-content-section-row">
                                    <div>
                                        <p className="site-content-section-type">{link.platform}</p>
                                        <h4 className="site-content-section-title">{link.url}</h4>
                                        {!link.isActive ? <span className="site-content-badge">Hidden</span> : null}
                                    </div>
                                    {canEdit ? (
                                        <SiteContentRowActions
                                            busy={busy}
                                            canMoveUp={index > 0}
                                            canMoveDown={index < page.socialLinks.length - 1}
                                            onMoveUp={() =>
                                                moveItem(page.socialLinks, index, -1, siteContentAPI.reorderSocialLinks)
                                            }
                                            onMoveDown={() =>
                                                moveItem(page.socialLinks, index, 1, siteContentAPI.reorderSocialLinks)
                                            }
                                            onEdit={() => setEditingLink(link)}
                                            onDelete={() => deleteLink(link.id)}
                                            ariaLabel={`Actions for social link`}
                                            editLabel="Edit link"
                                            deleteLabel="Delete link"
                                        />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}

            {showMethodModal ? (
                <EditContactMethodModal
                    onClose={() => setShowMethodModal(false)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setShowMethodModal(false);
                    }}
                />
            ) : null}

            {editingMethod ? (
                <EditContactMethodModal
                    method={editingMethod}
                    onClose={() => setEditingMethod(null)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setEditingMethod(null);
                    }}
                />
            ) : null}

            {showLinkModal ? (
                <EditSocialLinkModal
                    onClose={() => setShowLinkModal(false)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setShowLinkModal(false);
                    }}
                />
            ) : null}

            {editingLink ? (
                <EditSocialLinkModal
                    link={editingLink}
                    onClose={() => setEditingLink(null)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setEditingLink(null);
                    }}
                />
            ) : null}
        </div>
    );
}
