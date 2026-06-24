import { BookOpen, Handshake, Lightbulb, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui";
import { homeContent } from "@/content/home";

const iconMap: LucideIcon[] = [BookOpen, Handshake, Users, Lightbulb];

export function WhyIclub() {
    const { title, description, items } = homeContent.whyIclub;

    return (
        <Section variant="plain">
            <SectionHeading title={title} description={description} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => {
                    const Icon = iconMap[index] ?? Lightbulb;
                    return (
                        <article key={item.title} className="value-card">
                            <span className="value-card-icon">
                                <Icon className="h-5 w-5" />
                            </span>
                            <h3 className="value-card-title">{item.title}</h3>
                            <p className="value-card-text">{item.text}</p>
                        </article>
                    );
                })}
            </div>
        </Section>
    );
}
