"use client";

import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useId, useRef, useState } from "react";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { chooseOwnTeamAvatar, removeOwnTeamPhoto } from "./profileActions";
import { TeamAvatarPicker } from "./TeamAvatarPicker";
import { TeamIdentityVisual } from "./TeamIdentityVisual";
import type { TeamProfile } from "./teamProfile";
import { TeamPhotoUploadResponseError, uploadTeamPhoto } from "./teamPhotoUpload.client";

type ProfileMessage = { kind: "SUCCESS" | "ERROR"; text: string } | null;

export function TeamProfileEditor({
  quizId,
  sessionToken,
  teamName,
  initialProfile,
  initiallyOpen = false,
  calendarSubscriptionUrl,
  uploadEnvironmentPrefix,
}: {
  quizId: number;
  sessionToken: string;
  teamName: string;
  initialProfile: TeamProfile;
  initiallyOpen?: boolean;
  calendarSubscriptionUrl: string;
  uploadEnvironmentPrefix: BlobEnvironmentPrefix;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [message, setMessage] = useState<ProfileMessage>(null);
  const [pending, setPending] = useState(false);
  const panelId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      const nextProfile = await uploadTeamPhoto(file, uploadEnvironmentPrefix, {
        mode: "TEAM",
        teamId: profile.teamId,
        quizId,
        sessionToken,
      });
      setProfile(nextProfile);
      setMessage({ kind: "SUCCESS", text: "Teamfoto gespeichert." });
    } catch (error) {
      console.error("Teamfoto-Upload im Browser fehlgeschlagen", {
        errorName: error instanceof Error ? error.name : typeof error,
        ...(error instanceof TeamPhotoUploadResponseError ? error.details : {}),
      });
      setMessage({
        kind: "ERROR",
        text: error instanceof Error && error.message ? error.message : "Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.",
      });
    } finally {
      setPending(false);
    }
  }

  async function chooseAvatar(avatarCode: TeamProfile["avatarCode"]) {
    setPending(true);
    const result = await chooseOwnTeamAvatar({ quizId, sessionToken, avatarCode });
    if (result.success) setProfile(result.profile);
    setMessage({ kind: result.success ? "SUCCESS" : "ERROR", text: result.success ? "Avatar gespeichert." : result.message });
    setPending(false);
  }

  async function removePhoto() {
    setPending(true);
    const result = await removeOwnTeamPhoto({ quizId, sessionToken });
    if (result.success) setProfile(result.profile);
    setMessage({ kind: result.success ? "SUCCESS" : "ERROR", text: result.success ? "Foto entfernt. Euer Avatar ist wieder aktiv." : result.message });
    setPending(false);
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-300 bg-white p-3 text-slate-950 shadow-sm sm:p-4" aria-label="Globales Teamprofil">
      <div className="flex items-center gap-3">
        <TeamIdentityVisual name={teamName} photoUrl={profile.photoUrl} avatarCode={profile.avatarCode} className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-950">{teamName}</h3>
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
            <h4 className="font-bold text-slate-950">Avatar wählen</h4>
            <p className="mb-2 text-sm text-slate-600">Foto und Avatar gelten in allen Eventreihen.</p>
            <TeamAvatarPicker value={profile.avatarCode} disabled={pending} onChange={(code) => void chooseAvatar(code)} />
          </div>
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          <input ref={libraryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-xl border border-slate-500 bg-white px-4 py-2 font-semibold text-slate-950 transition hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Foto aufnehmen</button>
            <button type="button" disabled={pending || profile.photoUploadLocked} onClick={() => libraryRef.current?.click()} className="min-h-11 rounded-xl border border-slate-500 bg-white px-4 py-2 font-semibold text-slate-950 transition hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Aus Mediathek wählen</button>
            {profile.photoUrl && <button type="button" disabled={pending} onClick={() => void removePhoto()} className="min-h-11 rounded-xl border border-red-400 bg-white px-4 py-2 font-semibold text-red-800 transition hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Foto entfernen</button>}
            <a href={calendarSubscriptionUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-500 bg-white px-4 py-2 text-center font-semibold text-slate-900 transition hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">PubQuiz-Kalender abonnieren</a>
          </div>
          {profile.photoUploadLocked && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Foto-Uploads sind für dieses Team gesperrt. Ihr könnt weiterhin einen Avatar wählen.</p>}
          {message && (
            <p
              role={message.kind === "ERROR" ? "alert" : "status"}
              aria-live="polite"
              className={message.kind === "ERROR"
                ? "rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800"
                : "rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
