/** Server-side environment access with clear errors. Never import from client components. */

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function intEnv(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
