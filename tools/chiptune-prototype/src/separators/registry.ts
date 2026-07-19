import { PrototypeInputError } from "../io";
import type { SeparatorId } from "../types";
import { createDemucsSeparator } from "./demucs";

export function getSeparator(id: SeparatorId) {
  if (id === "demucs") return createDemucsSeparator();
  throw new PrototypeInputError("SEPARATOR_INVALID", "Der angeforderte Stem-Separator ist nicht verfügbar.");
}
