import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { reactivateUser } from "./actions";

type Props = {
  userId: number;
};

export function ReactivateUser({ userId }: Props) {
  return (
    <form action={reactivateUser}>
      <input type="hidden" name="userId" value={userId} />

      <button
        type="submit"
        title="Benutzer reaktivieren"
        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <ArrowUturnLeftIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
