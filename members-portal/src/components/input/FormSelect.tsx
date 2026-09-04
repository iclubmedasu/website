'use client';

import {
    Children,
    forwardRef,
    isValidElement,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactElement,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type FormSelectOption = {
    value: string;
    label: ReactNode;
    /** Plain text used for filtering when `label` is not a string. */
    searchText?: string;
    disabled?: boolean;
};

export type FormSelectHandle = {
    focus: () => void;
    click: () => void;
    /** Opens the list (compat with native `HTMLSelectElement.showPicker`). */
    showPicker: () => void;
};

/** Native-select-compatible change event for drop-in migrations. */
export type FormSelectChangeEvent = {
    target: { value: string; name: string };
    currentTarget: { value: string; name: string };
};

export type FormSelectProps = {
    id?: string;
    name?: string;
    value?: string;
    defaultValue?: string;
    onChange?: (event: FormSelectChangeEvent) => void;
    /** Prefer `options` or `<option>` children. */
    options?: FormSelectOption[];
    children?: ReactNode;
    /** Shown on the closed trigger when value is empty / unmatched. */
    placeholder?: string;
    disabled?: boolean;
    /** Adds `.error` on the trigger. */
    error?: boolean;
    /**
     * Extra classes on the trigger button.
     * Defaults include `form-input` unless `variant="modal-select"` or className already has either.
     */
    className?: string;
    variant?: 'form-input' | 'modal-select';
    /** Type-to-filter inside the open list (long lists / country codes). */
    searchable?: boolean;
    searchPlaceholder?: string;
    title?: string;
    required?: boolean;
    autoFocus?: boolean;
    onBlur?: () => void;
    onFocus?: () => void;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
};

type ListCoords = { top: number; left: number; width: number; maxHeight: number };

function optionSearchText(opt: FormSelectOption): string {
    if (opt.searchText) return opt.searchText;
    if (typeof opt.label === 'string' || typeof opt.label === 'number') return String(opt.label);
    return opt.value;
}

function collectOptionsFromChildren(children: ReactNode): FormSelectOption[] {
    const out: FormSelectOption[] = [];
    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;
        const el = child as ReactElement<{
            value?: string | number;
            disabled?: boolean;
            children?: ReactNode;
        }>;
        if (el.type === 'option') {
            out.push({
                value: el.props.value == null ? '' : String(el.props.value),
                label: el.props.children ?? '',
                disabled: Boolean(el.props.disabled),
            });
            return;
        }
        if (el.type === 'optgroup') {
            // Flatten optgroups — FormSelect is a flat list.
            out.push(...collectOptionsFromChildren(el.props.children));
        }
    });
    return out;
}

function resolveTriggerClass(
    className: string | undefined,
    variant: FormSelectProps['variant'],
    error: boolean | undefined,
    open: boolean,
): string {
    const parts = (className ?? '').trim().split(/\s+/).filter(Boolean);
    const hasFieldClass = parts.includes('form-input') || parts.includes('modal-select');
    // Only default to form-input/modal-select when no className was provided.
    // Custom triggers (phone, gantt, inline status) keep their own chrome.
    if (!hasFieldClass && parts.length === 0) {
        parts.unshift(variant === 'modal-select' ? 'modal-select' : 'form-input');
    }
    parts.push('form-select-trigger');
    if (open) parts.push('form-select-trigger--open');
    if (error) parts.push('error');
    return parts.join(' ');
}

function computeListCoords(trigger: HTMLElement, listEl: HTMLElement | null): ListCoords {
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const estimatedHeight = listEl?.offsetHeight ?? 192;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < estimatedHeight + gap + 8 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(192, Math.max(120, (flipUp ? spaceAbove : spaceBelow) - gap - 8));
    const top = flipUp
        ? Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - gap)
        : rect.bottom + gap;
    const width = rect.width;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    return { top, left, width, maxHeight };
}

