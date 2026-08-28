import Image from "next/image";
import type { TeamAvatarCode } from "./teamProfile";

const avatarPresentation: Record<TeamAvatarCode, { label: string; src: string }> = {
  teekanne: { label: "Detektiv-Einhorn", src: "/team-avatars/teekanne.webp" },
  toaster: { label: "Rennschnecke", src: "/team-avatars/toaster.webp" },
  giesskanne: { label: "Schreckfisch", src: "/team-avatars/giesskanne.webp" },
  tischlampe: { label: "Döner-Professor", src: "/team-avatars/tischlampe.webp" },
  wecker: { label: "Dino-Schüler", src: "/team-avatars/wecker.webp" },
  staubsauger: { label: "Waschbär-Philosoph", src: "/team-avatars/staubsauger.webp" },
  schneebesen: { label: "Tauben-Detektiv", src: "/team-avatars/schneebesen.webp" },
  gummistiefel: { label: "Pilz-Schüler", src: "/team-avatars/gummistiefel.webp" },
  thermoskanne: { label: "Muskel-Büroklammer", src: "/team-avatars/thermoskanne.webp" },
  buegeleisen: { label: "Kartoffel-Professor", src: "/team-avatars/buegeleisen.webp" },
};

export function TeamAvatar({ code, className = "h-12 w-12" }: { code: TeamAvatarCode; className?: string }) {
  return (
    <Image
      src={avatarPresentation[code].src}
      alt={avatarPresentation[code].label}
      width={640}
      height={640}
      sizes="(max-width: 640px) 20vw, 128px"
      className={`rounded-[28%] object-cover ${className}`}
    />
  );
}

export function getTeamAvatarLabel(code: TeamAvatarCode) {
  return avatarPresentation[code].label;
}
