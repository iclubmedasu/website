import React from 'react';
import { ChevronDown } from 'lucide-react';

const ENABLE_HOVER_DROPDOWNS = false; // Set to true to enable hover-to-open behavior for dropdowns (can be overridden per-dropdown with the `hoverOpen` prop)

function useOutsideAlerter(ref, setOpen) {
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
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
}) {
  const allowHoverOpen = ENABLE_HOVER_DROPDOWNS && hoverOpen;
  const wrapperRef = React.useRef(null);
  const closeTimeoutRef = React.useRef(null);
  const [isOpen, setIsOpen] = React.useState(false);

  useOutsideAlerter(wrapperRef, setIsOpen);

  React.useEffect(() => () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
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
    if (!hoverOpen) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  const toggleMenu = () => {
    setIsOpen((current) => !current);
  };

  const handleSelect = (optionValue) => {
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
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleMenu();
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="manage-combobox-label">{displayLabel}</span>
          <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} size={20} />
        </div>
      </div>

      <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`} role="listbox">
        {options.map((option) => {
          const isSelected = String(option.value) === String(value);

          return (
            <div key={option.value ?? 'all'} className="manage-dropdown-item-wrapper">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
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
  menuRole,
}) {
  const allowHoverOpen = ENABLE_HOVER_DROPDOWNS && hoverOpen;
  const wrapperRef = React.useRef(null);
  const closeTimeoutRef = React.useRef(null);
  const [isOpen, setIsOpen] = React.useState(false);

  useOutsideAlerter(wrapperRef, setIsOpen);

  React.useEffect(() => () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
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
    if (!hoverOpen) return;
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
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleMenu();
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
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
        role={menuRole}
      >
        {renderedChildren}
      </div>
    </div>
  );
}

const Dropdown = (props) => {
  if (Array.isArray(props.options)) {
    return FilterDropdown(props);
  }

  return MenuDropdown(props);
};

export default Dropdown;
