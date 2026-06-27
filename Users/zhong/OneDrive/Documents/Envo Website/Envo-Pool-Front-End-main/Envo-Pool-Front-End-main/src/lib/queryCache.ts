/**
 * Helper to get cached data from localStorage for react-query initialData.
 * Returns undefined if no cache exists (so react-query fetches normally).
 */
export function getCached<T>(key: string): T | undefined {
  try {
    const cached = localStorage.getItem(`cache:${key}`);
    if (cached) return JSON.parse(cached) as T;
  } catch {}
  return undefined;
}

/**
 * Persist data to localStorage cache after a successful fetch.
 */
export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(`cache:${key}`, JSON.stringify(data));
  } catch {}
}
