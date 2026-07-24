"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PublicEventPhoto } from "@iclub/shared";
import { getPublicEventPhotoUrl } from "@/lib/api";
import "./EventCircularGallery.css";

const CircularGallery = dynamic(() => import("./CircularGallery"), {
    ssr: false,
    loading: () => <div className="event-circular-gallery-fallback" aria-hidden />,
});

interface EventCircularGalleryProps {
    photos: PublicEventPhoto[];
}

export function EventCircularGallery({ photos }: EventCircularGalleryProps) {
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(min-width: 1024px)");
        const sync = () => setIsDesktop(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    const items = photos
        .map((photo) => {
            const image = getPublicEventPhotoUrl(photo.downloadUrl);
            if (!image) return null;
            return { image, text: photo.caption?.trim() || "" };
        })
        .filter((item): item is { image: string; text: string } => item != null);

    if (items.length === 0) return null;

    return (
        <div
            className={`event-circular-gallery${isDesktop ? "" : " event-circular-gallery--horizontal"}`}
            aria-label="Event photo gallery"
        >
            <CircularGallery
                key={isDesktop ? "vertical" : "horizontal"}
                items={items}
                bend={isDesktop ? 2 : 1.2}
                borderRadius={0.08}
                orientation={isDesktop ? "vertical" : "horizontal"}
                scrollEase={0.025}
                scrollSpeed={isDesktop ? 1.0 : 3.0}
                autoplayIntervalMs={3000}
                textColor="#4c1d95"
                font="bold 28px Poppins, ui-sans-serif, system-ui, sans-serif"
            />
        </div>
    );
}
