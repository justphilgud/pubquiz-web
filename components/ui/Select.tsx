import { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={[
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
        "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </select>
  );
}
