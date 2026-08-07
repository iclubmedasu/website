import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { siteConfig } from "@/lib/site";
import "../globals.css";
import "./embed.css";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-poppins",
});

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
        <html lang="en" className={poppins.variable}>
            <body className="embed-body">{children}</body>
        </html>
    );
}
