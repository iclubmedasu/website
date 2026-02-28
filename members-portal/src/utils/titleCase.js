/**
 * Title-case utility for names, project titles, etc.
 */

const SMALL_WORDS = new Set([
    'a', 'an', 'the',
    'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
    'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as',
    'is', 'it',
]);

/**
 * Convert a string to title case.
 *
 * Rules:
 *  - First and last word are always capitalised.
 *  - Small words (a, an, the, and, …) stay lowercase in the middle.
 *  - Words that are all-uppercase and > 1 character are left as-is (abbreviations like AI, UI, MENA).
 *  - Hyphenated parts are capitalised individually (follow-up → Follow-Up).
 *
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;

    const words = str.trim().split(/\s+/);

    const capitaliseWord = (word) => {
        // Handle hyphenated words
        if (word.includes('-')) {
            return word
                .split('-')
                .map((part) => {
                    if (part.length > 1 && part === part.toUpperCase()) return part; // abbreviation
                    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
                })
                .join('-');
        }
        // Preserve all-caps abbreviations (AI, UI, etc.)
        if (word.length > 1 && word === word.toUpperCase()) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    };

    return words
        .map((word, i) => {
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
export function useTitleCase() {
    return toTitleCase;
}
