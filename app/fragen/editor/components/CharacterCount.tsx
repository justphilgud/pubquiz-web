type CharacterCountProps = {
  current: number;
  maximum: number;
  warningAt?: number;
};

export function CharacterCount({
  current,
  maximum,
  warningAt = Math.floor(maximum * 0.8),
}: CharacterCountProps) {
  const isTooLong = current > maximum;
  const isNearLimit = current >= warningAt;

  return (
    <p
      className={[
        "mt-1 text-right text-xs",
        isTooLong
          ? "font-medium text-red-700"
          : isNearLimit
            ? "text-amber-700"
            : "text-slate-500",
      ].join(" ")}
      aria-live="polite"
    >
      {current} / {maximum}
    </p>
  );
}
