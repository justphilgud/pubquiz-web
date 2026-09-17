// Per-process cache only: concurrent requests share work, not cross-function statistics.
export function createMonitorCache<T>(read: () => Promise<T>, ttl: number, clock = Date.now) {
  let cached: { value: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && clock() < cached.expires) return Promise.resolve(cached.value);
    if (pending) return pending;
    pending = read().then(value => {
      cached = { value, expires: clock() + ttl };
      return value;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
