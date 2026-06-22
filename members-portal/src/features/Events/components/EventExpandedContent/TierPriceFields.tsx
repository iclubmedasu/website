import type { EventTierCurrency } from '@/types/backend-contracts';
import { DEFAULT_TIER_CURRENCY, TIER_CURRENCIES } from '../tierPriceUtils';

interface TierPriceFieldsProps {
    price: string;
    currency: EventTierCurrency;
    onPriceChange: (value: string) => void;
    onCurrencyChange: (value: EventTierCurrency) => void;
    disabled?: boolean;
    idPrefix?: string;
}

export default function TierPriceFields({
    price,
    currency,
    onPriceChange,
    onCurrencyChange,
    disabled = false,
    idPrefix = 'tier',
}: TierPriceFieldsProps) {
    return (
        <div className="event-tier-price-input">
            <input
                id={`${idPrefix}-price`}
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="Price"
                title="0 = free"
                type="number"
                min="0"
                step="5"
                className="event-tier-price-input__amount"
                disabled={disabled}
                aria-label="Tier price"
            />
            <select
                id={`${idPrefix}-currency`}
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as EventTierCurrency)}
                className="event-tier-price-input__currency"
                disabled={disabled}
                aria-label="Tier currency"
            >
                {TIER_CURRENCIES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                ))}
            </select>
        </div>
    );
}

export { DEFAULT_TIER_CURRENCY };
