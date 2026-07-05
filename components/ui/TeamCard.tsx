import { Badge } from "./Badge";

export function TeamCard({
  name,
  score,
  status,
}: {
  name: string;
  score?: number;
  status?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div>
        <div className="font-semibold text-gray-900">{name}</div>
        {typeof score === "number" && <div className="text-sm text-gray-500">{score} Punkte</div>}
      </div>
      {status && <Badge>{status}</Badge>}
    </div>
  );
}
