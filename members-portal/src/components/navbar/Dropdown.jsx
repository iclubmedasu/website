import React from 'react';

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

const Dropdown = (props) => {
    const { button, children, classNames, animation } = props;
    const wrapperRef = React.useRef(null);
    const [openWrapper, setOpenWrapper] = React.useState(false);

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