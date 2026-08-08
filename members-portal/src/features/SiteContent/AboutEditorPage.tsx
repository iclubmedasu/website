'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { EditorAboutPage, EditorAboutSection, SitePageHeader } from '@iclub/shared';
import { useAuth } from '@/context/AuthContext';
import { siteContentAPI } from '@/services/api';
import { PageHeaderEditor } from './components/PageHeaderEditor';
import { SiteContentRowActions } from './components/SiteContentRowActions';
import { EditAboutSectionModal } from './modals/EditAboutSectionModal';
import { AddAboutSectionModal } from './modals/AddAboutSectionModal';
import './SiteContent.css';
import '@/components/modal/modal.css';
import '@/components/table/table.css';

function sectionTypeLabel(type: EditorAboutSection['type']): string {
    if (type === 'TWO_COLUMN') return 'Two-column';
    if (type === 'BULLET_LIST') return 'Bullet list';
    return 'Sponsors';
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function AboutEditorPage() {
    const { user } = useAuth();
    const router = useRouter();
    const canEdit = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);

    const [page, setPage] = useState<EditorAboutPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingSection, setEditingSection] = useState<EditorAboutSection | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [busy, setBusy] = useState(false);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = (await siteContentAPI.getAbout()) as EditorAboutPage;
            setPage(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load about page'));
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
            await siteContentAPI.updateAboutHeader(header);
            setPage((current) => (current ? { ...current, header } : current));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save header'));
        } finally {
            setBusy(false);
        }
    };

    const moveSection = async (index: number, direction: -1 | 1) => {
        if (!page) return;
        const target = index + direction;
        if (target < 0 || target >= page.sections.length) return;

        const orderedIds = page.sections.map((section) => section.id);
        [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];

        setBusy(true);
        try {
            const updated = (await siteContentAPI.reorderAboutSections(orderedIds)) as EditorAboutPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to reorder sections'));
        } finally {
            setBusy(false);
        }
    };

    const deleteSection = async (sectionId: number) => {
        if (!window.confirm('Delete this section?')) return;
        setBusy(true);
        try {
            const updated = (await siteContentAPI.deleteAboutSection(sectionId)) as EditorAboutPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete section'));
        } finally {
            setBusy(false);
        }
    };

    const handleSectionSaved = (updated: EditorAboutPage) => {
        setPage(updated);
        setEditingSection(null);
    };

    const handlePartialSectionSave = (updated: EditorAboutPage) => {
        setPage(updated);
        setEditingSection((current) => {
            if (!current) return current;
            return updated.sections.find((section) => section.id === current.id) ?? null;
        });
    };

    const handleSectionCreated = (updated: EditorAboutPage) => {
        setPage(updated);
        setShowAddModal(false);
    };

    if (!canEdit) {
        return <div className="members-page site-content-page"><p>Redirecting…</p></div>;
    }

    if (loading) {
        return <div className="members-page site-content-page"><p>Loading about page…</p></div>;
    }

    return (
        <div className="members-page site-content-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">About Page</h1>
                <p className="site-content-subtitle">Manage the public website about page content.</p>
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
                        description="Purple hero section at the top of the public about page."
                    />

                    <div className="card site-content-sections-card">
                        <div className="card-header">
                            <div className="card-header-with-action">
                                <div className="card-header-left">
                                    <h3 className="card-title">Sections</h3>
                                </div>
                                {canEdit ? (
                                    <button
                                        type="button"
                                        className="card-add-btn"
                                        onClick={() => setShowAddModal(true)}
                                        disabled={busy}
                                        title="Add section"
                                        aria-label="Add section"
                                    >
                                        <Plus />
                                    </button>
                                ) : null}
                            </div>
                            <p className="card-subtitle">Sections alternate white and purple on the public site.</p>
                        </div>

                        <div className="card-body site-content-section-list">
                            {page.sections.length === 0 ? (
                                <p className="site-content-empty">No sections yet.</p>
                            ) : (
                                page.sections.map((section, index) => (
                                    <div key={section.id} className="site-content-section-row">
                                        <div>
                                            <p className="site-content-section-type">{sectionTypeLabel(section.type)}</p>
                                            <h4 className="site-content-section-title">{section.title}</h4>
                                        </div>
                                        {canEdit ? (
                                            <SiteContentRowActions
                                                busy={busy}
                                                canMoveUp={index > 0}
                                                canMoveDown={index < page.sections.length - 1}
                                                onMoveUp={() => moveSection(index, -1)}
                                                onMoveDown={() => moveSection(index, 1)}
                                                onEdit={() => setEditingSection(section)}
                                                onDelete={() => deleteSection(section.id)}
                                                ariaLabel={`Actions for ${section.title}`}
                                                editLabel="Edit section"
                                                deleteLabel="Delete section"
                                            />
                                        ) : null}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : null}

            {showAddModal ? (
                <AddAboutSectionModal
                    onClose={() => setShowAddModal(false)}
                    onCreated={handleSectionCreated}
                />
            ) : null}

            {editingSection ? (
                <EditAboutSectionModal
                    section={editingSection}
                    onClose={() => setEditingSection(null)}
                    onSaved={handleSectionSaved}
                    onPartialSave={handlePartialSectionSave}
                />
            ) : null}
        </div>
    );
}
