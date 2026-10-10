import { GOVERNORATES, type Governorate } from '@/features/assessment/governorates';

/** Content stores English governorate names ("Beni Suef"); the app uses ids ("beni_suef"). */
export function governorateId(name: string | null | undefined): Governorate | null {
  if (!name) return null;
  const slug = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const fixed = slug === 'menoufia' ? 'monufia' : slug;
  return (GOVERNORATES as readonly string[]).includes(fixed) ? (fixed as Governorate) : null;
}

/**
 * Schematic tile map of Egypt: [column, row] per governorate, laid out roughly north (top) to south.
 * It is a cartogram, not a surveyed map, so it needs no tiles, fonts or network.
 */
export const MAP_TILES: Record<Governorate, [number, number]> = {
  matrouh: [0, 0],
  alexandria: [1, 0],
  kafr_el_sheikh: [2, 0],
  damietta: [3, 0],
  port_said: [4, 0],
  north_sinai: [5, 0],
  beheira: [1, 1],
  gharbia: [2, 1],
  dakahlia: [3, 1],
  sharqia: [4, 1],
  ismailia: [5, 1],
  monufia: [2, 2],
  qalyubia: [3, 2],
  cairo: [4, 2],
  suez: [5, 2],
  south_sinai: [6, 2],
  fayoum: [2, 3],
  giza: [3, 3],
  beni_suef: [3, 4],
  minya: [3, 5],
  red_sea: [5, 5],
  assiut: [3, 6],
  new_valley: [2, 7],
  sohag: [3, 7],
  qena: [3, 8],
  luxor: [3, 9],
  aswan: [3, 10],
};

/** Provider place values: "nationwide" and "online" stay as they are, governorate names become ids. */
export function placeId(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower === 'nationwide' || lower === 'online') return lower;
  return governorateId(name) ?? lower;
}
