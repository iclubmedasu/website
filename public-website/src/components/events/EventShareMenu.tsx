"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import {
    buildEmailShareUrl,
    buildPublicEventUrl,
    buildShareMessage,
    buildSmsShareUrl,
    buildWhatsAppShareUrl,
    canUseNativeShare,
    copyTextToClipboard,
    shareViaNative,
} from "@/lib/share";
import "./event-share.css";

interface EventShareMenuProps {
    eventId: number;
    eventTitle: string;
    className?: string;
}

export function EventShareMenu({
    eventId,
    eventTitle,
    className = "",
}: EventShareMenuProps) {
    const menuId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const url = buildPublicEventUrl(eventId);
    const message = buildShareMessage(eventTitle, url);
    const showNativeShare = canUseNativeShare();

    const closeMenu = useCallback(() => {
        setOpen(false);
    }, []);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                closeMenu();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeMenu();
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, closeMenu]);

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current);
            }
        };
    }, []);

    const stopPropagation = (event: React.MouseEvent | React.KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        stopPropagation(event);
        setOpen((prev) => !prev);
        setCopied(false);
    };

    const handleCopyLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
        stopPropagation(event);
        const ok = await copyTextToClipboard(url);
        if (!ok) return;

        setCopied(true);
        if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
        }
        copiedTimerRef.current = setTimeout(() => {
            setCopied(false);
            closeMenu();
        }, 1200);
    };

    const handleNativeShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
        stopPropagation(event);
        const ok = await shareViaNative(eventTitle, url);
        if (ok) {
            closeMenu();
        }
    };

    const handleExternalLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
        stopPropagation(event);
        closeMenu();
    };

    return (
        <div
            ref={containerRef}
            className={`event-share ${className}`.trim()}
            onClick={stopPropagation}
            onKeyDown={stopPropagation}
        >
            <button
                type="button"
                className="event-share-trigger"
                aria-label="Share event"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls={open ? menuId : undefined}
                onClick={handleToggle}
            >
                <Share2 aria-hidden="true" />
            </button>

            {open ? (
                <div id={menuId} className="event-share-menu" role="menu">
                    <button
                        type="button"
                        role="menuitem"
                        className={`event-share-menu-item${copied ? " event-share-menu-item--copied" : ""}`}
                        onClick={(event) => void handleCopyLink(event)}
                    >
                        <Copy aria-hidden="true" />
                        {copied ? "Copied!" : "Copy link"}
                    </button>
                    <a
                        role="menuitem"
                        className="event-share-menu-item"
                        href={buildWhatsAppShareUrl(message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleExternalLink}
                    >
                        <MessageCircle aria-hidden="true" />
                        WhatsApp
                    </a>
                    <a
                        role="menuitem"
                        className="event-share-menu-item"
                        href={buildSmsShareUrl(message)}
                        onClick={handleExternalLink}
                    >
                        <MessageCircle aria-hidden="true" />
                        Message
                    </a>
                    <a
                        role="menuitem"
                        className="event-share-menu-item"
                        href={buildEmailShareUrl(eventTitle, message)}
                        onClick={handleExternalLink}
                    >
                        <Mail aria-hidden="true" />
                        Email
                    </a>
                    {showNativeShare ? (
                        <button
                            type="button"
                            role="menuitem"
                            className="event-share-menu-item"
                            onClick={(event) => void handleNativeShare(event)}
                        >
                            <Share2 aria-hidden="true" />
                            Share…
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
