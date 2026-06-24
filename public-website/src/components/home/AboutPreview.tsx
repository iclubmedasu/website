import Link from "next/link";
import { Section } from "@/components/ui";
import { homeContent } from "@/content/home";

export function AboutPreview() {
    const { title, text, linkLabel, linkHref } = homeContent.aboutPreview;

    return (
        <Section variant="tint">
            <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-2xl font-semibold text-purple-900 sm:text-3xl">{title}</h2>
                <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{text}</p>
                <p className="mt-6">
                    <Link
                        href={linkHref}
                        className="text-sm font-semibold text-purple-800 underline-offset-4 hover:underline"
                    >
                        {linkLabel} →
                    </Link>
                </p>
            </div>
        </Section>
    );
}
