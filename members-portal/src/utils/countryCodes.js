// Country dial codes for phone input (code must include +)
// Sorted by code length descending so we can match longest prefix when parsing
export const COUNTRY_CODES = [
    { code: '+20', country: 'Egypt' },
    { code: '+966', country: 'Saudi Arabia' },
    { code: '+971', country: 'UAE' },
    { code: '+973', country: 'Bahrain' },
    { code: '+974', country: 'Qatar' },
    { code: '+965', country: 'Kuwait' },
    { code: '+968', country: 'Oman' },
    { code: '+962', country: 'Jordan' },
    { code: '+961', country: 'Lebanon' },
    { code: '+963', country: 'Syria' },
    { code: '+964', country: 'Iraq' },
    { code: '+967', country: 'Yemen' },
    { code: '+970', country: 'Palestine' },
    { code: '+1', country: 'USA / Canada' },
    { code: '+44', country: 'UK' },
    { code: '+33', country: 'France' },
    { code: '+49', country: 'Germany' },
    { code: '+39', country: 'Italy' },
    { code: '+34', country: 'Spain' },
    { code: '+31', country: 'Netherlands' },
    { code: '+32', country: 'Belgium' },
    { code: '+41', country: 'Switzerland' },
    { code: '+43', country: 'Austria' },
    { code: '+46', country: 'Sweden' },
    { code: '+47', country: 'Norway' },
    { code: '+45', country: 'Denmark' },
    { code: '+358', country: 'Finland' },
    { code: '+353', country: 'Ireland' },
    { code: '+351', country: 'Portugal' },
    { code: '+30', country: 'Greece' },
    { code: '+48', country: 'Poland' },
    { code: '+420', country: 'Czech Republic' },
    { code: '+36', country: 'Hungary' },
    { code: '+40', country: 'Romania' },
    { code: '+7', country: 'Russia / Kazakhstan' },
    { code: '+90', country: 'Turkey' },
    { code: '+91', country: 'India' },
    { code: '+92', country: 'Pakistan' },
    { code: '+93', country: 'Afghanistan' },
    { code: '+94', country: 'Sri Lanka' },
    { code: '+98', country: 'Iran' },
    { code: '+86', country: 'China' },
    { code: '+81', country: 'Japan' },
    { code: '+82', country: 'South Korea' },
    { code: '+60', country: 'Malaysia' },
    { code: '+65', country: 'Singapore' },
    { code: '+66', country: 'Thailand' },
    { code: '+84', country: 'Vietnam' },
    { code: '+62', country: 'Indonesia' },
    { code: '+61', country: 'Australia' },
    { code: '+64', country: 'New Zealand' },
    { code: '+27', country: 'South Africa' },
    { code: '+234', country: 'Nigeria' },
    { code: '+254', country: 'Kenya' },
    { code: '+255', country: 'Tanzania' },
    { code: '+256', country: 'Uganda' },
    { code: '+212', country: 'Morocco' },
    { code: '+213', country: 'Algeria' },
    { code: '+216', country: 'Tunisia' },
    { code: '+218', country: 'Libya' },
    { code: '+249', country: 'Sudan' },
    { code: '+251', country: 'Ethiopia' }
];

// Sort by dial code length descending for parsing (longest match first)
const BY_CODE_LENGTH = [...COUNTRY_CODES].sort((a, b) => (b.code.length - a.code.length));

/**
 * Parse full international number (e.g. +201234567890) into { countryCode, nationalNumber }.
 * countryCode includes + (e.g. +20). nationalNumber is digits only.
 */
export function parsePhoneValue(value) {
    if (!value || typeof value !== 'string') {
        return { countryCode: '+20', nationalNumber: '' };
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('+')) {
        return { countryCode: '+20', nationalNumber: trimmed.replace(/\D/g, '') };
    }
    for (const { code } of BY_CODE_LENGTH) {
        if (trimmed === code || trimmed.startsWith(code)) {
            const national = trimmed.slice(code.length).replace(/\D/g, '');
            return { countryCode: code, nationalNumber: national };
        }
    }
    return { countryCode: '+20', nationalNumber: trimmed.slice(1).replace(/\D/g, '') };
}

/**
 * Build full international number from countryCode and national (digits only).
 */
export function formatPhoneValue(countryCode, nationalNumber) {
    const digits = (nationalNumber || '').replace(/\D/g, '');
    if (!digits) return '';
    const code = (countryCode || '+20').replace(/\D/g, '');
    return code ? `+${code}${digits}` : digits;
}
