import type { ReactNode } from "react";

interface TooltipHorizonProps {
  extra?: string;
  trigger?: ReactNode;
  content?: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

const TooltipHorizon = (props: TooltipHorizonProps) => {
  const { extra = "", trigger, content, placement = "top" } = props;

  const placementClass =
    placement === "bottom"
      ? "top-full mt-2 left-1/2 -translate-x-1/2"
      : placement === "left"
        ? "right-full mr-2 top-1/2 -translate-y-1/2"
        : placement === "right"
          ? "left-full ml-2 top-1/2 -translate-y-1/2"
          : "bottom-full mb-2 left-1/2 -translate-x-1/2";

  return (
    <span className={`group relative inline-flex ${extra}`}>
      {trigger}
      {content && (
        <span
          className={`pointer-events-none absolute z-50 hidden w-max rounded-xl bg-white px-4 py-3 text-sm shadow-xl shadow-shadow-500 group-hover:block dark:!bg-navy-700 dark:shadow-none ${placementClass}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default TooltipHorizon;
