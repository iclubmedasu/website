import { useEffect, useMemo, useRef, useState } from "react";
import { matchEmailDomainSuggestions } from "@iclub/shared/utils";

interface EmailInputWithDomainSuggestionsProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    "aria-label"?: string;
}

function getLocalPart(value: string): string {
    const atIndex = value.lastIndexOf("@");
    if (atIndex === -1) return value;
    return value.slice(0, atIndex);
}

export default function EmailInputWithDomainSuggestions({
    id,
    value,
    onChange,
    className,
    placeholder,
    disabled = false,
    autoFocus = false,
    "aria-label": ariaLabel,
}: EmailInputWithDomainSuggestionsProps) {
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const atIndex = value.lastIndexOf("@");
    const partialDomain = atIndex >= 0 ? value.slice(atIndex + 1) : "";
    const suggestions = useMemo(() => {
        if (atIndex < 0) return [];
        return matchEmailDomainSuggestions(partialDomain);
    }, [atIndex, partialDomain]);

    useEffect(() => {
        setHighlightIndex(0);
    }, [suggestions.join("|")]);

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [open]);

    const applySuggestion = (domain: string) => {
        const localPart = getLocalPart(value);
        onChange(`${localPart}@${domain}`);
        setOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || suggestions.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightIndex((current) => (current + 1) % suggestions.length);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            applySuggestion(suggestions[highlightIndex]);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
        }
    };

    const showSuggestions = open && atIndex >= 0 && suggestions.length > 0;

    return (
        <div className="email-domain-suggestions" ref={containerRef}>
            <input
                id={id}
                type="email"
                value={value}
                disabled={disabled}
                autoComplete="off"
                autoFocus={autoFocus}
                placeholder={placeholder}
                className={className}
                aria-label={ariaLabel}
                aria-expanded={showSuggestions}
                aria-autocomplete="list"
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(event.target.value.includes("@"));
                }}
                onFocus={() => {
                    if (value.includes("@")) setOpen(true);
                }}
                onKeyDown={handleKeyDown}
            />
            {showSuggestions ? (
                <ul className="email-domain-suggestions__list" role="listbox">
                    {suggestions.map((domain, index) => (
                        <li key={domain}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === highlightIndex}
                                className={[
                                    "email-domain-suggestions__option",
                                    index === highlightIndex ? "email-domain-suggestions__option--active" : "",
                                ].filter(Boolean).join(" ")}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applySuggestion(domain)}
                            >
                                {getLocalPart(value)}@{domain}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
