'use client';

import { useId, useState, type Key, type ReactNode } from 'react';
import './SearchableBadgePicker.css';

export interface SearchableBadgePickerProps<T> {
    items: T[];
    getKey: (item: T) => Key;
    getLabel: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    searchPlaceholder?: string;
    filter?: (item: T, query: string) => boolean;
    emptyMessage?: string;
    className?: string;
}

function defaultFilter<T>(item: T, query: string, getLabel: (item: T) => string): boolean {
    return getLabel(item).toLowerCase().includes(query);
}

export default function SearchableBadgePicker<T>({
    items,
    getKey,
    getLabel,
    renderItem,
    searchPlaceholder = 'Search…',
    filter,
    emptyMessage = 'No matches.',
    className = '',
}: SearchableBadgePickerProps<T>) {
    const [query, setQuery] = useState('');
    const searchId = useId();
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
        ? items.filter((item) =>
            filter
                ? filter(item, normalized)
                : defaultFilter(item, normalized, getLabel),
        )
        : items;

    return (
        <div className={`searchable-badge-picker${className ? ` ${className}` : ''}`}>
            <label className="searchable-badge-picker-search-label" htmlFor={searchId}>
                <span className="sr-only">{searchPlaceholder}</span>
                <input
                    id={searchId}
                    type="search"
                    className="form-input searchable-badge-picker-search"
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                />
            </label>
            <div className="searchable-badge-picker-grid team-badge-picker" role="list">
                {filtered.length > 0 ? (
                    filtered.map((item) => (
                        <div key={getKey(item)} className="searchable-badge-picker-item" role="listitem">
                            {renderItem(item)}
                        </div>
                    ))
                ) : (
                    <p className="searchable-badge-picker-empty form-hint">{emptyMessage}</p>
                )}
            </div>
        </div>
    );
}
