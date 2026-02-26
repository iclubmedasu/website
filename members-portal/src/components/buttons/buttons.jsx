const colorStyles = {
    primary: 'bg-gradient-secondary text-white border-transparent',
    tertiary: 'bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-50',
};

const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
};

export function Button({ color = 'primary', size = 'md', children, ...props }) {
    return (
        <button
            className={`
        ${colorStyles[color]}
        ${sizeStyles[size]}
        font-semibold rounded-md
        transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-lg
        active:translate-y-0
        disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
      `}
            {...props}
        >
            {children}
        </button>
    );
}

// UTILITY BUTTONS

import { Copy01, DownloadCloud02, Edit01, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";

export const UtilityButtonTertiaryDemo = () => {
    return (
        <div className="flex items-start gap-1">
            <ButtonUtility size="sm" color="tertiary" tooltip="Copy" icon={Copy01} />
            <ButtonUtility size="sm" color="tertiary" tooltip="Download" icon={DownloadCloud02} />
            <ButtonUtility size="sm" color="tertiary" tooltip="Delete" icon={Trash01} />
            <ButtonUtility size="sm" color="tertiary" tooltip="Edit" icon={Edit01} />
        </div>
    );
};

import { CloseButton } from "@/components/base/buttons/close-button";

export const CloseXLightDemo = () => {
    return (
        <div className="flex items-start gap-3">
            <CloseButton size="sm" theme="light" />
            <CloseButton size="md" theme="light" />
            <CloseButton size="lg" theme="light" />
        </div>
    );
};