import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import {
  CategoryAdminManager,
  type AdminCategoryRow,
} from "./CategoryAdminManager";

export default async function CategoriesAdminPage() {
  await requireAdmin();
  const categories = await prisma.fragenkategorie.findMany({
    orderBy: [{ status: "asc" }, { kategorie: "asc" }],
    select: {
      fragenkategorie_id: true,
      kategorie: true,
      status: true,
      created_at: true,
      updated_at: true,
      created_by: {
        select: { name: true, email: true },
      },
      _count: {
        select: { fragen_kategorien: true },
      },
    },
  });
  const rows: AdminCategoryRow[] = categories.map((category) => ({
    id: category.fragenkategorie_id,
    name: category.kategorie,
    status: category.status,
    questionCount: category._count.fragen_kategorien,
    createdBy:
      category.created_by?.name?.trim() ||
      category.created_by?.email ||
      "Unbekannt",
    createdAt: category.created_at.toLocaleDateString("de-DE"),
    updatedAt: category.updated_at.toLocaleDateString("de-DE"),
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Kategorienverwaltung</h1>
          <p className="mt-2 text-slate-600">
            Kategorien freigeben, archivieren, reaktivieren und
            zusammenführen.
          </p>
        </header>
        <CategoryAdminManager categories={rows} />
      </div>
    </main>
  );
}
