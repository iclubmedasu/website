import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageContainerProps {
    children: ReactNode;
    className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
    return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

type SectionVariant = "plain" | "subtle" | "tint" | "band";

interface SectionProps {
    children: ReactNode;
    variant?: SectionVariant;
    className?: string;
    innerClassName?: string;
    tight?: boolean;
    id?: string;
}

export function Section({
    children,
    variant = "plain",
    className = "",
    innerClassName = "",
    tight = false,
    id,
}: SectionProps) {
    const variantClass = `section--${variant}`;
    const innerPadding = tight ? "section-inner--tight" : "";

    return (
        <section id={id} className={`section ${variantClass} ${className}`}>
            <div className={`section-inner ${innerPadding} ${innerClassName}`}>{children}</div>
        </section>
    );
}

interface EyebrowProps {
    children: ReactNode;
    className?: string;
}

export function Eyebrow({ children, className = "" }: EyebrowProps) {
    return <p className={`eyebrow ${className}`}>{children}</p>;
}

interface PageHeaderProps {
    eyebrow: string;
    title: string;
    description?: string;
    children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
    return (
        <header className="page-header">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="page-header-title">{title}</h1>
            {description ? <p className="page-header-description">{description}</p> : null}
            {children}
        </header>
    );
}

interface StatProps {
    value: string;
    label: string;
}

export function Stat({ value, label }: StatProps) {
    return (
        <div className="text-center">
            <p className="stat-value">{value}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

interface BadgeProps {
    children: ReactNode;
    variant?: "purple" | "neutral";
    className?: string;
}

export function Badge({ children, variant = "purple", className = "" }: BadgeProps) {
    return <span className={`badge badge--${variant} ${className}`}>{children}</span>;
}

interface SectionHeadingProps {
    title: string;
    description?: string;
    action?: {
        label: string;
        href: string;
    };
    className?: string;
}

export function SectionHeading({ title, description, action, className = "" }: SectionHeadingProps) {
    return (
        <div className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
            <div>
                <h2 className="section-heading-title">{title}</h2>
                {description ? <p className="section-heading-description">{description}</p> : null}
            </div>
            {action ? (
                <Link href={action.href} className="section-heading-action shrink-0">
                    {action.label}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            ) : null}
        </div>
    );
}

interface ButtonProps {
    children: ReactNode;
    href?: string;
    type?: "button" | "submit";
    variant?: "primary" | "secondary";
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
}

export function Button({
    children,
    href,
    type = "button",
    variant = "primary",
    disabled = false,
    className = "",
    onClick,
}: ButtonProps) {
    const variantClass = variant === "primary" ? "btn-primary" : "btn-secondary";

    if (href) {
        return (
            <Link href={href} className={`${variantClass} ${className}`}>
                {children}
            </Link>
        );
    }

    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`${variantClass} ${className}`}
        >
            {children}
        </button>
    );
}

interface EmptyStateProps {
    title: string;
    description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <h3 className="empty-state-title">{title}</h3>
            <p className="empty-state-text">{description}</p>
        </div>
    );
}
