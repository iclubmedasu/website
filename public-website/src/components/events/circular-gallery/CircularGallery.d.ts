import type { ComponentType } from "react";

export interface CircularGalleryItem {
    image: string;
    text: string;
}

export interface CircularGalleryProps {
    items?: CircularGalleryItem[];
    bend?: number;
    textColor?: string;
    borderRadius?: number;
    font?: string;
    fontUrl?: string;
    scrollSpeed?: number;
    scrollEase?: number;
    orientation?: "horizontal" | "vertical";
    /** When set, advances one card every N ms (pauses while dragging). */
    autoplayIntervalMs?: number;
}

declare const CircularGallery: ComponentType<CircularGalleryProps>;
export default CircularGallery;
