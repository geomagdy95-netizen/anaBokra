export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Pearson correlation; returns null when either vector has no variance. */
export function pearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! - ma;
    const y = b[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da < 1e-12 || db < 1e-12) return null;
  return num / Math.sqrt(da * db);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Cronbach's alpha for a respondents x items matrix (rows = respondents). */
export function cronbachAlpha(matrix: number[][]): number | null {
  const k = matrix[0]?.length ?? 0;
  if (matrix.length < 2 || k < 2) return null;
  const itemVars = Array.from({ length: k }, (_, j) => variance(matrix.map((r) => r[j]!)));
  const totalVar = variance(matrix.map((r) => r.reduce((a, b) => a + b, 0)));
  if (totalVar < 1e-12) return null;
  return (k / (k - 1)) * (1 - itemVars.reduce((a, b) => a + b, 0) / totalVar);
}
