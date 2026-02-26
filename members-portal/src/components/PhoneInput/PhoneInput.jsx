import { useState, useEffect } from 'react';
import { COUNTRY_CODES, parsePhoneValue, formatPhoneValue } from '../../utils/countryCodes';
import './PhoneInput.css';

export function PhoneInput({
    value = '',
    onChange,
    id,
    name,
    placeholder = 'Phone number',
    disabled,
    required,
    label,
    error,
    className = ''
}) {
    const parsed = parsePhoneValue(value);
    const [countryCode, setCountryCode] = useState(parsed.countryCode);
    const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);

    useEffect(() => {
        const p = parsePhoneValue(value);
        setCountryCode(p.countryCode);
        setNationalNumber(p.nationalNumber);
    }, [value]);

    const handleCountryChange = (e) => {
        const code = e.target.value;
        setCountryCode(code);
        const full = formatPhoneValue(code, nationalNumber);
        onChange?.(full);
    };

    const handleNumberChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setNationalNumber(raw);
        const full = formatPhoneValue(countryCode, raw);
        onChange?.(full);
    };

    return (
        <div className={`phone-input-wrapper ${className}`}>
            {label && (
                <label htmlFor={id} className="phone-input-label">
                    {label}
                    {required && <span className="phone-input-required"> *</span>}
                </label>
            )}
            <div className="phone-input-row">
                <select
                    className="phone-input-select"
                    value={countryCode}
                    onChange={handleCountryChange}
                    disabled={disabled}
                    aria-label="Country code"
                >
                    {COUNTRY_CODES.map(({ code, country }) => (
                        <option key={code} value={code}>
                            {country} ({code})
                        </option>
                    ))}
                </select>
                <input
                    type="tel"
                    id={id}
                    name={name}
                    className="phone-input-number"
                    value={nationalNumber}
                    onChange={handleNumberChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    autoComplete="tel-national"
                    inputMode="numeric"
                />
            </div>
            {error && <span className="phone-input-error">{error}</span>}
        </div>
    );
}
