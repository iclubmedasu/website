import type { PublicEventCustomField } from "@iclub/shared";

export interface RegistrationDraft {
    fullName: string;
    email: string;
    phoneNumber: string;
    tierId: string;
    sessionIds: string[];
    customFieldValues: Record<string, unknown>;
}

export const emptyRegistrationDraft = (): RegistrationDraft => ({
    fullName: "",
    email: "",
    phoneNumber: "",
    tierId: "",
    sessionIds: [],
    customFieldValues: {},
});

export function dropdownOptions(field: Pick<PublicEventCustomField, "options">): string[] {
    if (!Array.isArray(field.options)) return [];
    return field.options.map((option) => String(option));
}

export function isCustomFieldValueEmpty(
    field: Pick<PublicEventCustomField, "type">,
    value: unknown,
): boolean {
    if (field.type === "checkbox") {
        return value !== true && value !== "true";
    }
    if (value === null || value === undefined || value === "") return true;
    return false;
}

export function getCustomFieldValueFromRecord(
    customFieldValues: Record<string, unknown>,
    field: Pick<PublicEventCustomField, "id" | "label">,
): unknown {
    return customFieldValues[String(field.id)] ?? customFieldValues[field.label];
}

export function validateRequiredCustomFields(
    customFieldValues: Record<string, unknown>,
    fields: Array<Pick<PublicEventCustomField, "id" | "label" | "type" | "required">>,
): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of fields) {
        if (!field.required) continue;
        const fieldKey = String(field.id);
        const value = getCustomFieldValueFromRecord(customFieldValues, field);
        if (isCustomFieldValueEmpty(field, value)) {
            errors[fieldKey] = `${field.label} is required.`;
        }
    }

    return errors;
}

export function validateRegistrationDraft(
    draft: RegistrationDraft,
    fields: PublicEventCustomField[],
    options?: {
        requireTier?: boolean;
        requireSessions?: boolean;
    },
): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!draft.fullName.trim()) {
        errors.fullName = "Name is required.";
    }
    if (!draft.email.trim()) {
        errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
        errors.email = "A valid email address is required.";
    }
    if (options?.requireTier && !draft.tierId) {
        errors.tierId = "Please select a tier.";
    }
    if (options?.requireSessions && draft.sessionIds.length === 0) {
        errors.sessionIds = "Please select at least one session.";
    }

    return {
        ...errors,
        ...validateRequiredCustomFields(draft.customFieldValues, fields),
    };
}

export function parseCustomFieldInputValue(
    field: Pick<PublicEventCustomField, "type">,
    raw: string,
): unknown {
    if (field.type === "number") {
        return raw === "" ? null : Number(raw);
    }
    return raw;
}

export function formatCapacityLabel(spotsRemaining: number | null | undefined, capacity: number | null | undefined): string {
    if (capacity == null) {
        return "Open registration";
    }
    if (spotsRemaining == null) {
        return "Open registration";
    }
    if (spotsRemaining <= 0) {
        return "Registration full";
    }
    return `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} remaining`;
}

export { formatEventDateRange, formatRegistrationDeadline } from "@iclub/shared/utils";

export function formatTierPrice(price: number | null | undefined, currency: string | null | undefined): string {
    if (price == null) return "Free";
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "EGP",
        }).format(price);
    } catch {
        return `${price} ${currency || "EGP"}`;
    }
}