export const FormSelect = forwardRef<FormSelectHandle, FormSelectProps>(function FormSelect(
    {
        id,
        name = '',
        value: valueProp,
        defaultValue = '',
        onChange,
        options: optionsProp,
        children,
        placeholder = 'Select…',
        disabled = false,
        error = false,
        className,
        variant = 'form-input',
        searchable = false,
        searchPlaceholder = 'Search…',
        title,
        required,
        autoFocus,
        onBlur,
        onFocus,
        'aria-label': ariaLabel,
        'aria-labelledby': ariaLabelledby,
        'aria-describedby': ariaDescribedby,
    },
    ref,
) {
    const listboxId = useId();
    const searchId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState<ListCoords | null>(null);
    const [uncontrolled, setUncontrolled] = useState(defaultValue);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : uncontrolled;

    const options =
        optionsProp && optionsProp.length > 0
            ? optionsProp
            : collectOptionsFromChildren(children);

    const selected = options.find((o) => o.value === value);
    const displayLabel = selected ? selected.label : placeholder;
    const isPlaceholder = !selected;

    const filtered =
        searchable && search.trim()
            ? options.filter((o) =>
                optionSearchText(o).toLowerCase().includes(search.trim().toLowerCase()),
            )
            : options;

    const emitChange = useCallback(
        (next: string) => {
            if (!isControlled) setUncontrolled(next);
            const event: FormSelectChangeEvent = {
                target: { value: next, name },
                currentTarget: { value: next, name },
            };
            onChange?.(event);
        },
        [isControlled, name, onChange],
    );

    const openList = useCallback(() => {
        if (disabled) return;
        setOpen(true);
        setSearch('');
        const idx = options.findIndex((o) => o.value === value && !o.disabled);
        setHighlight(idx >= 0 ? idx : 0);
    }, [disabled, options, value]);

    const closeList = useCallback(() => {
        setOpen(false);
        setSearch('');
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            focus: () => {
                triggerRef.current?.focus();
            },
            click: () => {
                triggerRef.current?.click();
            },
            showPicker: () => {
                openList();
                triggerRef.current?.focus();
            },
        }),
        [openList],
    );

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        setCoords(computeListCoords(trigger, listRef.current));
    }, []);

    useLayoutEffect(() => {
        if (!open) {
            setCoords(null);
            return;
        }
        updateCoords();
        if (searchable) {
            searchRef.current?.focus();
        }
    }, [open, searchable, updateCoords, filtered.length]);

    useEffect(() => {
        if (!open) return;
        const onReposition = () => updateCoords();
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [open, updateCoords]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (rootRef.current?.contains(target)) return;
            if (listRef.current?.contains(target)) return;
            closeList();
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open, closeList]);

    useEffect(() => {
        return () => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        };
    }, []);

    const commit = useCallback(
        (next: string) => {
            emitChange(next);
            closeList();
            triggerRef.current?.focus();
        },
        [emitChange, closeList],
    );

    const moveHighlight = useCallback(
        (delta: number) => {
            if (filtered.length === 0) return;
            let next = highlight;
            for (let i = 0; i < filtered.length; i += 1) {
                next = (next + delta + filtered.length) % filtered.length;
                if (!filtered[next]?.disabled) {
                    setHighlight(next);
                    return;
                }
            }
        },
        [filtered, highlight],
    );

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) openList();
            else moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) {
                openList();
                return;
            }
            const opt = filtered[highlight];
            if (opt && !opt.disabled) commit(opt.value);
            return;
        }
        if (event.key === 'Escape') {
            if (open) {
                event.preventDefault();
                closeList();
            }
        }
    };

    const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveHighlight(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveHighlight(-1);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const opt = filtered[highlight];
            if (opt && !opt.disabled) commit(opt.value);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeList();
            triggerRef.current?.focus();
        }
    };

    const triggerClass = resolveTriggerClass(className, variant, error, open);

    const list =
        open && coords && typeof document !== 'undefined'
            ? createPortal(
                <ul
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    className="form-combobox-list form-select-list"
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        maxHeight: coords.maxHeight,
                        right: 'auto',
                        zIndex: 10000,
                    }}
                >
                    {searchable ? (
                        <li role="presentation" className="form-select-search">
                            <input
                                ref={searchRef}
                                id={searchId}
                                type="text"
                                className="form-select-search-input"
                                value={search}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setHighlight(0);
                                }}
                                onKeyDown={onSearchKeyDown}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                        </li>
                    ) : null}
                    {filtered.length === 0 ? (
                        <li role="presentation" className="form-select-empty">
                            No matches
                        </li>
                    ) : (
                        filtered.map((opt, index) => (
                            <li key={`${opt.value}-${index}`} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={opt.value === value}
                                    disabled={opt.disabled}
                                    className={`form-combobox-option${index === highlight ? ' form-combobox-option--active' : ''}${opt.value === value ? ' form-select-option--selected' : ''}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        if (!opt.disabled) commit(opt.value);
                                    }}
                                    onMouseEnter={() => setHighlight(index)}
                                >
                                    {opt.label}
                                </button>
                            </li>
                        ))
                    )}
                </ul>,
                document.body,
            )
            : null;

    return (
        <div className="form-select" ref={rootRef}>
            {name ? (
                <input type="hidden" name={name} value={value} required={required} />
            ) : null}
            <button
                ref={triggerRef}
                type="button"
                id={id}
                title={title}
                disabled={disabled}
                autoFocus={autoFocus}
                className={triggerClass}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledby}
                aria-describedby={ariaDescribedby}
                aria-required={required || undefined}
                aria-invalid={error || undefined}
                onClick={() => {
                    if (open) closeList();
                    else openList();
                }}
                onKeyDown={onTriggerKeyDown}
                onFocus={() => {
                    if (blurTimerRef.current) {
                        clearTimeout(blurTimerRef.current);
                        blurTimerRef.current = null;
                    }
                    onFocus?.();
                }}
                onBlur={() => {
                    blurTimerRef.current = setTimeout(() => {
                        if (!listRef.current?.contains(document.activeElement)) {
                            closeList();
                            onBlur?.();
                        }
                    }, 0);
                }}
            >
                <span
                    className={`form-select-value${isPlaceholder ? ' form-select-value--placeholder' : ''}`}
                >
                    {displayLabel}
                </span>
            </button>
            {list}
        </div>
    );
});

export default FormSelect;
