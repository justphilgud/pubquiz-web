import { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", ...props }: LabelProps) {
  return (
    <label
      className={[
        "block text-sm font-medium text-gray-900",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
