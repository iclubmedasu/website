import type { EventTierCurrency } from '@/types/backend-contracts';

export const TIER_CURRENCIES: EventTierCurrency[] = ['EGP', 'USD', 'EUR'];

export const DEFAULT_TIER_CURRENCY: EventTierCurrency = 'EGP';

export function parseTierPrice(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatTierPrice(
    price: number | null | undefined,
    currency: EventTierCurrency | string = DEFAULT_TIER_CURRENCY,
): string {
    if (price == null) return '';
    if (price === 0) return 'Free';
    return `${price} ${currency}`;
}

export function normalizeTierCurrency(value: unknown): EventTierCurrency {
    const currency = String(value || DEFAULT_TIER_CURRENCY).trim().toUpperCase();
    return TIER_CURRENCIES.includes(currency as EventTierCurrency)
        ? (currency as EventTierCurrency)
        : DEFAULT_TIER_CURRENCY;
}
