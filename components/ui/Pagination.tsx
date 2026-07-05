import { Button } from "./Button";

export function Pagination({
  page,
  pageCount,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Button variant="secondary" onClick={onPrevious} disabled={page <= 1}>
        Zurück
      </Button>
      <span className="text-sm text-gray-500">
        Seite {page} von {pageCount}
      </span>
      <Button variant="secondary" onClick={onNext} disabled={page >= pageCount}>
        Weiter
      </Button>
    </div>
  );
}
