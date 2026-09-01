const counters = new Map<string, number>();
export function incrementMetric(name: string): void { counters.set(name, (counters.get(name) ?? 0) + 1); }
export function readMetrics(): Record<string, number> { return Object.fromEntries(counters); }
