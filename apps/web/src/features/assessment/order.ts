/**
 * Display order for grouped instruments (the O*NET interest items come as 10 per RIASEC type in a row).
 * Round-robins across scales so neighbouring cards differ, and keeps unscaled items (attention checks)
 * at their original relative position so they look like any other card (D11).
 */
export function interleaveByScale<T extends { scale?: string }>(items: readonly T[]): T[] {
  const scaled = items.filter((i) => i.scale !== undefined);
  const loose = items.map((item, index) => ({ item, index })).filter((x) => x.item.scale === undefined);

  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const it of scaled) {
    const key = it.scale!;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(it);
  }
  const out: T[] = [];
  for (let round = 0; out.length < scaled.length; round++) {
    for (const key of order) {
      const g = groups.get(key)!;
      if (round < g.length) out.push(g[round]!);
    }
  }
  for (const { item, index } of loose) {
    const at = Math.min(out.length, Math.round((index / items.length) * out.length));
    out.splice(at, 0, item);
  }
  return out;
}
