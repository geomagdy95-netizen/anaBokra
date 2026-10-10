export type DataMode = 'local' | 'server';

/**
 * Where a student's data lives. Phase 1 (school pilot, January launch) keeps it on the device;
 * set NEXT_PUBLIC_DATA_MODE=server for the phase 2 flow (Supabase accounts and storage).
 */
export const DATA_MODE: DataMode = process.env.NEXT_PUBLIC_DATA_MODE === 'server' ? 'server' : 'local';
