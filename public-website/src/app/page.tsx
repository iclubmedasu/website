import { AboutPreview } from "@/components/home/AboutPreview";
import { CtaBand } from "@/components/home/CtaBand";
import { HeroSection } from "@/components/home/HeroSection";
import { Highlights } from "@/components/home/Highlights";
import { WhyIclub } from "@/components/home/WhyIclub";
import { HomeEventsSection } from "@/components/public-data/HomeEventsSection";
import { HomeProjectsSection } from "@/components/public-data/HomeProjectsSection";
import { publicAPI } from "@/lib/api";

/** Home SSR-fetches highlights with cache: no-store. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
    const highlightPhotos = await publicAPI.getHighlightPhotos();

    return (
        <>
            <HeroSection />
            <Highlights photos={highlightPhotos} />
            <HomeEventsSection />
            <HomeProjectsSection />
            <WhyIclub />
            <AboutPreview />
            <CtaBand />
        </>
    );
}
