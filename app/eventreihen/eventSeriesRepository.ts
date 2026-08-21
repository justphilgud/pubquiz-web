import {
  buildEventSeriesPersistenceData,
  type NormalizedEventSeriesInput,
} from "./eventSeriesPolicy";

const eventSeriesUpdateSelect = {
  name: true,
  oeffentlicher_name: true,
  beschreibung: true,
  interne_bemerkung: true,
  ist_oeffentlich: true,
  default_presentation_template_id: true,
} as const;

type EventSeriesUpdateData = ReturnType<typeof buildEventSeriesPersistenceData>;

export type SavedEventSeriesUpdate = {
  name: string;
  oeffentlicher_name: string | null;
  beschreibung: string | null;
  interne_bemerkung: string | null;
  ist_oeffentlich: boolean;
  default_presentation_template_id: string;
};

export type EventSeriesUpdateRepository = {
  update(args: {
    where: { eventreihe_id: number };
    data: EventSeriesUpdateData;
    select: typeof eventSeriesUpdateSelect;
  }): Promise<SavedEventSeriesUpdate>;
};

export function persistEventSeriesUpdate(
  repository: EventSeriesUpdateRepository,
  eventSeriesId: number,
  value: NormalizedEventSeriesInput,
) {
  return repository.update({
    where: { eventreihe_id: eventSeriesId },
    data: buildEventSeriesPersistenceData(value),
    select: eventSeriesUpdateSelect,
  });
}
