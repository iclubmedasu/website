import type {
    EventCustomFieldRef,
    EventCustomFieldType,
    EventTierRef,
    RegistrationImportColumnMapping,
    RegistrationImportNewFieldSpec,
    RegistrationImportRow,
} from '@/types/backend-contracts';

export const MAX_IMPORT_ROWS = 2000;

export interface ParsedRegistrationWorkbook {
    headers: string[];
    rows: Record<string, string>[];
    fileName: string;
}

const STANDARD_FIELD_PATTERNS: Record<keyof Pick<RegistrationImportColumnMapping, 'fullName' | 'email' | 'phoneNumber' | 'tier' | 'notes'>, RegExp[]> = {
    fullName: [/^name$/i, /^full\s*name$/i, /^attendee$/i, /^participant$/i, /^guest$/i],
    email: [/^e-?mail$/i, /^email\s*address$/i],
    phoneNumber: [/^phone$/i, /^phone\s*number$/i, /^mobile$/i, /^tel$/i],
    tier: [/^tier$/i, /^ticket$/i, /^pass$/i, /^registration\s*tier$/i],
    notes: [/^notes?$/i, /^comments?$/i, /^remarks?$/i],
};

function normalizeHeader(value: unknown): string {
    return String(value ?? '').trim();
}

function isRowEmpty(row: Record<string, string>): boolean {
    return Object.values(row).every((value) => !String(value ?? '').trim());
}

function cellToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return String(value).trim();
}

export async function parseRegistrationWorkbook(file: File): Promise<ParsedRegistrationWorkbook> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('The file does not contain any worksheets.');
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
    }) as unknown[][];

    if (matrix.length === 0) {
        throw new Error('The worksheet is empty.');
    }

    const headerRow = matrix[0] ?? [];
    const headers = headerRow
        .map((cell) => normalizeHeader(cell))
        .filter((header, index, all) => header && all.indexOf(header) === index);

    if (headers.length === 0) {
        throw new Error('Could not find a header row in the first worksheet.');
    }

    const rows: Record<string, string>[] = [];
    for (let rowIndex = 1; rowIndex < matrix.length && rows.length < MAX_IMPORT_ROWS; rowIndex += 1) {
        const cells = matrix[rowIndex] ?? [];
        const record: Record<string, string> = {};
        headers.forEach((header, columnIndex) => {
            record[header] = cellToString(cells[columnIndex]);
        });
        if (!isRowEmpty(record)) {
            rows.push(record);
        }
    }

    if (rows.length === 0) {
        throw new Error('No data rows were found below the header row.');
    }

    return { headers, rows, fileName: file.name };
}

export function suggestStandardColumnMapping(headers: string[]): RegistrationImportColumnMapping {
    const used = new Set<string>();
    const pick = (patterns: RegExp[]): string | null => {
        const match = headers.find((header) => !used.has(header) && patterns.some((pattern) => pattern.test(header)));
        if (match) used.add(match);
        return match ?? null;
    };

    return {
        fullName: pick(STANDARD_FIELD_PATTERNS.fullName),
        email: pick(STANDARD_FIELD_PATTERNS.email),
        phoneNumber: pick(STANDARD_FIELD_PATTERNS.phoneNumber),
        tier: pick(STANDARD_FIELD_PATTERNS.tier),
        notes: pick(STANDARD_FIELD_PATTERNS.notes),
        customFields: {},
    };
}

export function getMappedExcelColumns(mapping: RegistrationImportColumnMapping, newFieldColumns: string[]): Set<string> {
    const mapped = new Set<string>();
    for (const value of [mapping.fullName, mapping.email, mapping.phoneNumber, mapping.tier, mapping.notes]) {
        if (value) mapped.add(value);
    }
    for (const value of Object.values(mapping.customFields)) {
        if (value) mapped.add(value);
    }
    for (const column of newFieldColumns) {
        mapped.add(column);
    }
    return mapped;
}

export function getUnmappedExcelColumns(headers: string[], mapped: Set<string>): string[] {
    return headers.filter((header) => !mapped.has(header));
}

const CHECKBOX_TRUE = new Set(['true', 'yes', 'y', '1', 'x', 'checked']);

export function normalizeOptionRows(options?: string[]): string[] {
    const normalized = (options ?? []).map((option) => option.trim()).filter(Boolean);
    if (normalized.length >= 2) return normalized;
    return normalized.length === 1 ? [normalized[0], ''] : ['', ''];
}

export function getNormalizedOptions(optionRows: string[]): string[] {
    return optionRows.map((option) => option.trim()).filter(Boolean);
}

export function formatSamplePreview(values: string[], maxLength = 80): string {
    const samples = values.map((value) => value.trim()).filter(Boolean).slice(0, 5);
    if (samples.length === 0) return '';
    const joined = samples.join(' · ');
    if (joined.length <= maxLength) return joined;
    return `${joined.slice(0, maxLength - 3).trimEnd()}...`;
}

interface DropdownOptionExtractionConfig {
    maxOptions?: number;
    minRepeat?: number;
}

export function extractDropdownOptionsFromColumn(
    values: string[],
    { maxOptions = 10, minRepeat = 2 }: DropdownOptionExtractionConfig = {},
): string[] {
    const counts = new Map<string, { label: string; count: number }>();
    for (const value of values) {
        const trimmed = value.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            counts.set(key, { label: trimmed, count: 1 });
        }
    }

    const repeated = Array.from(counts.values())
        .filter((entry) => entry.count >= minRepeat)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((entry) => entry.label)
        .slice(0, maxOptions);

    if (repeated.length >= 2) return repeated;

    const fallback = Array.from(counts.values())
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((entry) => entry.label)
        .slice(0, maxOptions);

    return normalizeOptionRows(fallback);
}

