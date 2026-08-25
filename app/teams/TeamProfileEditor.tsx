"use client";

import { useRef, useState } from "react";
import { chooseOwnTeamAvatar, removeOwnTeamPhoto } from "./profileActions";
import { TeamAvatarPicker } from "./TeamAvatarPicker";
import { TeamIdentityVisual } from "./TeamIdentityVisual";
import type { TeamProfile } from "./teamProfile";

export function TeamProfileEditor({ quizId, sessionToken, teamName, initialProfile }: { quizId: number; sessionToken: string; teamName: string; initialProfile: TeamProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
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
    <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Globales Teamprofil">
      <div className="flex items-center gap-3">
        <TeamIdentityVisual name={teamName} photoUrl={profile.photoUrl} avatarCode={profile.avatarCode} className="h-16 w-16" />
        <div><h3 className="font-bold">Euer Teamprofil</h3><p className="text-sm text-slate-600">Foto und Avatar gelten in allen Eventreihen.</p></div>
      </div>
      <TeamAvatarPicker value={profile.avatarCode} disabled={pending} onChange={(code) => void chooseAvatar(code)} />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
      <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Foto aufnehmen</button>
        <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => libraryRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Aus Mediathek wählen</button>
        {profile.photoUrl && <button type="button" disabled={pending} onClick={() => void removePhoto()} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Foto entfernen</button>}
      </div>
      {profile.photoUploadLocked && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Foto-Uploads sind für dieses Team gesperrt. Ihr könnt weiterhin einen Avatar wählen.</p>}
      {message && <p role="status" aria-live="polite" className="text-sm font-semibold">{message}</p>}
    </section>
  );
}
