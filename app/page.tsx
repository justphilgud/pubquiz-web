import Link from "next/link";
import {
  CalendarDaysIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  PaintBrushIcon,
  PencilSquareIcon,
  PlusIcon,
  QueueListIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  DashboardHero,
  DashboardPanel,
  QuickActionCard,
  StatCard,
} from "@/app/components/dashboard/DashboardCards";
import {
  QuestionTaskList,
  QuizList,
} from "@/app/components/dashboard/DashboardLists";
import {
  loadAdminQuestionDashboardData,
  loadAdminQuizDashboardData,
  loadAdminUserDashboardData,
  loadEditorDashboardData,
  type AdminQuestionDashboardData,
  type DashboardQuizItem,
  type EditorDashboardData,
} from "@/app/dashboardData";
import {
  getDashboardCapabilities,
  requireSession,
} from "@/app/lib/permissions";
import { ProgressBar } from "@/components/ui/ProgressBar";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeZone: "Europe/Berlin",
});

const panelActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50";

function getGreetingName(name: string | null | undefined, email: string) {
  const trimmedName = name?.trim();
  return trimmedName ? trimmedName.split(/\s+/)[0] : email.split("@")[0];
}

function getGreeting(name: string) {
  const berlinHour = Number(
    new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Berlin",
    }).format(new Date()),
  );

  if (berlinHour < 11) return `Guten Morgen, ${name}`;
  if (berlinHour < 18) return `Hallo, ${name}`;
  return `Guten Abend, ${name}`;
}

function editorHero(data: EditorDashboardData, greeting: string) {
  const firstChange = data.tasks.find(
    (task) => task.status === "CHANGES_REQUESTED",
  );
  const firstDraft = data.tasks.find((task) => task.status === "DRAFT");

  if (data.counts.changesRequested > 0) {
    return {
      eyebrow: greeting,
      title: `${data.counts.changesRequested} ${data.counts.changesRequested === 1 ? "Frage wartet" : "Fragen warten"} auf deine Überarbeitung.`,
      description: "Die Rückmeldung aus der Prüfung hat Vorrang vor neuen Entwürfen.",
      actionHref: firstChange
        ? `/fragen/editor/${firstChange.id}`
        : "/fragen?view=changes-requested",
      actionLabel: "Jetzt überarbeiten",
      icon: ExclamationTriangleIcon,
      tone: "amber" as const,
    };
  }

  if (data.counts.drafts > 0) {
    return {
      eyebrow: greeting,
      title: `${data.counts.drafts} ${data.counts.drafts === 1 ? "Entwurf ist" : "Entwürfe sind"} noch offen.`,
      description: "Setze den zuletzt bearbeiteten Entwurf fort oder erfasse eine neue Frage.",
      actionHref: firstDraft
        ? `/fragen/editor/${firstDraft.id}`
        : "/fragen?view=drafts",
      actionLabel: "Entwurf fortsetzen",
      icon: PencilSquareIcon,
      tone: "sky" as const,
    };
  }

  if (data.counts.inReview > 0) {
    return {
      eyebrow: greeting,
      title: `${data.counts.inReview} ${data.counts.inReview === 1 ? "Frage ist" : "Fragen sind"} in Prüfung.`,
      description: "Deine Einreichungen sind unterwegs. Du kannst währenddessen die nächste Frage vorbereiten.",
      actionHref: "/fragen/editor",
      actionLabel: "Neue Frage erstellen",
      icon: ClockIcon,
      tone: "sky" as const,
    };
  }

  return {
    eyebrow: greeting,
    title: "Bereit für eine neue Frage?",
    description: "Deine Arbeitsliste ist frei. Eine Standardfrage lässt sich direkt als Entwurf anlegen.",
    actionHref: "/fragen/editor",
    actionLabel: "Neue Frage erstellen",
    icon: PlusIcon,
    tone: "emerald" as const,
  };
}

