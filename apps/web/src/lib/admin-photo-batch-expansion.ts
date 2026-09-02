type IdentifiedGroup = { key: string };

export function reconcileExpandedBatchKeys<T extends IdentifiedGroup>(current: ReadonlySet<string>, groups: readonly T[]): Set<string> {
  const visibleKeys = new Set(groups.map((group) => group.key));
  const next = new Set([...current].filter((key) => visibleKeys.has(key)));
  if (!next.size && groups.length) next.add(groups[0].key);
  return next;
}
