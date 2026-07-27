"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PublicProjectPhoto } from "@iclub/shared";
import { getPublicProjectPhotoUrl } from "@/lib/api";
import "@/components/events/circular-gallery/EventCircularGallery.css";

const CircularGallery = dynamic(() => import("@/components/events/circular-gallery/CircularGallery"), {
    ssr: false,
    loading: () => <div className="event-circular-gallery-fallback" aria-hidden />,
});

interface ProjectCircularGalleryProps {
    photos: PublicProjectPhoto[];
}

export function ProjectCircularGallery({ photos }: ProjectCircularGalleryProps) {
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
            const image = getPublicProjectPhotoUrl(photo.downloadUrl);
            if (!image) return null;
            return { image, text: photo.caption?.trim() || "" };
        })
        .filter((item): item is { image: string; text: string } => item != null);

    if (items.length === 0) return null;

    return (
        <div
            className={`event-circular-gallery${isDesktop ? "" : " event-circular-gallery--horizontal"}`}
            aria-label="Project photo gallery"
        >
            <CircularGallery
                key={isDesktop ? "vertical" : "horizontal"}
                items={items}
                bend={isDesktop ? 2 : 1.2}
                borderRadius={0.08}
                orientation={isDesktop ? "vertical" : "horizontal"}
                planeHeightRatio={isDesktop ? 0.72 : 0.5}
                scrollEase={0.08}
                scrollSpeed={isDesktop ? 1.4 : 2.0}
                autoplayIntervalMs={3000}
                textColor="#4c1d95"
                font="bold 28px Poppins, ui-sans-serif, system-ui, sans-serif"
            />
        </div>
    );
}
