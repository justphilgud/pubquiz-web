"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";

const path = "/admin/live-text-replacements";

function readRule(formData: FormData) {
  const searchTerm = String(formData.get("searchTerm") ?? "").trim();
  const replacement = String(formData.get("replacement") ?? "").trim();
  if (!/^[\p{L}\p{N} ]{2,120}$/u.test(searchTerm)) {
    throw new Error("Der Suchbegriff muss 2 bis 120 Buchstaben oder Ziffern enthalten.");
  }
  if (!replacement || replacement.length > 120) {
    throw new Error("Der Ersatztext muss 1 bis 120 Zeichen enthalten.");
  }
  return { searchTerm, replacement };
}

export async function createPublicTextReplacementRule(formData: FormData) {
  const session = await requireAdmin();
  const rule = readRule(formData);
  await prisma.public_text_replacement_rules.create({
    data: {
      search_term: rule.searchTerm,
      replacement: rule.replacement,
      created_by_user_id: Number(session.user.id),
      updated_by_user_id: Number(session.user.id),
    },
  });
  revalidatePath(path);
}

export async function updatePublicTextReplacementRule(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Ungültige Regel.");
  const rule = readRule(formData);
  await prisma.public_text_replacement_rules.update({
    where: { public_text_replacement_rule_id: id },
    data: { search_term: rule.searchTerm, replacement: rule.replacement, updated_by_user_id: Number(session.user.id) },
  });
  revalidatePath(path);
}

export async function setPublicTextReplacementRuleActive(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Ungültige Regel.");
  await prisma.public_text_replacement_rules.update({
    where: { public_text_replacement_rule_id: id },
    data: { is_active: formData.get("active") === "true", updated_by_user_id: Number(session.user.id) },
  });
  revalidatePath(path);
}

export async function deletePublicTextReplacementRule(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Ungültige Regel.");
  await prisma.public_text_replacement_rules.delete({ where: { public_text_replacement_rule_id: id } });
  revalidatePath(path);
}
