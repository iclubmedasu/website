/**
 * Title-case utility for names, project titles, etc.
 */

const SMALL_WORDS = new Set<string>([
    'a', 'an', 'the',
    'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
    'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as',
    'is',
]);

/** Whole-word tokens that keep a fixed brand casing (matched case-insensitively). */
const PRESERVED_WORDS: Record<string, string> = {
    icamp: 'iCamp',
};

function preserveOrCapitalisePart(part: string): string {
    const preserved = PRESERVED_WORDS[part.toLowerCase()];
    if (preserved) return preserved;
    if (part.length > 1 && part === part.toUpperCase()) return part; // abbreviation
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/**
 * Convert a string to title case.
 *
 * Rules:
 *  - First and last word are always capitalised.
 *  - Small words (a, an, the, and, …) stay lowercase in the middle.
 *  - Words that are all-uppercase and > 1 character are left as-is (abbreviations like AI, UI, MENA).
 *  - Hyphenated parts are capitalised individually (follow-up → Follow-Up).
 *  - Preserved brand words (e.g. iCamp) keep their exact casing.
 *
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str: string): string;
export function toTitleCase<T>(str: T): T;
export function toTitleCase(str: unknown) {
    if (!str || typeof str !== 'string') return str;

    const words = str.trim().split(/\s+/);

    const capitaliseWord = (word: string): string => {
        // Handle hyphenated words
        if (word.includes('-')) {
            return word
                .split('-')
                .map((part: string) => preserveOrCapitalisePart(part))
                .join('-');
        }
        return preserveOrCapitalisePart(word);
    };

    return words
        .map((word: string, i: number) => {
            // Always capitalise first and last
            if (i === 0 || i === words.length - 1) return capitaliseWord(word);
            // Small words stay lowercase
            const lower = word.toLowerCase();
            if (SMALL_WORDS.has(lower)) return lower;
            return capitaliseWord(word);
        })
        .join(' ');
}

/**
 * React hook that returns the toTitleCase function.
 * Usage: const titleCase = useTitleCase();
 */
export function useTitleCase(): (value: string) => string {
    return (value: string) => toTitleCase(value);
}
