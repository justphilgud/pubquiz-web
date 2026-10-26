"use client";
import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { TeamAvatar } from "@/app/teams/TeamAvatar";
import { changeGameTeamAction, gameTeamsAction } from "./teamActions";
import type { GameType } from "./gameDraft";
import type { GameTeamsView, GameTeamAssignment } from "./gameTeams";

export default function GameTeamsPanel({ type, gameId, seriesId, updatedAt, initial, blocked, onBusy }: { type: GameType; gameId: string; seriesId: number; updatedAt: string; initial: GameTeamsView; blocked: boolean; onBusy: (busy: boolean) => void }) {
  const [data,setData] = useState(initial);
  const [search,setSearch] = useState("");
  const [assignedSearch,setAssignedSearch] = useState("");
  const [message,setMessage] = useState<{error:boolean;text:string}|null>(null);
  const [removal,setRemoval] = useState<GameTeamAssignment|null>(null);
  const [pending,startTransition] = useTransition();
  const disabled = blocked || pending;
  function run(operation: "SEARCH" | "ADD" | "REMOVE", id?: number | string) {
    if (disabled) return;
    onBusy(true);
    startTransition(async () => {
      try {
        const result = operation === "SEARCH" ? await gameTeamsAction(type,gameId,search) : await changeGameTeamAction(type,{gameId,seriesId,updatedAt,operation,...(operation === "ADD" ? {teamId:id} : {assignmentId:id})});
        if (!result.success) { setMessage({error:true,text:result.message}); return; }
        setData(result.data); setRemoval(null);
        if (operation !== "SEARCH") setSearch("");
        setMessage({error:false,text:operation === "ADD" ? "Team zugeordnet." : operation === "REMOVE" ? "Zuordnung entfernt. Das Team bleibt erhalten." : "Teamsuche aktualisiert."});
      } catch { setMessage({error:true,text:"Die Aktion ist fehlgeschlagen. Deine Spielstammdaten bleiben unverändert."}); }
      finally { onBusy(false); }
    });
  }
  const visible = data.assigned.filter(a=>a.team.name.toLocaleLowerCase("de").includes(assignedSearch.toLocaleLowerCase("de")));
  return <section aria-labelledby="game-teams-heading" className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="game-teams-heading" className="text-xl">Teams</h2>
    <p className="text-sm text-slate-600">Geplante Teilnahme – keine Anmeldung, Anwesenheit oder Punkte.</p>
    {blocked && <p role="status" className="text-sm">Bitte zuerst die geänderten Spielstammdaten speichern. Teamzuordnungen speichern keine Stammdaten mit.</p>}
    {message && <p role={message.error?"alert":"status"} className="text-sm">{message.text}</p>}
    {data.assigned.length>10 && <label className="block text-sm">Zuordnungen durchsuchen<Input value={assignedSearch} onChange={e=>setAssignedSearch(e.target.value)} /></label>}
    {!data.assigned.length && <p>Noch keine Teams zugeordnet.</p>}
    {data.assigned.length>0 && !visible.length && <p>Keine passende Zuordnung. Die übrigen Zuordnungen bleiben erhalten.</p>}
    <ul className="max-h-96 space-y-2 overflow-y-auto">{visible.map(a=><li key={a.id} className="flex min-w-0 flex-wrap items-center gap-3 border-b py-2">
      <TeamAvatar code={a.team.avatar} className="h-10 w-10 shrink-0" /><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{a.team.name}{a.team.archived && <span className="block text-xs">Archiviert</span>}</span>
      {data.canWrite && <Button type="button" variant="secondary" disabled={disabled} onClick={()=>setRemoval(a)} aria-label={`Zuordnung entfernen: ${a.team.name}`}>Zuordnung entfernen</Button>}
    </li>)}</ul>
    {data.canWrite && <div className="space-y-3">
      {!data.canAdd ? <p>In archivierten Eventreihen können keine neuen Teams zugeordnet werden.</p> : !data.hasTeamScope ? <p>Deine bestehende Teamverwaltung enthält keinen auswählbaren Teambestand. Eine Spielberechtigung allein erlaubt keine globale Teamsuche.</p> : <>
        <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">Vorhandene Teams suchen<Input maxLength={150} value={search} disabled={disabled} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();run("SEARCH");}}} /></label><Button type="button" disabled={disabled} onClick={()=>run("SEARCH")}>Teams suchen</Button></div>
        {data.hasMore && <p className="text-sm">Die ersten 50 Treffer werden angezeigt. Bitte die Suche eingrenzen.</p>}
        {!data.candidates.length && <p>Keine weiteren zulässigen aktiven Teams gefunden. Bereits zugeordnete Teams werden nicht erneut angeboten.</p>}
        <ul className="max-h-72 space-y-2 overflow-y-auto">{data.candidates.map(t=><li key={t.id} className="flex min-w-0 items-center gap-3 py-1"><TeamAvatar code={t.avatar} className="h-9 w-9 shrink-0" /><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{t.name}</span><Button type="button" disabled={disabled} onClick={()=>run("ADD",t.id)} aria-label={`Team hinzufügen: ${t.name}`}>Hinzufügen</Button></li>)}</ul>
      </>}
    </div>}
    <Modal open={removal!==null} title="Zuordnung entfernen?" onClose={()=>{if(!pending)setRemoval(null);}} footer={<div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={()=>setRemoval(null)}>Abbrechen</Button><Button type="button" disabled={disabled} onClick={()=>run("REMOVE",removal?.id)}>Zuordnung entfernen</Button></div>}><p className="break-words [overflow-wrap:anywhere]">Die geplante Teilnahme von „{removal?.team.name}“ wird entfernt. Teamprofil, andere Zuordnungen und Quizhistorie bleiben erhalten.</p></Modal>
  </section>;
}
