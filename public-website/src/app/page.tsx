import { AboutPreview } from "@/components/home/AboutPreview";
import { CtaBand } from "@/components/home/CtaBand";
import { HeroSection } from "@/components/home/HeroSection";
import { WhyIclub } from "@/components/home/WhyIclub";
import { HomeEventsSection } from "@/components/public-data/HomeEventsSection";
import { HomeProjectsSection } from "@/components/public-data/HomeProjectsSection";

export default function HomePage() {
    return (
        <>
            <HeroSection />
            <WhyIclub />
            <HomeEventsSection />
            <HomeProjectsSection />
            <AboutPreview />
            <CtaBand />
        </>
    );
}
