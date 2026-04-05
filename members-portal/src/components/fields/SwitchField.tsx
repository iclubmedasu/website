'use client';
import type { ComponentProps, ReactNode } from "react";
import Switch from "../switch/switch";

interface SwitchFieldProps extends Omit<ComponentProps<typeof Switch>, "id"> {
  id?: string;
  label?: ReactNode;
  desc?: ReactNode;
  mt?: string;
  mb?: string;
}

const SwitchField = (props: SwitchFieldProps) => {
  const { id, label, desc, mt = "", mb = "", ...switchProps } = props;
  return (
    <div className={`flex justify-between ${mt} ${mb} items-center`}>
      <label
        htmlFor={id}
        className="max-w-[80%] hover:cursor-pointer lg:max-w-[65%]"
      >
        <h5 className="text-base font-bold text-navy-700 dark:text-white">
          {label}
        </h5>
        <p className={`text-base text-gray-600`}>{desc}</p>
      </label>
      <div>
        <Switch id={id} {...switchProps} />
      </div>
    </div>
  );
};

export default SwitchField;
