import Image from "next/image";

const ICLUB_FULL_LOGO = "/images/iclub_full_colored_transparent_outlined_logo.png";
const IHUB_FULL_LOGO = "/images/ihub_full_colored_transparent_logo_outlined.png";

interface BrandLogosProps {
    variant?: "default" | "footer";
}

export function BrandLogos({ variant = "default" }: BrandLogosProps) {
    const className = variant === "footer" ? "brand-logos brand-logos--footer" : "brand-logos";

    return (
        <div className={className}>
            <div className="brand-logos-slot brand-logos-slot--iclub">
                <Image
                    src={ICLUB_FULL_LOGO}
                    alt="iClub, MED-ASU"
                    width={1737}
                    height={1066}
                    className="brand-logos-image"
                    priority={variant === "footer"}
                />
            </div>
            <div className="brand-logos-slot brand-logos-slot--ihub">
                <Image
                    src={IHUB_FULL_LOGO}
                    alt="iHub"
                    width={3955}
                    height={2772}
                    className="brand-logos-image"
                    priority={variant === "footer"}
                />
            </div>
        </div>
    );
}
