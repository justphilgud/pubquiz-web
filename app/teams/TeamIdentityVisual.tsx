import { TeamAvatar } from "./TeamAvatar";
import type { TeamAvatarCode } from "./teamProfile";

export function TeamIdentityVisual({
  name,
  photoUrl,
  avatarCode,
  className = "h-14 w-14",
}: {
  name: string;
  photoUrl: string | null | undefined;
  avatarCode: TeamAvatarCode;
  className?: string;
}) {
  return photoUrl ? (
    // Team photos are normalized trusted Blob assets with runtime URLs.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt={`Team ${name}`} className={`${className} rounded-full object-cover`} />
  ) : (
    <TeamAvatar code={avatarCode} className={className} />
  );
}
