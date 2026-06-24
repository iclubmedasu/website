import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { aboutContent } from "@/content/about";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "About",
    description: `Learn about ${siteConfig.name}, our mission, and what we do.`,
};

export default function AboutPage() {
    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="About"
                    title={siteConfig.name}
                    description={siteConfig.description}
                />
            </Section>

            <Section variant="plain">
                <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-sm sm:p-10">
                    <h2 className="text-2xl font-semibold text-purple-900">{aboutContent.mission.title}</h2>
                    <div className="mt-6 grid gap-8 md:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-700">Mission</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-600">{aboutContent.mission.missionText}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-700">Vision</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-600">{aboutContent.mission.visionText}</p>
                        </div>
                    </div>
                </div>
            </Section>

            <Section variant="tint">
                <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-sm sm:p-10">
                    <h2 className="text-2xl font-semibold text-purple-900">{aboutContent.whatWeDo.title}</h2>
                    <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                        {aboutContent.whatWeDo.items.map((item) => (
                            <li key={item} className="flex gap-3">
                                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-purple-700" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </Section>

            <Section variant="plain">
                <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 p-8 sm:p-10">
                    <h2 className="text-2xl font-semibold text-purple-900">{aboutContent.partners.title}</h2>
                    <p className="mt-4 text-sm text-slate-600">{aboutContent.partners.emptyMessage}</p>
                </div>
            </Section>
        </>
    );
}
