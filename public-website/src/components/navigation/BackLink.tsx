import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import "./back-link.css";

interface BackLinkProps {
    href: string;
    label: string;
    className?: string;
}

export function BackLink({ href, label, className = "" }: BackLinkProps) {
    return (
        <Link href={href} className={`back-link ${className}`.trim()}>
            <ArrowLeft className="back-link-icon" aria-hidden="true" />
            <span>{label}</span>
        </Link>
    );
}
