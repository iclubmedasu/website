import Image from "next/image";
import iclubFullLogo from "@/assets/iclub_full_colored_transparent_outlined_logo.png";
import ihubFullLogo from "@/assets/ihub_full_colored_transparent_logo_outlined.png";

interface BrandLogosProps {
    variant?: "default" | "footer";
}

export function BrandLogos({ variant = "default" }: BrandLogosProps) {
    const className = variant === "footer" ? "brand-logos brand-logos--footer" : "brand-logos";

    return (
        <div className={className}>
            <div className="brand-logos-slot brand-logos-slot--iclub">
                <Image
                    src={iclubFullLogo}
                    alt="iClub, MED-ASU"
                    className="brand-logos-image"
                    priority={variant === "footer"}
                />
            </div>
            <div className="brand-logos-slot brand-logos-slot--ihub">
                <Image
                    src={ihubFullLogo}
                    alt="iHub"
                    className="brand-logos-image"
                    priority={variant === "footer"}
                />
            </div>
        </div>
    );
}
