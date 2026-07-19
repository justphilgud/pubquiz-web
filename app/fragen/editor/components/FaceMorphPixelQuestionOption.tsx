type FaceMorphPixelQuestionOptionProps = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function FaceMorphPixelQuestionOption({
  checked,
  disabled,
  label,
  onChange,
}: FaceMorphPixelQuestionOptionProps) {
  return (
    <label className="mt-3 flex min-h-11 w-full min-w-0 items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0"
      />
      <span className="min-w-0 leading-5">{label}</span>
    </label>
  );
}
