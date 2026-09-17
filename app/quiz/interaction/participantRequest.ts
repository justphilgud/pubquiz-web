export class ParticipantRequestError extends Error {
  constructor(public readonly status: number) { super("Die Verbindung konnte nicht bestätigt werden. Bitte erneut versuchen."); }
}

export async function participantRequest<T>(url: string, body: unknown, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      signal: controller.signal, body: JSON.stringify(body),
    });
    if (!response.ok) throw new ParticipantRequestError(response.status);
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

/** Also bound legacy action reads/writes; a timeout is uncertainty, never proof of rejection. */
export async function boundedParticipantAction<T>(action: Promise<T>, timeoutMs = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([action, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ParticipantRequestError(408)), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
