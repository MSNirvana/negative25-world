/** Returns a safe public in-app route for closing a photo viewer. */
export function photoReturnTarget(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/photo/')) return undefined;
  return value;
}

export function photoReturnQuery(fullPath: string): { returnTo: string } {
  return { returnTo: fullPath };
}
