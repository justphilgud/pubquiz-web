import { getMediaSlotDefinition } from "../mediaSlots";
import type { GeneratorId } from "../types";
import { generatorDefinitions } from "./definitions";
import type { GeneratorDefinition } from "./types";

export function getGeneratorDefinition(id: GeneratorId | string): GeneratorDefinition | null {
  return generatorDefinitions.find((definition) => definition.id === id) ?? null;
}

export function getActiveGeneratorsForTemplate(templateId: string) {
  return generatorDefinitions.filter(
    (definition) => definition.active && definition.supportedTemplates.includes(templateId as never),
  );
}

export function validateGeneratorRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const definition of generatorDefinitions) {
    if (ids.has(definition.id)) errors.push(`Doppelte Generator-ID: ${definition.id}`);
    ids.add(definition.id);
    if (Number(definition.version) < 1) errors.push(`Ungültige Version: ${definition.id}`);
    if ((definition.supportedTemplates as readonly string[]).length === 0) errors.push(`Keine Vorlage: ${definition.id}`);
    for (const slotKey of definition.inputSlots) {
      if (!getMediaSlotDefinition(slotKey).generatorInput) errors.push(`Ungültiger Inputslot: ${definition.id}/${slotKey}`);
    }
    for (const slotKey of definition.outputSlots) {
      const slot = getMediaSlotDefinition(slotKey);
      if (!slot.generatorOutput || slot.origin === "USER") errors.push(`Ungültiger Outputslot: ${definition.id}/${slotKey}`);
    }
  }
  return errors;
}
