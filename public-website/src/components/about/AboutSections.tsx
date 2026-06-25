import Image from "next/image";
import type { PublicAboutSection } from "@iclub/shared";
import { Section } from "@/components/ui";
import { sectionVariant } from "@/lib/siteContentFallback";

interface AboutSectionsProps {
    sections: PublicAboutSection[];
}

export function AboutSections({ sections }: AboutSectionsProps) {
    return (
        <>
            {sections.map((section, index) => (
                <Section key={section.id} variant={sectionVariant(index)}>
                    {section.type === "TWO_COLUMN" ? (
                        <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-sm sm:p-10">
                            <h2 className="text-2xl font-semibold text-purple-900">{section.title}</h2>
                            <div className="mt-6 grid gap-8 md:grid-cols-2">
                                <div>
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-700">
                                        {section.leftLabel}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600">{section.leftText}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-700">
                                        {section.rightLabel}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600">{section.rightText}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {section.type === "BULLET_LIST" ? (
                        <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-sm sm:p-10">
                            <h2 className="text-2xl font-semibold text-purple-900">{section.title}</h2>
                            <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                                {section.bullets.map((item) => (
                                    <li key={item} className="flex gap-3">
                                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-purple-700" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {section.type === "SPONSORS" ? (
                        <div
                            className={`rounded-3xl border p-8 sm:p-10 ${
                                section.sponsors.length === 0
                                    ? "border-dashed border-purple-200 bg-purple-50/40"
                                    : "border-purple-100 bg-white shadow-sm"
                            }`}
                        >
                            <h2 className="text-2xl font-semibold text-purple-900">{section.title}</h2>
                            {section.sponsors.length === 0 ? (
                                <p className="mt-4 text-sm text-slate-600">{section.emptyMessage}</p>
                            ) : (
                                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {section.sponsors.map((sponsor) => {
                                        const card = (
                                            <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
                                                {sponsor.logoUrl ? (
                                                    <div className="relative mb-4 h-16 w-full">
                                                        <Image
                                                            src={sponsor.logoUrl}
                                                            alt={sponsor.name}
                                                            fill
                                                            className="object-contain object-left"
                                                            unoptimized
                                                        />
                                                    </div>
                                                ) : null}
                                                <h3 className="text-lg font-semibold text-purple-900">{sponsor.name}</h3>
                                                {sponsor.description ? (
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">{sponsor.description}</p>
                                                ) : null}
                                            </div>
                                        );

                                        if (sponsor.websiteUrl) {
                                            return (
                                                <a
                                                    key={sponsor.id}
                                                    href={sponsor.websiteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block transition hover:opacity-90"
                                                >
                                                    {card}
                                                </a>
                                            );
                                        }

                                        return <div key={sponsor.id}>{card}</div>;
                                    })}
                                </div>
                            )}
                        </div>
                    ) : null}
                </Section>
            ))}
        </>
    );
}
