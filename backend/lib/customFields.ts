import { Prisma } from "@prisma/client";

export type CustomFieldRow = {
    id: number;
    label: string;
    type: string;
    required: boolean;
    showOnPublic?: boolean;
    isActive?: boolean;
    options?: unknown;
};

export function getCustomFieldValueFromRecord(
    customFieldValues: unknown,
    field: { id: number; label: string },
): unknown {
    if (!customFieldValues || typeof customFieldValues !== "object" || Array.isArray(customFieldValues)) {
        return undefined;
    }
    const record = customFieldValues as Record<string, unknown>;
    return record[String(field.id)] ?? record[field.label];
}

export function isCustomFieldValueEmpty(type: string, value: unknown): boolean {
    if (type === "checkbox") return value !== true && value !== "true";
    if (value === null || value === undefined || value === "") return true;
    return false;
}

export function getMissingRequiredCustomFieldsFromValues(
    fields: CustomFieldRow[],
    customFieldValues: unknown,
    options?: { publicOnly?: boolean },
): CustomFieldRow[] {
    return fields.filter((field) => {
        if (!field.required) return false;
        if (options?.publicOnly && !field.showOnPublic) return false;
        const value = getCustomFieldValueFromRecord(customFieldValues, field);
        return isCustomFieldValueEmpty(field.type, value);
    });
}

export function validateRequiredCustomFieldValues(
    fields: CustomFieldRow[],
    customFieldValues: unknown,
    options?: { publicOnly?: boolean },
): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of getMissingRequiredCustomFieldsFromValues(fields, customFieldValues, options)) {
        errors[String(field.id)] = `${field.label} is required.`;
    }
    return errors;
}

export function getDropdownOptions(options: unknown): string[] {
    if (!Array.isArray(options)) return [];
    return options.map((option) => String(option));
}

export function normalizeOptions(options: unknown): unknown {
    if (options == null) return null;
    if (Array.isArray(options)) return options;
    if (typeof options === "string") {
        const trimmed = options.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
        }
    }
    if (typeof options === "object") return options;
    return null;
}

export function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
    const normalized = normalizeOptions(value);
    return normalized === null ? Prisma.DbNull : (normalized as Prisma.InputJsonValue);
}

export function coerceImportCustomFieldValue(type: string, value: unknown, options?: unknown): unknown {
    if (value === null || value === undefined || value === "") return null;

    if (type === "checkbox") {
        if (typeof value === "boolean") return value;
        const normalized = String(value).trim().toLowerCase();
        if (["true", "yes", "y", "1", "x", "checked"].includes(normalized)) return true;
        if (["false", "no", "n", "0"].includes(normalized)) return false;
        return null;
    }

    if (type === "number") {
        const parsed = typeof value === "number" ? value : Number(String(value).trim());
        return Number.isFinite(parsed) ? parsed : null;
    }

    if (type === "dropdown") {
        const raw = String(value).trim();
        if (!raw) return null;
        const allowed = getDropdownOptions(options);
        const match = allowed.find((option) => option.toLowerCase() === raw.toLowerCase());
        return match ?? null;
    }

    return String(value).trim();
}

export function coerceSubmittedCustomFieldValue(
    field: Pick<CustomFieldRow, "type" | "options">,
    value: unknown,
): unknown {
    return coerceImportCustomFieldValue(field.type, value, field.options);
}

export function buildAnswerSnapshots(
    fields: CustomFieldRow[],
    customFieldValues: unknown,
): Array<{ fieldId: number; label: string; type: string; value: unknown }> {
    return fields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value: coerceSubmittedCustomFieldValue(field, getCustomFieldValueFromRecord(customFieldValues, field)),
    }));
}

export function getFirstAnswerPreview(
    answers: Array<{ label: string; value: unknown }>,
): string | null {
    for (const answer of answers) {
        if (answer.value === null || answer.value === undefined || answer.value === "") continue;
        if (typeof answer.value === "boolean") {
            return `${answer.label}: ${answer.value ? "Yes" : "No"}`;
        }
        return `${answer.label}: ${String(answer.value)}`;
    }
    return null;
}

const VALID_FIELD_TYPES = new Set(["text", "dropdown", "checkbox", "number"]);

export function isValidCustomFieldType(type: string): boolean {
    return VALID_FIELD_TYPES.has(type);
}
