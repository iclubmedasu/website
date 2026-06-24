import { RubiksCube } from "@/components/home/RubiksCube";
import { siteConfig } from "@/lib/site";
// import { Button } from "@/components/ui";
// import { homeContent } from "@/content/home";

export function HeroSection() {
    // const { primaryCta, secondaryCta } = homeContent.hero;

    return (
        <section className="section section--band relative overflow-hidden">
            <div className="hero-glow" />
            <div className="hero-grid" />
            <div className="section-inner relative">
                <div className="hero-layout">
                    <div className="hero-layout-text">
                        <p className="eyebrow text-purple-200">{siteConfig.organization}</p>
                        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-[3.25rem]">
                            {siteConfig.name}
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-purple-100 sm:text-xl">
                            {siteConfig.tagline}
                        </p>
                        {/* <div className="mt-8 flex flex-wrap gap-4">
                            <Button href={primaryCta.href} className="bg-white text-purple-900 hover:bg-purple-50">
                                {primaryCta.label}
                            </Button>
                            <Button
                                href={secondaryCta.href}
                                variant="secondary"
                                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                            >
                                {secondaryCta.label}
                            </Button>
                        </div> */}
                    </div>
                    <RubiksCube />
                </div>
            </div>
        </section>
    );
}
