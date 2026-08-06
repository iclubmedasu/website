'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import IdCardDesignEditModal from './IdCardDesignEditModal';
import IdCardPreview from './IdCardPreview';
import {
    canvasSizeFromDesign,
    focusFromDesign,
    layoutFromDesign,
    sampleIdCardFieldValue,
} from './idCardFields';
import { useAuthorizedIdCardBackground } from './useAuthorizedIdCardBackground';
import './IdCardDesignPanel.css';

export interface IdCardDesignPanelProps {
    eventId: Id | string;
    fields?: EventCustomFieldRef[];
    tiers?: EventTierRef[];
    idCardDesign?: EventIdCardDesignRef | null;
    onReload: () => void;
}

export default function IdCardDesignPanel({
    eventId,
    fields = [],
    tiers = [],
    idCardDesign,
    onReload,
}: IdCardDesignPanelProps) {
    const [editOpen, setEditOpen] = useState(false);
    const size = canvasSizeFromDesign(idCardDesign);
    const elements = layoutFromDesign(idCardDesign);
    const hasBackground = Boolean(idCardDesign?.idCardBackgroundImageGithubPath);
    const backgroundUrl = useAuthorizedIdCardBackground(
        eventId,
        hasBackground,
        idCardDesign?.idCardBackgroundImageGithubSha
            ?? idCardDesign?.idCardBackgroundImageGithubPath,
    );
    const sampleTierName = tiers.find((tier) => tier.isActive !== false)?.name
        ?? tiers[0]?.name
        ?? null;

    const resolveSample = (fieldKey: string) => {
        if (fieldKey === 'tierName' && sampleTierName) return sampleTierName;
        return sampleIdCardFieldValue(fieldKey);
    };

    return (
        <aside className="id-card-design-panel" aria-label="ID card design">
            <div className="id-card-design-panel__header">
                <h3 className="expanded-section-title expanded-section-title--sm">ID card design</h3>
                <button
                    type="button"
                    className="btn btn-secondary id-card-design-panel__edit-btn"
                    onClick={() => setEditOpen(true)}
                >
                    <Pencil size={16} />
                    <span>Edit</span>
                </button>
            </div>

            <IdCardPreview
                elements={elements}
                canvasWidth={size.width}
                canvasHeight={size.height}
                backgroundImageUrl={backgroundUrl}
                backgroundFocus={focusFromDesign(idCardDesign)}
                resolveValue={resolveSample}
                qrValue="SAMPLE1234"
                label=""
            />

            {editOpen ? (
                <IdCardDesignEditModal
                    eventId={eventId}
                    fields={fields}
                    idCardDesign={idCardDesign}
                    onClose={() => setEditOpen(false)}
                    onReload={onReload}
                />
            ) : null}
        </aside>
    );
}
