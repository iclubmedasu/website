'use client';

import { ChevronRight } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import type { Id } from '@/types/backend-contracts';

interface DocumentBreadcrumbProps {
    categoryName: string | null;
    onNavigateRoot: () => void;
    dropToRootEnabled?: boolean;
    onDropToRoot?: (documentId: Id) => void | Promise<void>;
}

export default function DocumentBreadcrumb({
    categoryName,
    onNavigateRoot,
    dropToRootEnabled = false,
    onDropToRoot,
}: DocumentBreadcrumbProps) {
    const [dragOverRoot, setDragOverRoot] = useState(false);

    const handleDragOver = (event: DragEvent) => {
        if (!dropToRootEnabled || !onDropToRoot) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverRoot(true);
    };

    const handleDragLeave = () => {
        setDragOverRoot(false);
    };

    const handleDrop = (event: DragEvent) => {
        if (!dropToRootEnabled || !onDropToRoot) return;
        event.preventDefault();
        setDragOverRoot(false);
        const raw = event.dataTransfer.getData('application/x-document-id');
        if (!raw) return;
        const documentId = Number(raw);
        if (!Number.isFinite(documentId)) return;
        void onDropToRoot(documentId);
    };

    return (
        <nav className="documents-breadcrumb" aria-label="Documents breadcrumb">
            <button
                type="button"
                className={`documents-breadcrumb-link${
                    dragOverRoot ? ' documents-breadcrumb-link--drag-over' : ''
                }`}
                onClick={onNavigateRoot}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                Documents
            </button>
            {categoryName ? (
                <>
                    <ChevronRight size={14} className="documents-breadcrumb-sep" aria-hidden />
                    <span className="documents-breadcrumb-current">{categoryName}</span>
                </>
            ) : null}
        </nav>
    );
}
