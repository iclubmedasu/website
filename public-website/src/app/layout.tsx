import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-poppins",
});

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
        <html lang="en" className={poppins.variable}>
            <body className="flex min-h-screen flex-col">
                <Navbar />
                <main className="site-main">{children}</main>
                <Footer />
            </body>
        </html>
    );
}