function adminHero(
  data: AdminQuestionDashboardData,
  nextQuiz: DashboardQuizItem | undefined,
  greeting: string,
) {
  if (data.counts.awaitingReview > 0) {
    return {
      eyebrow: greeting,
      title: `${data.counts.awaitingReview} ${data.counts.awaitingReview === 1 ? "Frage wartet" : "Fragen warten"} auf deine Freigabe.`,
      description: "Die ältesten Einreichungen stehen in der Warteschlange zuerst.",
      actionHref: "/fragen?view=review",
      actionLabel: "Freigaben prüfen",
      icon: ClipboardDocumentCheckIcon,
      tone: "amber" as const,
    };
  }

  if (nextQuiz && nextQuiz.daysUntil <= 7) {
    const relative =
      nextQuiz.daysUntil === 0
        ? "heute"
        : nextQuiz.daysUntil === 1
          ? "morgen"
          : `in ${nextQuiz.daysUntil} Tagen`;

    return {
      eyebrow: greeting,
      title: `Das nächste Quiz ist ${relative}.`,
      description: `${nextQuiz.title} enthält aktuell ${nextQuiz.questionCount} Fragen und ${nextQuiz.teamCount} Teams.`,
      actionHref: `/quiz/${nextQuiz.id}`,
      actionLabel: "Quiz öffnen",
      icon: CalendarDaysIcon,
      tone: "sky" as const,
    };
  }

  const qualityIssues = data.counts.missingSource + data.counts.missingCategory;
  if (qualityIssues > 0) {
    return {
      eyebrow: greeting,
      title: `${qualityIssues} Qualitätshinweise brauchen Aufmerksamkeit.`,
      description: "Fehlende Quellen und Kategorien lassen sich in der Fragenredaktion ergänzen.",
      actionHref: "/fragen",
      actionLabel: "Fragenqualität prüfen",
      icon: DocumentMagnifyingGlassIcon,
      tone: "amber" as const,
    };
  }

  return {
    eyebrow: greeting,
    title: "Die Redaktion ist auf einem guten Stand.",
    description: "Aktuell warten keine Freigaben und keine Qualitätsprobleme auf dich.",
    actionHref: "/fragen/editor",
    actionLabel: "Neue Frage erstellen",
    icon: CheckBadgeIcon,
    tone: "emerald" as const,
  };
}

