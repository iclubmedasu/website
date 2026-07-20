export const COMMON_EMAIL_DOMAINS = [
    "gmail.com",
    "googlemail.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "yahoo.com",
    "yahoo.co.uk",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "zoho.com",
    "gmx.com",
    "mail.com",
] as const;

export function matchEmailDomainSuggestions(partialAfterAt: string): string[] {
    const normalized = partialAfterAt.trim().toLowerCase().replace(/^@+/, "");
    if (!normalized) {
        return [...COMMON_EMAIL_DOMAINS];
    }

    const prefixMatches = COMMON_EMAIL_DOMAINS.filter((domain) => domain.startsWith(normalized));
    if (prefixMatches.length > 0) {
        return [...prefixMatches];
    }

    const substringMatches = COMMON_EMAIL_DOMAINS.filter((domain) => domain.includes(normalized));
    return [...substringMatches];
}
