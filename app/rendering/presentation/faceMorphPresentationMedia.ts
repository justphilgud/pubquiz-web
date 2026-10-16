type StoredMedium = {
  slot_key: string | null;
  medientyp: { medientyp: string };
};

/** The editor stores each person's original as that canonical field's answer_image.
 * Expose fixed presentation roles without mutating storage or guessing media order.
 * Explicit prepared slots win; ambiguous/missing field images stay missing.
 */
export function faceMorphPresentationMedia<T extends StoredMedium>(
  templateId: string | null,
  questionMedia: readonly T[],
  fields: readonly { sortierung: number; medien: readonly T[] }[],
): T[] {
  const result = [...questionMedia];
  if (templateId !== "face_morph" || fields.length !== 2) return result;
  const ordered = [...fields].sort((a, b) => a.sortierung - b.sortierung);
  if (ordered[0].sortierung === ordered[1].sortierung) return result;
  const roles = ["face_morph_person_a_original", "face_morph_person_b_original"];
  for (let index = 0; index < roles.length; index++) {
    if (result.some(medium => medium.slot_key === roles[index])) continue;
    const originals = ordered[index].medien.filter(medium =>
      medium.slot_key === "answer_image" && /bild|image/i.test(medium.medientyp.medientyp));
    if (originals.length === 1) result.push({ ...originals[0], slot_key: roles[index] });
  }
  return result;
}
