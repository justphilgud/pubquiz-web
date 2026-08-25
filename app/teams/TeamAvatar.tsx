import type { TeamAvatarCode } from "./teamProfile";

const labels: Record<TeamAvatarCode, string> = {
  teekanne: "Teekanne",
  toaster: "Toaster",
  giesskanne: "Gießkanne",
  tischlampe: "Tischlampe",
  wecker: "Wecker",
  staubsauger: "Staubsauger",
  schneebesen: "Schneebesen",
  gummistiefel: "Gummistiefel",
  thermoskanne: "Thermoskanne",
  buegeleisen: "Bügeleisen",
};

function AvatarDrawing({ code }: { code: TeamAvatarCode }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (code === "teekanne") return <><path {...common} d="M27 47h48v31H27zM38 35h26M45 25h12M75 51c20-2 20 24 0 22M27 53C13 55 12 67 27 70" /><circle cx="51" cy="61" r="6" fill="currentColor" /></>;
  if (code === "toaster") return <><path {...common} d="M25 48c1-12 8-18 21-18h16c13 0 20 6 21 18l3 30H22zM38 42h31M35 78v8M73 78v8" /><path {...common} d="M88 51v17" /></>;
  if (code === "giesskanne") return <><path {...common} d="M31 49h45v31H31zM76 54c19 0 20 22 1 22M31 58 13 47M13 47l5-11M38 49V35h27v14" /></>;
  if (code === "tischlampe") return <><path {...common} d="M37 21h31l9 30H28zM52 51v25M38 82h30" /><circle cx="52" cy="42" r="5" fill="currentColor" /></>;
  if (code === "wecker") return <><circle {...common} cx="52" cy="57" r="27" /><path {...common} d="M37 30 25 20M67 30l12-10M52 57V39M52 57l13 9M34 82l-6 8M70 82l6 8" /><circle cx="52" cy="57" r="4" fill="currentColor" /></>;
  if (code === "staubsauger") return <><path {...common} d="M25 67h48c10 0 14 15 3 18H30c-14 0-17-18-5-18ZM37 67V47h27v20M64 47c20-23 23-23 24-9v34" /><circle cx="39" cy="85" r="5" fill="currentColor" /><circle cx="70" cy="85" r="5" fill="currentColor" /></>;
  if (code === "schneebesen") return <><path {...common} d="M52 65v25M42 65c-19-20-13-47 10-47s29 27 10 47M52 18v47M43 65c-8-24-5-47 9-47s17 23 9 47" /></>;
  if (code === "gummistiefel") return <><path {...common} d="M28 20h29v42c0 9 9 12 20 12h8v14H43c-10 0-15-6-15-15z" /><path {...common} d="M28 36h29" /></>;
  if (code === "thermoskanne") return <><path {...common} d="M35 24h34v12H35zM39 36h26v50H39zM65 45c21 0 21 27 0 27" /><path {...common} d="M46 50h12" /></>;
  return <><path {...common} d="M20 65c8-29 26-42 56-42h8v48H20zM29 71v10h55M73 23v48" /><circle cx="42" cy="58" r="5" fill="currentColor" /></>;
}

export function TeamAvatar({ code, className = "h-12 w-12" }: { code: TeamAvatarCode; className?: string }) {
  return (
    <svg viewBox="0 0 104 104" role="img" aria-label={labels[code]} className={className}>
      <rect x="2" y="2" width="100" height="100" rx="28" fill="var(--team-avatar-bg, #fef3c7)" />
      <g color="var(--team-avatar-fg, #7c2d12)"><AvatarDrawing code={code} /></g>
    </svg>
  );
}

export function getTeamAvatarLabel(code: TeamAvatarCode) {
  return labels[code];
}