function isCategoricalDropdownColumn(values: string[]): boolean {
    const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
    if (nonEmpty.length === 0) return false;
    if (!nonEmpty.every((value) => value.length <= 64)) return false;

    const counts = new Map<string, number>();
    for (const value of nonEmpty) {
        const key = value.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const uniqueCount = counts.size;
    if (uniqueCount < 2 || uniqueCount > 10) return false;

    const repeatedValues = Array.from(counts.values()).filter((count) => count >= 2);
    if (repeatedValues.length !== uniqueCount) return false;

    const categoricalMatches = nonEmpty.filter((value) => counts.has(value.toLowerCase())).length;
    return categoricalMatches / nonEmpty.length >= 0.6;
}

export function inferFieldType(values: string[]): EventCustomFieldType {
    const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
    if (nonEmpty.length === 0) return 'text';

    if (nonEmpty.every((value) => CHECKBOX_TRUE.has(value.toLowerCase()) || ['false', 'no', 'n', '0', ''].includes(value.toLowerCase()))) {
        return 'checkbox';
    }

    if (nonEmpty.every((value) => !Number.isNaN(Number(value)))) {
        return 'number';
    }

    if (isCategoricalDropdownColumn(values)) {
        return 'dropdown';
    }

    return 'text';
}

export function extractDropdownOptions(values: string[]): string[] {
    return extractDropdownOptionsFromColumn(values);
}

function coerceCheckboxValue(raw: string): boolean {
    return CHECKBOX_TRUE.has(raw.trim().toLowerCase());
}

function coerceCustomFieldValue(type: string, raw: string, options?: unknown): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (type === 'checkbox') {
        return coerceCheckboxValue(trimmed);
    }
    if (type === 'number') {
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (type === 'dropdown') {
        const allowed = Array.isArray(options)
            ? options.map((option) => String(option))
            : [];
        const match = allowed.find((option) => option.toLowerCase() === trimmed.toLowerCase());
        return match ?? trimmed;
    }
    return trimmed;
}

function readMappedValue(row: Record<string, string>, column: string | null): string {
    if (!column) return '';
    return row[column] ?? '';
}

export interface NewFieldImportDraft extends RegistrationImportNewFieldSpec {
    mode: 'skip' | 'import';
    optionRows: string[];
}

export function buildImportRows(
    rawRows: Record<string, string>[],
    mapping: RegistrationImportColumnMapping,
    newFields: NewFieldImportDraft[],
    existingFields: EventCustomFieldRef[],
    _tiers: EventTierRef[],
): RegistrationImportRow[] {
    const activeNewFields = newFields.filter((field) => field.mode === 'import');

    return rawRows.map((row) => {
        const customFieldValues: Record<string, unknown> = {};

        for (const field of existingFields) {
            const column = mapping.customFields[String(field.id)];
            if (!column) continue;
            const raw = readMappedValue(row, column);
            if (!raw) continue;
            customFieldValues[String(field.id)] = coerceCustomFieldValue(field.type, raw, field.options);
        }

        for (const field of activeNewFields) {
            const raw = readMappedValue(row, field.excelColumn);
            if (!raw) continue;
            const options = field.type === 'dropdown'
                ? getNormalizedOptions(field.optionRows)
                : field.options;
            customFieldValues[field.excelColumn] = coerceCustomFieldValue(field.type, raw, options);
        }

        const fullName = readMappedValue(row, mapping.fullName);
        const importRow: RegistrationImportRow = { fullName };

        if (mapping.email) {
            const email = readMappedValue(row, mapping.email).toLowerCase();
            if (email) {
                importRow.email = email;
            }
        }

        if (mapping.phoneNumber) {
            importRow.phoneNumber = readMappedValue(row, mapping.phoneNumber) || null;
        }
        if (mapping.tier) {
            importRow.tierName = readMappedValue(row, mapping.tier) || null;
        }
        if (mapping.notes) {
            importRow.notes = readMappedValue(row, mapping.notes) || null;
        }

        if (Object.keys(customFieldValues).length > 0) {
            importRow.customFieldValues = customFieldValues;
        }

        return importRow;
    });
}

export function buildNewFieldDrafts(
    rawRows: Record<string, string>[],
    unmappedColumns: string[],
): NewFieldImportDraft[] {
    return unmappedColumns.map((excelColumn) => {
        const values = rawRows.map((row) => row[excelColumn] ?? '');
        const type = inferFieldType(values);
        const options = type === 'dropdown' ? extractDropdownOptions(values) : undefined;
        return {
            excelColumn,
            label: excelColumn,
            type,
            options,
            optionRows: type === 'dropdown' ? normalizeOptionRows(options) : ['', ''],
            required: false,
            mode: 'skip' as const,
        };
    });
}

export function initializeCustomFieldMapping(
    fields: EventCustomFieldRef[],
    headers: string[],
    mapping: RegistrationImportColumnMapping,
): RegistrationImportColumnMapping {
    const used = new Set(
        [mapping.fullName, mapping.email, mapping.phoneNumber, mapping.tier, mapping.notes].filter(Boolean) as string[],
    );
    const customFields: Record<string, string | null> = { ...mapping.customFields };

    for (const field of fields) {
        const fieldKey = String(field.id);
        if (customFields[fieldKey] !== undefined) continue;

        const labelMatch = headers.find((header) => !used.has(header) && header.toLowerCase() === field.label.toLowerCase());
        if (labelMatch) {
            used.add(labelMatch);
            customFields[fieldKey] = labelMatch;
        } else {
            customFields[fieldKey] = null;
        }
    }

    return { ...mapping, customFields };
}
