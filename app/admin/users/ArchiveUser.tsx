"use client";

import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { useState, useTransition } from "react";
import { archiveUser } from "./actions";

type Props = {
  userId: number;
};

export function ArchiveUser({ userId }: Props) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <form
        action={(formData) => {
          setMessage("");
          startTransition(async () => {
            const result = await archiveUser(formData);
            if (!result.success) setMessage(result.message);
          });
        }}
      >
        <input type="hidden" name="userId" value={userId} />

        <button
          type="submit"
          title="Benutzer archivieren"
          disabled={isPending}
          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
        >
          <ArchiveBoxIcon className="h-5 w-5" />
        </button>
      </form>
      {message && (
        <p role="alert" aria-live="polite" className="mt-1 max-w-48 text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
