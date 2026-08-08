import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/site";
import { arimo, poppins } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
    title: {
        default: siteConfig.name,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    openGraph: {
        title: siteConfig.name,
        description: siteConfig.description,
        siteName: siteConfig.name,
        type: "website",
    },
    icons: {
        icon: [{ url: "/favicon.ico", sizes: "any" }],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
};

export const viewport: Viewport = {
    themeColor: "#662f91",
};

export default function RootLayout({
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
            <body className="flex min-h-screen flex-col" suppressHydrationWarning>
                <Navbar />
                <main className="site-main">{children}</main>
                <Footer />
            </body>
        </html>
    );
}
