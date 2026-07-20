import type { FilterableColumn, RegistrationSortSpec, SortDirection } from '../registrationTableFilterUtils';

interface RegistrationTableSortControlProps {
    columns: FilterableColumn[];
    sortSpec: RegistrationSortSpec;
    onSortSpecChange: (next: RegistrationSortSpec) => void;
}

export default function RegistrationTableSortControl({
    columns,
    sortSpec,
    onSortSpecChange,
}: RegistrationTableSortControlProps) {
    const toggleDirection = () => {
        const nextDirection: SortDirection = sortSpec.direction === 'asc' ? 'desc' : 'asc';
        onSortSpecChange({ ...sortSpec, direction: nextDirection });
    };

    return (
        <>
            <select
                aria-label="Sort by"
                className="form-input"
                value={sortSpec.columnId}
                onChange={(event) => onSortSpecChange({ ...sortSpec, columnId: event.target.value })}
            >
                {columns.map((column) => (
                    <option key={column.id} value={column.id}>{column.label}</option>
                ))}
            </select>
            <button
                type="button"
                className="btn btn-secondary event-registration-sort-direction-btn"
                onClick={toggleDirection}
                aria-label={sortSpec.direction === 'asc' ? 'Sort ascending' : 'Sort descending'}
                title={sortSpec.direction === 'asc' ? 'Ascending' : 'Descending'}
            >
                {sortSpec.direction === 'asc' ? 'A→Z' : 'Z→A'}
            </button>
        </>
    );
}
