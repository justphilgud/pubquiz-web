import type { Metadata } from "next";
import { requireActor } from "@/app/lib/permissions";
import { PresentationQualityPreview } from "./PresentationQualityPreview";

export const metadata: Metadata = { title: "Präsentationsreferenzen (intern)", robots: { index: false, follow: false } };

export default async function PresentationQualityPage() {
  await requireActor();
  return <PresentationQualityPreview />;
}
