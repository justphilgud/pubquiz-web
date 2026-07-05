import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { archiveUser } from "./actions";

type Props = {
  userId: number;
};

export function ArchiveUser({ userId }: Props) {
    return (
    <form action={archiveUser}>
      <input type="hidden" name="userId" value={userId} />

      <button
        type="submit"
        title="Benutzer archivieren"
        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <ArchiveBoxIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
