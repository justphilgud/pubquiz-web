import type { Metadata } from "next";
import { requireActor } from "@/app/lib/permissions";
import { qualityScenarios, type QualityScenario } from "@/app/rendering/presentation/presentationQualityFixtures";
import type { PresentationDesignStyle } from "@/app/rendering/templateRegistry";
import { PresentationQualityPreview } from "./PresentationQualityPreview";

export const metadata: Metadata = { title: "Präsentationsreferenzen (intern)", robots: { index: false, follow: false } };

export default async function PresentationQualityPage({ searchParams }: { searchParams: Promise<{ scenario?: string; style?: string }> }) {
  await requireActor();
  const params = await searchParams;
  const scenario = qualityScenarios.find(value => value === params.scenario) ?? "short";
  const styles: Array<PresentationDesignStyle | "PHIL_GUD"> = ["EDITORIAL", "PHIL_GUD", "NEON", "CORPORATE", "BIRTHDAY", "KOMM_ONE"];
  const style = styles.find(value => value === params.style) ?? "NEON";
  return <PresentationQualityPreview initialScenario={scenario as QualityScenario} initialStyle={style} />;
}
