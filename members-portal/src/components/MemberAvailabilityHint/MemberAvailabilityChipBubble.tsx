'use client';

import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import MemberAvailabilityHint from './MemberAvailabilityHint';
import type {
    AvailabilityConflict,
    AvailabilityStatus,
} from '@/features/Announcements/announcementAvailability';
import './MemberAvailabilityHint.css';

const SHOW_DELAY_MS = 1000;
const GAP_PX = 4;

interface MemberAvailabilityChipBubbleProps {
    children: ReactNode;
    status: AvailabilityStatus;
    periodsLabel?: string;
    conflict?: AvailabilityConflict;
    conflictNote?: string | null;
    announcementTitle?: string | null;
}

interface BubbleCoords {
    left: number;
    bottom: number;
}

export default function MemberAvailabilityChipBubble({
    children,
    status,
    periodsLabel = '',
    conflict = 'none',
    conflictNote = null,
    announcementTitle = null,
}: MemberAvailabilityChipBubbleProps) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<BubbleCoords | null>(null);

    const clearShowTimer = () => {
        if (showTimerRef.current != null) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
    };

    const hide = () => {
        clearShowTimer();
        setOpen(false);
        setCoords(null);
    };

    const measure = () => {
        const el = anchorRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left,
            bottom: window.innerHeight - rect.top + GAP_PX,
        };
    };

    const handlePointerEnter = () => {
        clearShowTimer();
        showTimerRef.current = setTimeout(() => {
            showTimerRef.current = null;
            const next = measure();
            if (!next) return;
            setCoords(next);
            setOpen(true);
        }, SHOW_DELAY_MS);
    };

    useEffect(() => () => clearShowTimer(), []);

    useEffect(() => {
        if (!open) return;

        const update = () => {
            const next = measure();
            if (!next) {
                hide();
                return;
            }
            setCoords(next);
        };

        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open]);

    return (
        <div
            ref={anchorRef}
            className="member-assign-option"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={hide}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    hide();
                }
            }}
        >
            {children}
            {open && coords && typeof document !== 'undefined'
                ? createPortal(
                    <div
                        className="member-availability-chip-bubble"
                        style={{
                            position: 'fixed',
                            left: coords.left,
                            bottom: coords.bottom,
                            zIndex: 1200,
                        }}
                        role="tooltip"
                    >
                        <MemberAvailabilityHint
                            status={status}
                            periodsLabel={periodsLabel}
                            conflict={conflict}
                            conflictNote={conflictNote}
                            announcementTitle={announcementTitle}
                            compact
                        />
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
