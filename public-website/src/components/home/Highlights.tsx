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

export function Highlights() {
    const [photos, setPhotos] = useState<PublicHighlightPhoto[] | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        void publicAPI
            .getHighlightPhotos()
            .then(setPhotos)
            .catch(() => setPhotos([]));
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

    const { title, description } = homeContent.highlights;

    // Horizontal card width in CircularGallery world units (fov 45, z 20, h*0.72, 16:9, 6% pad).
    // ~one card every 5s → moderate continuous drift.
    const continuousScrollSpeed =
        (2 * Math.tan((45 * Math.PI) / 360) * 20 * 0.72 * (16 / 9) * 1.06) / 5;

    return (
        <Section variant="plain">
            <SectionHeading title={title} description={description} />
            <div className="home-highlights-gallery" aria-label="Event photo highlights">
                <CircularGallery
                    items={items}
                    bend={1.2}
                    borderRadius={0.08}
                    scrollEase={0.05}
                    scrollSpeed={isDesktop ? 1.5 : 3.0}
                    continuousScrollSpeed={continuousScrollSpeed}
                    textColor="#4c1d95"
                    font="bold 24px Poppins, ui-sans-serif, system-ui, sans-serif"
                />
            </div>
        </Section>
    );
}
