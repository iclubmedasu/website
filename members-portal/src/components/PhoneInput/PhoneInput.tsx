import { useEffect, useState, type ChangeEvent } from "react";
import { COUNTRY_CODES, parsePhoneValue, formatPhoneValue } from "../../utils/countryCodes";
import "./PhoneInput.css";

interface ParsedPhoneValue {
    countryCode: string;
    nationalNumber: string;
}

interface CountryCodeOption {
    code: string;
    country: string;
}

interface PhoneInputProps {
    value?: string;
    onChange?: (value: string) => void;
    id?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    label?: string;
    error?: string;
    className?: string;
}

const countryCodeOptions = COUNTRY_CODES as CountryCodeOption[];

export function PhoneInput({
    value = "",
    onChange,
    id,
    name,
    placeholder = "Phone number",
    disabled,
    required,
    label,
    error,
    className = "",
}: PhoneInputProps) {
    const parsed = parsePhoneValue(value) as ParsedPhoneValue;
    const [countryCode, setCountryCode] = useState(parsed.countryCode);
    const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);

    useEffect(() => {
        const p = parsePhoneValue(value) as ParsedPhoneValue;
        setCountryCode(p.countryCode);
        setNationalNumber(p.nationalNumber);
    }, [value]);

    const handleCountryChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        setCountryCode(code);
        const full = formatPhoneValue(code, nationalNumber) as string;
        onChange?.(full);
    };

    const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        setNationalNumber(raw);
        const full = formatPhoneValue(countryCode, raw) as string;
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
                    {countryCodeOptions.map(({ code, country }) => (
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
