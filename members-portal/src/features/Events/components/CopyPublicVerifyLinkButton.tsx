'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { buildPublicVerifyUrl } from '@/lib/publicWebsiteUrl';

interface CopyPublicVerifyLinkButtonProps {
    verificationCode: string;
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

export default function CopyPublicVerifyLinkButton({
    verificationCode,
}: CopyPublicVerifyLinkButtonProps) {
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    const handleCopy = useCallback(async () => {
        const code = verificationCode.trim();
        if (!code) return;

        const url = await buildPublicVerifyUrl(code);
        const ok = await copyTextToClipboard(url);
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
        }
        if (!ok) {
            setCopied(false);
            setCopyFailed(true);
            resetTimerRef.current = setTimeout(() => setCopyFailed(false), 2000);
            return;
        }

        setCopyFailed(false);
        setCopied(true);
        resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }, [verificationCode]);

    return (
        <div className="event-expanded-copy-link">
            <button
                type="button"
                className="event-expanded-copy-link-btn"
                onClick={() => void handleCopy()}
                aria-label="Copy certificate verification link"
                title="Copy certificate verification link"
            >
                <Link2 size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            {copied ? (
                <span className="event-expanded-copy-link-feedback" aria-live="polite">
                    Copied!
                </span>
            ) : copyFailed ? (
                <span className="event-expanded-copy-link-feedback" aria-live="polite">
                    Couldn&apos;t copy
                </span>
            ) : null}
        </div>
    );
}
