import { AboutPreview } from "@/components/home/AboutPreview";
import { CtaBand } from "@/components/home/CtaBand";
import { HeroSection } from "@/components/home/HeroSection";
// import { Highlights } from "@/components/home/Highlights";
// import { PastEventsPreview } from "@/components/home/PastEventsPreview";
import { RecentProjectsPreview } from "@/components/home/RecentProjectsPreview";
import { UpcomingEventsPreview } from "@/components/home/UpcomingEventsPreview";
import { WhyIclub } from "@/components/home/WhyIclub";
import { publicAPI } from "@/lib/api";

export default async function HomePage() {
    const [events, projects] = await Promise.all([
        publicAPI.getEvents({ limit: 3, upcoming: true }),
        publicAPI.getProjects({ limit: 3 }),
    ]);

    return (
        <>
            <HeroSection />
            {/* <Highlights /> */}
            <WhyIclub />
            <UpcomingEventsPreview events={events} />
            {/* <PastEventsPreview events={pastEvents} /> */}
            <RecentProjectsPreview projects={projects} />
            <AboutPreview />
            <CtaBand />
        </>
    );
}
