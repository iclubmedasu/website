"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import iclubIcon from "@/assets/iclub_colored_transparent_outlined_icon.png";
import { navLinks, siteConfig } from "@/lib/site";

export function Navbar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <header className="site-header">
            <div className="gradient-bar h-1 w-full" />
            <div className="site-header-inner">
                <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                    <Image
                        src={iclubIcon}
                        alt={siteConfig.name}
                        className="site-header-logo"
                        priority
                    />
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`site-nav-link ${isActive(link.href) ? "site-nav-link--active" : ""}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-purple-200 p-2 text-purple-900 md:hidden"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    onClick={() => setMobileOpen((open) => !open)}
                >
                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {mobileOpen ? (
                <nav className="border-t border-purple-100 px-4 py-4 md:hidden">
                    <div className="flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className={`site-nav-link site-nav-link--mobile ${
                                    isActive(link.href) ? "site-nav-link--active" : ""
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </nav>
            ) : null}
        </header>
    );
}
