import { getMediaSlotDefinition } from "../mediaSlots";
import type { GeneratorDefinition } from "./types";
import type { GeneratorProcessorOutput } from "./processors/registry.server";

export function validateGeneratorProcessorOutputs(
  definition: GeneratorDefinition,
  outputs: readonly GeneratorProcessorOutput[],
) {
  const outputSlots = outputs.map((output) => output.slotKey);
  const expectedSlots = [...definition.outputSlots];
  if (outputs.length !== expectedSlots.length || new Set(outputSlots).size !== outputSlots.length ||
    !expectedSlots.every((slotKey) => outputSlots.includes(slotKey))) return false;
  if (!outputs.every((output) => {
    const slot = getMediaSlotDefinition(output.slotKey);
    return output.bytes.byteLength > 0 && slot.allowedMimeTypes.includes(output.contentType) &&
      output.bytes.byteLength <= slot.maxFileSizeBytes;
  })) return false;
  return outputs.length < 2 || outputs.every((output) =>
    output.contentType === outputs[0].contentType && output.fileExtension === outputs[0].fileExtension &&
    output.width !== undefined && output.height !== undefined &&
    output.width === outputs[0].width && output.height === outputs[0].height,
  );
}
