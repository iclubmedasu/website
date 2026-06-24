import { Button } from "@/components/ui";
import { homeContent } from "@/content/home";

export function CtaBand() {
    const { title, text, primaryCta, secondaryCta } = homeContent.cta;

    return (
        <section className="section section--plain">
            <div className="section-inner section-inner--tight">
                <div className="cta-band section--band">
                    <div className="hero-glow" />
                    <div className="relative">
                        <h2 className="cta-band-title">{title}</h2>
                        <p className="cta-band-text">{text}</p>
                        <div className="cta-band-actions">
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
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
