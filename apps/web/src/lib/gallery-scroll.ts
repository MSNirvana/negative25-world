const storagePrefix = 'negative25.gallery-scroll:';

function storageKey(routePath: string): string {
  return `${storagePrefix}${routePath}`;
}

export function rememberGalleryScroll(routePath: string, scrollY: number): void {
  if (typeof window === 'undefined' || !routePath) return;
  const value = Math.max(0, Math.round(scrollY));
  try {
    window.sessionStorage.setItem(storageKey(routePath), String(value));
  } catch {
    // Storage may be unavailable in privacy mode; the URL query remains the
    // primary restore path for an explicitly closed photo viewer.
  }
}

export function consumeGalleryScroll(routePath: string): number | undefined {
  if (typeof window === 'undefined' || !routePath) return undefined;
  try {
    const value = window.sessionStorage.getItem(storageKey(routePath));
    if (value === null || !/^\d+$/.test(value)) return undefined;
    window.sessionStorage.removeItem(storageKey(routePath));
    const scrollY = Number(value);
    return Number.isSafeInteger(scrollY) ? scrollY : undefined;
  } catch {
    return undefined;
  }
}

/** Restore after the gallery has reactivated, retrying while its content settles. */
export function restoreGalleryScroll(scrollY: number | undefined): void {
  if (scrollY === undefined || typeof window === 'undefined') return;
  let attempts = 0;
  const restore = (): void => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ left: 0, top: Math.min(scrollY, maxScroll), behavior: 'auto' });
    attempts += 1;
    if (window.scrollY < scrollY && attempts < 30) window.requestAnimationFrame(restore);
  };
  window.requestAnimationFrame(restore);
}
