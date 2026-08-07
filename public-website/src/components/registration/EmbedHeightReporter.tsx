"use client";

import { useEffect, useRef } from "react";

const MESSAGE_TYPE = "iclub-embed-resize";

/**
 * Reports the embed document height to the parent window via postMessage
 * so the shared loader script can auto-resize the iframe.
 */
export function EmbedHeightReporter({ targetOrigin = "*" }: { targetOrigin?: string }) {
    const lastHeightRef = useRef(0);

    useEffect(() => {
        if (typeof window === "undefined" || window.parent === window) {
            return undefined;
        }

        const report = () => {
            const root = document.querySelector(".embed-root") as HTMLElement | null;
            const height = Math.ceil(
                Math.max(
                    root?.scrollHeight ?? 0,
                    root?.offsetHeight ?? 0,
                    document.documentElement.scrollHeight,
                    document.body.scrollHeight,
                ),
            );

            if (!height || height === lastHeightRef.current) {
                return;
            }

            lastHeightRef.current = height;
            window.parent.postMessage(
                { type: MESSAGE_TYPE, height, source: "iclub-registration-embed" },
                targetOrigin,
            );
        };

        report();

        const observer = new ResizeObserver(() => {
            report();
        });
        observer.observe(document.body);
        const root = document.querySelector(".embed-root");
        if (root) observer.observe(root);

        window.addEventListener("load", report);
        const intervalId = window.setInterval(report, 500);

        return () => {
            observer.disconnect();
            window.removeEventListener("load", report);
            window.clearInterval(intervalId);
        };
    }, [targetOrigin]);

    return null;
}

export const EMBED_RESIZE_MESSAGE_TYPE = MESSAGE_TYPE;
