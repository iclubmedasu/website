'use client';
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  extra?: string;
}

const Card = ({ children, className = "", extra = "", ...rest }: CardProps) => {
  const mergedClassName = [
    "rounded-[20px] bg-white p-4 shadow-sm dark:bg-navy-800 dark:text-white",
    className,
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={mergedClassName} {...rest}>
      {children}
    </div>
  );
};

export default Card;
