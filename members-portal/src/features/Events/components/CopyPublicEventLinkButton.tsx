'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { buildPublicEventUrl } from '@/lib/publicWebsiteUrl';

interface CopyPublicEventLinkButtonProps {
    eventId: number | string;
    isPublished?: boolean;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through
        }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}

export default function CopyPublicEventLinkButton({
    eventId,
    isPublished = false,
}: CopyPublicEventLinkButtonProps) {
    const [copied, setCopied] = useState(false);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    const handleCopy = useCallback(async () => {
        if (!isPublished) return;

        const url = buildPublicEventUrl(eventId);
        const ok = await copyTextToClipboard(url);
        if (!ok) {
            window.alert('Failed to copy link.');
            return;
        }

        setCopied(true);
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }, [eventId, isPublished]);

    const disabledTitle = 'Publish the event for the public link to work';

    return (
        <div className="event-expanded-copy-link">
            <button
                type="button"
                className="event-expanded-copy-link-btn"
                onClick={() => void handleCopy()}
                disabled={!isPublished}
                aria-label="Copy public event link"
                title={isPublished ? 'Copy public event link' : disabledTitle}
            >
                <Link2 size={22} strokeWidth={2} aria-hidden="true" />
            </button>
            {copied ? (
                <span className="event-expanded-copy-link-feedback" aria-live="polite">
                    Copied!
                </span>
            ) : null}
        </div>
    );
}
