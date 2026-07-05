import { InputHTMLAttributes, ReactNode } from "react";

type RadioOption = {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
};

type RadioGroupProps = {
  name: string;
  value?: string;
  options: RadioOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function RadioGroup({
  name,
  value,
  options,
  onChange,
  disabled,
}: RadioGroupProps) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label key={option.value} className="flex items-start gap-3 text-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange?.(option.value)}
            className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span>
            <span className="font-medium text-gray-900">{option.label}</span>
            {option.hint && <span className="block text-gray-500">{option.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
