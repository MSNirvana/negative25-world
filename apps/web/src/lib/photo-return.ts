/** Returns a safe public in-app route for closing a photo viewer. */
export function photoReturnTarget(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/photo/')) return undefined;
  return value;
}

export function photoReturnQuery(fullPath: string, scrollY = typeof window === 'undefined' ? 0 : window.scrollY): { returnTo: string; returnScroll: string } {
  return { returnTo: fullPath, returnScroll: String(Math.max(0, Math.round(scrollY))) };
}

export function photoReturnScroll(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const scrollY = Number(value);
  return Number.isSafeInteger(scrollY) ? scrollY : undefined;
}
