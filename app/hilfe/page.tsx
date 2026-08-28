import { readFile } from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { requireUser } from "@/app/lib/auth-guard";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { getVisibleHelpTopics } from "./helpContent";
import { MarkdownHelp } from "./MarkdownHelp";

type Props = { searchParams: Promise<{ topic?: string }> };

export default async function HelpPage({ searchParams }: Props) {
  const session = await requireUser();
  const actor = await getActorForSession(session);
  const topics = getVisibleHelpTopics(actor);
  const requestedTopic = (await searchParams).topic;
  const activeTopic = topics.find((topic) => topic.slug === requestedTopic) ?? topics[0];
  const markdown = activeTopic
    ? await readFile(path.join(process.cwd(), "docs", activeTopic.source), "utf8")
    : "# Hilfe\n\nFür diese Rolle sind derzeit keine Hilfethemen hinterlegt.";

  return <>
    <AppHeader />
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Rollenabhängige Hilfe</p>
          <h1 className="px-2 pt-1 text-2xl font-bold">Bedienungsanleitung</h1>
          <nav aria-label="Hilfethemen" className="mt-4 space-y-1">
            {topics.map((topic) => <Link key={topic.slug} href={`/hilfe?topic=${topic.slug}`} aria-current={topic.slug === activeTopic?.slug ? "page" : undefined} className={`block rounded-xl px-3 py-3 transition ${topic.slug === activeTopic?.slug ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200" : "text-slate-700 hover:bg-slate-100"}`}>
              <span className="block font-semibold">{topic.title}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{topic.description}</span>
            </Link>)}
          </nav>
        </aside>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <MarkdownHelp source={markdown} />
          {activeTopic?.screenshots?.map((screenshot) => <figure key={screenshot.fileName} className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <Image src={`/hilfe/screenshots/${screenshot.fileName}`} alt={screenshot.alt} width={1440} height={1000} unoptimized className="h-auto w-full" />
            <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">{screenshot.caption}</figcaption>
          </figure>)}
        </section>
      </div>
    </main>
  </>;
}
