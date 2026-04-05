import { useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";

interface DropdownProps {
    button: ReactNode;
    children: ReactNode;
    classNames?: string;
    animation?: string;
}

function useOutsideAlerter(
    ref: RefObject<HTMLDivElement>,
    setOpen: Dispatch<SetStateAction<boolean>>,
) {
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [ref, setOpen]);
}

const Dropdown = ({ button, children, classNames = "", animation }: DropdownProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [openWrapper, setOpenWrapper] = useState(false);

    useOutsideAlerter(wrapperRef, setOpenWrapper);

    return (
        <div ref={wrapperRef} className="relative flex">
            <div className="flex" onMouseDown={() => setOpenWrapper((current) => !current)}>
                {button}
            </div>
            <div
                className={`${classNames} absolute z-10 ${animation
                        ? animation
                        : 'origin-top-right transition-all duration-300 ease-in-out'
                    } ${openWrapper ? 'scale-100' : 'scale-0'}`}
            >
                {children}
            </div>
        </div>
    );
};

export default Dropdown;