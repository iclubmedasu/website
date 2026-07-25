"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PublicHighlightPhoto } from "@iclub/shared";
import { Section, SectionHeading } from "@/components/ui";
import { homeContent } from "@/content/home";
import { getPublicEventPhotoUrl, publicAPI } from "@/lib/api";
import "@/components/events/circular-gallery/CircularGallery.css";
import "./Highlights.css";

const CircularGallery = dynamic(
    () => import("@/components/events/circular-gallery/CircularGallery"),
    {
        ssr: false,
        loading: () => <div className="home-highlights-gallery-fallback" aria-hidden />,
    },
);

const PRELOAD_COUNT = 4;

export function Highlights() {
    const [photos, setPhotos] = useState<PublicHighlightPhoto[] | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void publicAPI.getHighlightPhotos().then((next) => {
            if (!cancelled) setPhotos(next);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const media = window.matchMedia("(min-width: 1024px)");
        const sync = () => setIsDesktop(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    if (photos === null || photos.length === 0) {
        return null;
    }

    const items = photos
        .map((photo) => {
            const image = getPublicEventPhotoUrl(photo.downloadUrl);
            if (!image) return null;
            return { image, text: photo.eventTitle };
        })
        .filter((item): item is { image: string; text: string } => item != null);

    if (items.length === 0) {
        return null;
    }

    const preloadUrls = items.slice(0, PRELOAD_COUNT).map((item) => item.image);
    const { title, description } = homeContent.highlights;

    // Horizontal card width in CircularGallery world units (fov 45, z 20, h*0.72, 16:9, 6% pad).
    // ~one card every 5s → moderate continuous drift.
    const continuousScrollSpeed =
        (2 * Math.tan((45 * Math.PI) / 360) * 20 * 0.72 * (16 / 9) * 1.06) / 5;

    return (
        <Section variant="plain">
            {preloadUrls.map((url) => (
                <link key={url} rel="preload" as="image" href={url} />
            ))}
            <SectionHeading title={title} description={description} />
            <div className="home-highlights-gallery" aria-label="Event photo highlights">
                <CircularGallery
                    items={items}
                    bend={1.2}
                    borderRadius={0.08}
                    planeHeightRatio={isDesktop ? 0.72 : 0.5}
                    scrollEase={0.1}
                    scrollSpeed={isDesktop ? 1.8 : 2.0}
                    continuousScrollSpeed={continuousScrollSpeed}
                    textColor="#4c1d95"
                    font="bold 24px Poppins, ui-sans-serif, system-ui, sans-serif"
                />
            </div>
        </Section>
    );
}
