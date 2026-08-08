import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/lib/site";
import { arimo, poppins } from "../fonts";
import "../globals.css";
import "./embed.css";

export const metadata: Metadata = {
    title: {
        default: `Register | ${siteConfig.name}`,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    robots: {
        index: false,
        follow: false,
    },
};

export const viewport: Viewport = {
    themeColor: "#662f91",
};

export default function EmbedRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${poppins.variable} ${arimo.variable}`}
            suppressHydrationWarning
        >
            <body className="embed-body" suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
