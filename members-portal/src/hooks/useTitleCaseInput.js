import { useState, useCallback } from 'react';
import { toTitleCase } from '../utils/titleCase';

/**
 * React hook for live title-case auto-capitalisation on text inputs.
 *
 * Usage (standalone field):
 *   const [title, handleTitleChange, setTitle] = useTitleCaseInput('');
 *   <input value={title} onChange={handleTitleChange} />
 *
 * - Applies `toTitleCase` after the user types a space so it doesn't
 *   interfere mid-word.
 * - The third return value (`setValue`) lets you reset the field
 *   programmatically (e.g. when populating from props / API).
 *
 * @param {string} initialValue
 * @returns {[string, (e: React.ChangeEvent<HTMLInputElement>) => void, React.Dispatch<React.SetStateAction<string>>]}
 */
export function useTitleCaseInput(initialValue = '') {
    const [value, setValue] = useState(initialValue);

    const handleChange = useCallback((e) => {
        const raw = e.target.value;
        // Only apply title case after a space is typed (last char is a space)
        // so we don't interfere while the user is in the middle of a word.
        if (raw.endsWith(' ')) {
            setValue(toTitleCase(raw) + ' ');
        } else {
            setValue(raw);
        }
    }, []);

    return [value, handleChange, setValue];
}

/**
 * Helper for form-data patterns where the title/name field lives inside
 * a shared state object.  Returns the value to set in the state updater.
 *
 * Usage inside a handleChange:
 *   const val = titleCaseValue(e.target.value);
 *   setFormData(prev => ({ ...prev, [name]: val }));
 *
 * @param {string} raw
 * @returns {string}
 */
export function titleCaseValue(raw) {
    if (typeof raw !== 'string') return raw;
    if (raw.endsWith(' ')) {
        return toTitleCase(raw) + ' ';
    }
    return raw;
}
