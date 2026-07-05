import { ButtonHTMLAttributes, ElementType } from "react";

type IconButtonTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "pink";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ElementType;
  label: string;
  tone?: IconButtonTone;
  active?: boolean;
};

const tones: Record<IconButtonTone, string> = {
  default: "bg-zinc-800 text-white hover:bg-zinc-700",
  primary: "bg-cyan-500 text-black hover:bg-cyan-400",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  warning: "bg-amber-600 text-white hover:bg-amber-500",
  danger: "bg-red-600 text-white hover:bg-red-500",
  violet: "bg-violet-600 text-white hover:bg-violet-500",
  pink: "bg-pink-600 text-white hover:bg-pink-500",
};

const activeTones: Record<IconButtonTone, string> = {
  default: "bg-zinc-600 text-white",
  primary: "bg-cyan-300 text-black",
  success: "bg-emerald-400 text-black",
  warning: "bg-amber-400 text-black",
  danger: "bg-red-400 text-black",
  violet: "bg-violet-400 text-black",
  pink: "bg-pink-400 text-black",
};

export function IconButton({
  icon: Icon,
  label,
  tone = "default",
  active = false,
  disabled,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center rounded-xl p-3 transition",
          "disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 disabled:hover:bg-zinc-800",
          active ? activeTones[tone] : tones[tone],
          className,
        ].join(" ")}
        {...props}
      >
        <Icon className="h-6 w-6" />
      </button>

      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-lg bg-black px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
        {label}
      </span>
    </span>
  );
}
