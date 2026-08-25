"use client";

import { useRef, useState } from "react";
import { chooseManagedTeamAvatar, removeManagedTeamPhoto, setManagedTeamPhotoUploadLock } from "@/app/teams/teamProfileManagementActions";
import { TeamAvatarPicker } from "@/app/teams/TeamAvatarPicker";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";
import type { TeamProfile } from "@/app/teams/teamProfile";

export function TeamProfileManagementPanel({ teamName, initialProfile, isAdmin }: { teamName: string; initialProfile: TeamProfile; isAdmin: boolean }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file || !isAdmin) return;
    setPending(true);
    const body = new FormData();
    body.set("mode", "ADMIN");
    body.set("teamId", String(profile.teamId));
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

  async function updateAvatar(avatarCode: TeamProfile["avatarCode"]) {
    setPending(true);
    const result = await chooseManagedTeamAvatar({ teamId: profile.teamId, avatarCode });
    if (result.success) setProfile(result.profile);
    setMessage(result.success ? "Avatar gespeichert." : result.message);
    setPending(false);
  }

  async function removePhoto() {
    setPending(true);
    const result = await removeManagedTeamPhoto({ teamId: profile.teamId });
    if (result.success) setProfile(result.profile);
    setMessage(result.success ? "Teamfoto entfernt." : result.message);
    setPending(false);
  }

  async function toggleLock() {
    setPending(true);
    const result = await setManagedTeamPhotoUploadLock({ teamId: profile.teamId, locked: !profile.photoUploadLocked });
    if (result.success) setProfile(result.profile);
    setMessage(result.success ? `Foto-Upload ${result.profile.photoUploadLocked ? "gesperrt" : "freigegeben"}.` : result.message);
    setPending(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <TeamIdentityVisual name={teamName} photoUrl={profile.photoUrl} avatarCode={profile.avatarCode} className="h-20 w-20" />
        <div><h2 className="text-lg font-bold">Globales Teamprofil</h2><p className="text-sm text-slate-600">Foto, Avatar und Upload-Sperre gelten in allen Eventreihen.</p></div>
      </div>
      {isAdmin && <div className="mt-5"><h3 className="mb-2 text-sm font-bold">Avatar wählen</h3><TeamAvatarPicker value={profile.avatarCode} disabled={pending} onChange={(code) => void updateAvatar(code)} /></div>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
      <div className="mt-5 flex flex-wrap gap-2">
        {isAdmin && <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Foto hochladen/ersetzen</button>}
        {profile.photoUrl && <button type="button" disabled={pending} onClick={() => void removePhoto()} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Foto entfernen</button>}
        <button type="button" disabled={pending} onClick={() => void toggleLock()} className="min-h-11 rounded-xl border border-amber-300 px-4 py-2 font-semibold text-amber-900 disabled:opacity-50">{profile.photoUploadLocked ? "Foto-Upload freigeben" : "Foto-Upload sperren"}</button>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">Status: {profile.photoUrl ? "Teamfoto aktiv" : "Avatar aktiv"} · Upload {profile.photoUploadLocked ? "gesperrt" : "erlaubt"}</p>
      {!isAdmin && <p className="mt-2 text-sm text-slate-600">Eventmanager können im eigenen Scope Fotos entfernen und Uploads sperren, aber keine Fotos hochladen oder Avatare ändern.</p>}
      {message && <p className="mt-3 text-sm font-semibold" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
