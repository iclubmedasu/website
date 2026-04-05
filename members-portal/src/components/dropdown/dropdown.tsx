'use client';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronDown } from 'lucide-react';

const ENABLE_HOVER_DROPDOWNS = false;

type DropdownOptionValue = string | number | null | undefined;

interface DropdownOption {
  value: DropdownOptionValue;
  label: string;
}

interface FilterDropdownProps {
  options: DropdownOption[];
  value: DropdownOptionValue;
  onChange: (value: DropdownOptionValue) => void;
  triggerLabel?: string;
  hoverOpen?: boolean;
  closeDelay?: number;
}

interface MenuDropdownRenderArgs {
  isOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

interface MenuDropdownProps {
  button: ReactNode;
  children: ReactNode | ((args: MenuDropdownRenderArgs) => ReactNode);
  hoverOpen?: boolean;
  closeDelay?: number;
  wrapperClassName?: string;
  headerClassName?: string;
  menuClassName?: string;
  openClassName?: string;
  animation?: string;
  classNames?: string;
}

type DropdownProps = FilterDropdownProps | MenuDropdownProps;

function useOutsideAlerter(ref: RefObject<HTMLElement | null>, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, setOpen]);
}

function FilterDropdown({
  options,
  value,
  onChange,
  triggerLabel,
  hoverOpen = true,
  closeDelay = 150,
}: FilterDropdownProps) {
  const allowHoverOpen = ENABLE_HOVER_DROPDOWNS && hoverOpen;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useOutsideAlerter(wrapperRef, setIsOpen);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const selected = options.find((option) => String(option.value) === String(value)) || options[0];
  const displayLabel = selected ? selected.label : triggerLabel;

  const openMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const closeMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(false);
  };

  const scheduleClose = () => {
    if (!allowHoverOpen) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  const toggleMenu = () => {
    setIsOpen((current) => !current);
  };

  const handleSelect = (optionValue: DropdownOptionValue) => {
    onChange(optionValue);
    closeMenu();
  };

  return (
    <div
      className="manage-roles-container"
      ref={wrapperRef}
      onMouseEnter={allowHoverOpen ? openMenu : undefined}
      onMouseLeave={allowHoverOpen ? scheduleClose : undefined}
    >
      <div className="manage-roles-header">
        <div
          className="manage-combobox-trigger"
          onClick={toggleMenu}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleMenu();
            }
          }}
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
        >
          <span className="manage-combobox-label">{displayLabel}</span>
          <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} size={20} />
        </div>
      </div>

      <div
        className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`}
        role="listbox"
        aria-label={triggerLabel ?? 'Filter options'}
      >
        {options.map((option, index) => {
          const isSelected = String(option.value) === String(value);

          return (
            <div key={option.value ?? `option-${index}`} className="manage-dropdown-item-wrapper">
              <button
                type="button"
                role="option"
                className={`manage-dropdown-item ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                <span className="manage-dropdown-item-label">{option.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MenuDropdown({
  button,
  children,
  hoverOpen = false,
  closeDelay = 150,
  wrapperClassName = 'relative flex',
  headerClassName = '',
  menuClassName = 'absolute z-10 origin-top-right transition-all duration-300 ease-in-out',
  openClassName = 'open',
}: MenuDropdownProps) {
  const allowHoverOpen = ENABLE_HOVER_DROPDOWNS && hoverOpen;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useOutsideAlerter(wrapperRef, setIsOpen);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const openMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const closeMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(false);
  };

  const scheduleClose = () => {
    if (!allowHoverOpen) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  const toggleMenu = () => {
    setIsOpen((current) => !current);
  };

  const renderedChildren = typeof children === 'function'
    ? children({ isOpen, openMenu, closeMenu, toggleMenu })
    : children;

  const trigger = (
    <div
      onClick={toggleMenu}
      onFocus={allowHoverOpen ? openMenu : undefined}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleMenu();
        }
      }}
      role="button"
      tabIndex={0}
      aria-haspopup="menu"
      className="flex"
    >
      {button}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      onMouseEnter={allowHoverOpen ? openMenu : undefined}
      onMouseLeave={allowHoverOpen ? scheduleClose : undefined}
    >
      {headerClassName ? <div className={headerClassName}>{trigger}</div> : trigger}

      <div
        className={`${menuClassName} ${isOpen ? openClassName : ''}`}
      >
        {renderedChildren}
      </div>
    </div>
  );
}

function isFilterDropdownProps(props: DropdownProps): props is FilterDropdownProps {
  return Array.isArray((props as FilterDropdownProps).options);
}

const Dropdown = (props: DropdownProps) => {
  if (isFilterDropdownProps(props)) {
    return <FilterDropdown {...props} />;
  }

  return <MenuDropdown {...props} />;
};

export default Dropdown;
