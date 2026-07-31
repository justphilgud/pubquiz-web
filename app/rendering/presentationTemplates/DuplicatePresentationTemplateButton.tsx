"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { duplicatePresentationTemplate } from "./actions";

type Props = {
  sourceId: string;
  label: string;
  className?: string;
};

export function DuplicatePresentationTemplateButton({
  sourceId,
  label,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submissionStarted = useRef(false);

  function duplicate() {
    if (submissionStarted.current) return;
    submissionStarted.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await duplicatePresentationTemplate(sourceId);
        if (!result.success || !result.templateId) {
          setError(result.message);
          submissionStarted.current = false;
          return;
        }
        router.push(`/templates/${result.templateId}`);
      } catch {
        setError("Der Entwurf konnte nicht erstellt werden. Bitte erneut versuchen.");
        submissionStarted.current = false;
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={duplicate}
        disabled={isPending}
        className={className}
      >
        {isPending ? "Entwurf wird erstellt …" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
