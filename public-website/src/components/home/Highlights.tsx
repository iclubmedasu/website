import { Section, Stat } from "@/components/ui";
import { homeContent } from "@/content/home";

export function Highlights() {
    const { items } = homeContent.highlights;

    return (
        <Section variant="tint" tight>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                {items.map((item) => (
                    <Stat key={item.label} value={item.value} label={item.label} />
                ))}
            </div>
        </Section>
    );
}
