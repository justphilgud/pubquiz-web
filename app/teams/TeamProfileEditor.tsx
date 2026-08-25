"use client";

import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useId, useRef, useState } from "react";
import { chooseOwnTeamAvatar, removeOwnTeamPhoto } from "./profileActions";
import { TeamAvatarPicker } from "./TeamAvatarPicker";
import { TeamIdentityVisual } from "./TeamIdentityVisual";
import type { TeamProfile } from "./teamProfile";

export function TeamProfileEditor({
  quizId,
  sessionToken,
  teamName,
  initialProfile,
  initiallyOpen = false,
  calendarSubscriptionUrl,
}: {
  quizId: number;
  sessionToken: string;
  teamName: string;
  initialProfile: TeamProfile;
  initiallyOpen?: boolean;
  calendarSubscriptionUrl: string;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const panelId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage("");
    const body = new FormData();
    body.set("mode", "TEAM");
    body.set("quizId", String(quizId));
    body.set("sessionToken", sessionToken);
    body.set("file", file);
    try {
      const response = await fetch("/api/team-profile-photo", { method: "POST", body });
      const result = await response.json() as { success: boolean; profile?: TeamProfile; message?: string };
      if (!response.ok || !result.success || !result.profile) throw new Error(result.message);
      setProfile(result.profile);
      setMessage("Teamfoto gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Foto konnte nicht gespeichert werden.");
    } finally {
      setPending(false);
    }
  }

  async function chooseAvatar(avatarCode: TeamProfile["avatarCode"]) {
    setPending(true);
    const result = await chooseOwnTeamAvatar({ quizId, sessionToken, avatarCode });
    if (result.success) setProfile(result.profile);
    setMessage(result.success ? "Avatar gespeichert." : result.message);
    setPending(false);
  }

  async function removePhoto() {
    setPending(true);
    const result = await removeOwnTeamPhoto({ quizId, sessionToken });
    if (result.success) setProfile(result.profile);
    setMessage(result.success ? "Foto entfernt. Euer Avatar ist wieder aktiv." : result.message);
    setPending(false);
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Globales Teamprofil">
      <div className="flex items-center gap-3">
        <TeamIdentityVisual name={teamName} photoUrl={profile.photoUrl} avatarCode={profile.avatarCode} className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold">{teamName}</h3>
          <p className="text-sm text-slate-600">Euer globales Teamprofil</p>
        </div>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Teamprofil-Einstellungen {isOpen ? "schließen" : "öffnen"}</span>
        </button>
      </div>

      {isOpen && (
        <div id={panelId} className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <div>
            <h4 className="font-bold">Avatar wählen</h4>
            <p className="mb-2 text-sm text-slate-600">Foto und Avatar gelten in allen Eventreihen.</p>
            <TeamAvatarPicker value={profile.avatarCode} disabled={pending} onChange={(code) => void chooseAvatar(code)} />
          </div>
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Foto aufnehmen</button>
            <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => libraryRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Aus Mediathek wählen</button>
            {profile.photoUrl && <button type="button" disabled={pending} onClick={() => void removePhoto()} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Foto entfernen</button>}
            <a href={calendarSubscriptionUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-center font-semibold text-slate-700">PubQuiz-Kalender abonnieren</a>
          </div>
          {profile.photoUploadLocked && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Foto-Uploads sind für dieses Team gesperrt. Ihr könnt weiterhin einen Avatar wählen.</p>}
          {message && <p role="status" aria-live="polite" className="text-sm font-semibold">{message}</p>}
        </div>
      )}
    </section>
  );
}