export default async function HomePage() {
  const session = await requireSession();
  const capabilities = getDashboardCapabilities(session);
  const userId = Number(session.user.id);
  const greetingName = getGreetingName(
    session.user.name,
    session.user.email ?? "Quizmaster",
  );
  const greeting = getGreeting(greetingName);

  const [editorResult, questionsResult, quizResult, usersResult] =
    await Promise.allSettled([
      capabilities.canViewOwnQuestionWorklist
        ? loadEditorDashboardData(userId)
        : Promise.resolve(null),
      capabilities.canViewReviewQueue
        ? loadAdminQuestionDashboardData()
        : Promise.resolve(null),
      capabilities.canManageQuizzes
        ? loadAdminQuizDashboardData()
        : Promise.resolve(null),
      capabilities.canManageUsers
        ? loadAdminUserDashboardData()
        : Promise.resolve(null),
    ]);

  const editorData = editorResult.status === "fulfilled" ? editorResult.value : null;
  const questionData = questionsResult.status === "fulfilled" ? questionsResult.value : null;
  const quizData = quizResult.status === "fulfilled" ? quizResult.value : null;
  const userData = usersResult.status === "fulfilled" ? usersResult.value : null;
  const dataUnavailable = [editorResult, questionsResult, quizResult, usersResult]
    .some((result) => result.status === "rejected");
  const nextQuiz = quizData?.upcomingQuizzes[0];
  const hero = questionData
    ? adminHero(questionData, nextQuiz, greeting)
    : editorData
      ? editorHero(editorData, greeting)
      : {
          eyebrow: greeting,
          title: "Was möchtest du heute bearbeiten?",
          description: "Öffne die Fragenredaktion oder erstelle direkt eine neue Frage.",
          actionHref: "/fragen/editor",
          actionLabel: "Neue Frage erstellen",
          icon: PlusIcon,
          tone: "slate" as const,
        };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <DashboardHero {...hero} />

        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-base font-semibold">
            Schnellzugriff
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.canCreateQuestion && (
              <QuickActionCard
                href="/fragen/editor"
                title="Neue Frage"
                description="Direkt mit einer neuen Frage starten."
                icon={PlusIcon}
              />
            )}
            {capabilities.canViewQuestionEditorial && (
              <QuickActionCard
                href="/fragen"
                title="Fragenredaktion"
                description="Arbeitslisten und Fragensuche öffnen."
                icon={QueueListIcon}
              />
            )}
            {capabilities.canManageQuizzes && (
              <>
                <QuickActionCard
                  href="/quiz"
                  title="Quizverwaltung"
                  description="Quiz-Abende und Fragenzuordnung verwalten."
                  icon={CalendarDaysIcon}
                />
                <QuickActionCard
                  href="/admin/eventreihen"
                  title="Eventreihen"
                  description="Veranstaltungsreihen und ihre Termine verwalten."
                  icon={BuildingOffice2Icon}
                />
              </>
            )}
          </div>
        </section>

        {dataUnavailable && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Einige Dashboard-Daten konnten gerade nicht geladen werden. Die verfügbaren Bereiche und Schnellzugriffe funktionieren weiterhin.
          </div>
        )}

        {editorData && (
          <section aria-labelledby="editor-heading" className="space-y-5">
            <div>
              <h2 id="editor-heading" className="text-xl font-semibold">Deine Arbeit</h2>
              <p className="mt-1 text-sm text-slate-500">Offene Aufgaben und dein aktueller Redaktionsfortschritt.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard href="/fragen?view=changes-requested" label="Überarbeitung" value={editorData.counts.changesRequested} icon={ExclamationTriangleIcon} tone={editorData.counts.changesRequested > 0 ? "amber" : "slate"} />
              <StatCard href="/fragen?view=drafts" label="Entwürfe" value={editorData.counts.drafts} icon={PencilSquareIcon} tone="sky" />
              <StatCard href="/fragen?view=review" label="In Prüfung" value={editorData.counts.inReview} icon={ClockIcon} />
              <StatCard href="/fragen" label="Freigegeben" value={editorData.counts.approved} icon={CheckBadgeIcon} tone="emerald" />
            </div>
            <DashboardPanel
              title="Deine nächsten Aufgaben"
              description="Rückgaben zuerst, danach Entwürfe und laufende Prüfungen."
              action={<Link href="/fragen" className={panelActionClassName}>Alle Fragen</Link>}
            >
              <QuestionTaskList entries={editorData.tasks} emptyTitle="Aktuell gibt es keine offenen Aufgaben." />
            </DashboardPanel>
            <div className="grid gap-4 md:grid-cols-2">
              <DashboardPanel title="Diese Woche" description="Aus den vorhandenen Erstellungs- und Freigabezeitpunkten.">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-sky-50 p-4">
                    <p className="text-2xl font-bold text-sky-900">{editorData.counts.createdThisWeek}</p>
                    <p className="mt-1 text-sm text-sky-800">erstellt</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-2xl font-bold text-emerald-900">{editorData.counts.approvedThisWeek}</p>
                    <p className="mt-1 text-sm text-emerald-800">freigegeben</p>
                  </div>
                </div>
              </DashboardPanel>
              <DashboardPanel title="Zuletzt bearbeitet">
                {editorData.lastEdited ? (
                  <Link href={`/fragen/editor/${editorData.lastEdited.id}`} className="block rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
                    <p className="line-clamp-2 font-medium text-slate-900">{editorData.lastEdited.text || "Fragetext fehlt"}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Frage fortsetzen →</p>
                  </Link>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Noch keine offene Frage vorhanden.</p>
                )}
              </DashboardPanel>
            </div>
          </section>
        )}

        {questionData && (
          <section aria-labelledby="admin-heading" className="space-y-5">
            <div>
              <h2 id="admin-heading" className="text-xl font-semibold">Was braucht deine Aufmerksamkeit?</h2>
              <p className="mt-1 text-sm text-slate-500">Die wichtigsten redaktionellen Aufgaben auf einen Blick.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard href="/fragen?view=review" label="Offene Freigaben" value={questionData.counts.awaitingReview} icon={ClipboardDocumentCheckIcon} tone={questionData.counts.awaitingReview > 0 ? "amber" : "slate"} />
              <StatCard href="/fragen" label="Zurückgegeben" value={questionData.counts.changesRequested} icon={ExclamationTriangleIcon} />
              <StatCard href="/fragen" label="Ohne Quelle" value={questionData.counts.missingSource} icon={DocumentMagnifyingGlassIcon} />
              <StatCard href="/fragen" label="Abgelaufen" value={questionData.counts.outdated} icon={ClockIcon} />
            </div>
            <DashboardPanel
              title="Freigabewarteschlange"
              description="Maximal fünf Einreichungen, älteste zuerst."
              action={<Link href="/fragen?view=review" className={panelActionClassName}>Alle Freigaben</Link>}
            >
              <QuestionTaskList entries={questionData.reviewQueue} emptyTitle="Aktuell wartet keine Frage auf Prüfung." showQualityWarnings />
            </DashboardPanel>
          </section>
        )}

        {quizData && (
          <section aria-labelledby="quiz-heading" className="space-y-4">
            <h2 id="quiz-heading" className="text-xl font-semibold">Nächstes Quiz</h2>
            {nextQuiz ? (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <DashboardPanel className="border-sky-200 bg-sky-50" title={nextQuiz.title} description={dateFormatter.format(nextQuiz.date)} action={<Link href={`/quiz/${nextQuiz.id}`} className={panelActionClassName}>Quiz öffnen</Link>}>
                  <div className="flex flex-wrap gap-2 text-sm text-sky-950">
                    <span className="rounded-full bg-white px-3 py-1.5 font-semibold">{nextQuiz.daysUntil === 0 ? "Heute" : nextQuiz.daysUntil === 1 ? "Morgen" : `In ${nextQuiz.daysUntil} Tagen`}</span>
                    <span className="rounded-full bg-white px-3 py-1.5">{nextQuiz.questionCount} Fragen</span>
                    <span className="rounded-full bg-white px-3 py-1.5">{nextQuiz.teamCount} Teams</span>
                  </div>
                </DashboardPanel>
                <DashboardPanel title="Weitere kommende Quizze" action={<Link href="/quiz" className={panelActionClassName}>Quizverwaltung</Link>}>
                  <QuizList entries={quizData.upcomingQuizzes.slice(1)} />
                </DashboardPanel>
              </div>
            ) : (
              <DashboardPanel title="Kein zukünftiges Quiz geplant" action={<Link href="/quiz" className={panelActionClassName}>Quizverwaltung öffnen</Link>}>
                <p className="text-sm text-slate-600">Lege in der Quizverwaltung einen neuen Termin an.</p>
              </DashboardPanel>
            )}
          </section>
        )}

        {questionData && (
          <section aria-label="Fragenqualität" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <DashboardPanel title="Fragenredaktion und Qualität" description="Bestand ohne archivierte Fragen.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><p className="text-xl font-bold">{questionData.counts.approved}</p><p className="text-xs text-slate-500">Freigegeben</p></div>
                <div><p className="text-xl font-bold">{questionData.counts.drafts}</p><p className="text-xs text-slate-500">Entwürfe</p></div>
                <div><p className="text-xl font-bold">{questionData.counts.missingCategory}</p><p className="text-xs text-slate-500">Ohne Kategorie</p></div>
                <div><p className="text-xl font-bold">{questionData.counts.outdated}</p><p className="text-xs text-slate-500">Abgelaufen</p></div>
              </div>
              {questionData.counts.approved > 0 && (
                <div className="mt-5">
                  <ProgressBar value={questionData.counts.approvedWithSource} max={questionData.counts.approved} label="Freigegebene Fragen mit Quelle" />
                </div>
              )}
            </DashboardPanel>
            <DashboardPanel title="Diese Woche">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3"><span className="text-sm text-sky-900">Neu erstellt</span><strong className="text-sky-950">{questionData.counts.createdThisWeek}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="text-sm text-emerald-900">Freigegeben</span><strong className="text-emerald-950">{questionData.counts.approvedThisWeek}</strong></div>
              </div>
            </DashboardPanel>
          </section>
        )}

        {userData && (
          <section aria-label="Administration">
            <DashboardPanel title="Administration" description="Benutzerbestand und echte Verwaltungsziele.">
              <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{userData.activeUsers}</p><p className="text-xs text-slate-500">Aktive Nutzer</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{userData.editors}</p><p className="text-xs text-slate-500">Editoren</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{userData.admins}</p><p className="text-xs text-slate-500">Admins</p></div>
                  <div className={userData.passwordChangeRequired > 0 ? "rounded-xl bg-amber-50 p-3" : "rounded-xl bg-slate-50 p-3"}><p className="text-xl font-bold">{userData.passwordChangeRequired}</p><p className="text-xs text-slate-500">Passwortwechsel offen</p></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <QuickActionCard href="/admin/users" title="Benutzerverwaltung" description="Konten, Rollen und Zugänge verwalten." icon={UserGroupIcon} />
                  <QuickActionCard href="/admin/styleguide" title="Styleguide" description="UI-Bausteine und Zustände prüfen." icon={PaintBrushIcon} />
                </div>
              </div>
              {userData.inactiveUsers > 0 && <p className="mt-4 text-xs text-slate-500">{userData.inactiveUsers} deaktivierte Nutzer sind weiterhin in der Benutzerverwaltung vorhanden.</p>}
            </DashboardPanel>
          </section>
        )}
      </div>
    </main>
  );
}
