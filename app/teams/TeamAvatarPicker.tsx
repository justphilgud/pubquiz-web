"use client";

import { TeamAvatar, getTeamAvatarLabel } from "./TeamAvatar";
import { TEAM_AVATAR_CODES, type TeamAvatarCode } from "./teamProfile";

export function TeamAvatarPicker({ value, disabled = false, onChange }: { value: TeamAvatarCode; disabled?: boolean; onChange: (code: TeamAvatarCode) => void }) {
  return (
    <div className="grid max-w-3xl grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Team-Avatar wählen">
      {TEAM_AVATAR_CODES.map((code) => (
        <button key={code} type="button" role="radio" aria-checked={value === code} aria-label={getTeamAvatarLabel(code)} disabled={disabled} onClick={() => onChange(code)} className={`rounded-xl border-2 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${value === code ? "border-slate-900 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
          <TeamAvatar code={code} className="aspect-square w-full" />
        </button>
      ))}
    </div>
  );
}
