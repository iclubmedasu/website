'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { ReactNode } from "react";

interface PopoverHorizonProps {
  extra?: string;
  trigger?: ReactNode;
  content?: ReactNode;
}

const PopoverHorizon = (props: PopoverHorizonProps) => {
  const { extra = "", trigger, content } = props;

  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleTriggerClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${extra}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="dialog"
        className="inline-flex"
      >
        {trigger}
      </div>

      {isOpen && content && (
        <div className="absolute left-0 top-full z-50 mt-2 w-max rounded-xl bg-white px-4 py-3 text-sm shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          {content}
        </div>
      )}
    </div>
  );
};

export default PopoverHorizon;
