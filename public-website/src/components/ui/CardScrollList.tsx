import type { ReactNode } from "react";

interface CardScrollListProps {
    children: ReactNode;
    className?: string;
}

export function CardScrollList({ children, className }: CardScrollListProps) {
    return (
        <div className={className ? `card-scroll ${className}` : "card-scroll"} role="list">
            {children}
        </div>
    );
}

interface CardScrollItemProps {
    children: ReactNode;
}

export function CardScrollItem({ children }: CardScrollItemProps) {
    return (
        <div className="card-scroll-item" role="listitem">
            {children}
        </div>
    );
}
