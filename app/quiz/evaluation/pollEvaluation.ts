// One request at a time; disposal also suppresses a late response after navigation.
export function pollEvaluation<T>(
  read: () => Promise<T>,
  apply: (value: T) => void,
  onError: () => void = () => {},
  intervalMs = 2000,
) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    try {
      const value = await read();
      if (active) apply(value);
    } catch {
      if (active) onError();
    } finally {
      if (active) timer = setTimeout(refresh, intervalMs);
    }
  }
  void refresh();
  return () => {
    active = false;
    clearTimeout(timer);
  };
}
