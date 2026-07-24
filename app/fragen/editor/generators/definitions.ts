import type { GeneratorDefinition } from "./types";

export const generatorDefinitions = [
  {
    id: "audio_reverse",
    version: 1,
    active: true,
    labelKey: "audioReverse",
    descriptionKey: "audioReverse",
    parameterKind: "NONE",
    inputSlots: ["music_original_audio"],
    outputSlots: ["music_reverse_audio"],
    supportedTemplates: ["musik_rueckwaerts"],
    executionMode: "SYNCHRONOUS",
  },
  { id: "audio_bitcrush", version: 1, active: true, labelKey: "audioBitcrush", descriptionKey: "audioBitcrush", parameterKind: "NONE", inputSlots: ["music_original_audio"], outputSlots: ["music_bitcrush_audio"], supportedTemplates: ["eight_bit"], executionMode: "SYNCHRONOUS" },
  { id: "image_pixelate", version: 2, active: true, labelKey: "imagePixelate", descriptionKey: "imagePixelate", parameterKind: "NONE", inputSlots: ["pixel_original_image"], outputSlots: ["pixel_stage_3_image", "pixel_stage_2_image", "pixel_stage_1_image"], supportedTemplates: ["pixelbild"], executionMode: "SYNCHRONOUS" },
  { id: "audio_chiptune", version: 1, active: false, labelKey: "reserved", descriptionKey: "reserved", parameterKind: "NONE", inputSlots: ["music_original_audio"], outputSlots: [], supportedTemplates: ["eight_bit"], executionMode: "ASYNCHRONOUS" },
  { id: "image_face_morph", version: 1, active: false, labelKey: "reserved", descriptionKey: "reserved", parameterKind: "NONE", inputSlots: ["face_morph_person_a_original", "face_morph_person_b_original"], outputSlots: ["face_morph_result"], supportedTemplates: ["face_morph"], executionMode: "ASYNCHRONOUS" },
  { id: "text_to_speech", version: 1, active: false, labelKey: "reserved", descriptionKey: "reserved", parameterKind: "NONE", inputSlots: [], outputSlots: ["lyrics_tts_audio"], supportedTemplates: ["uebersetzt_vorgelesen", "google_rezensionen"], executionMode: "ASYNCHRONOUS" },
] as const satisfies readonly GeneratorDefinition[];
