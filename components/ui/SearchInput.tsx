import { InputHTMLAttributes } from "react";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function SearchInput({ className = "", placeholder = "Suchen...", ...props }: SearchInputProps) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      className={[
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
        "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
