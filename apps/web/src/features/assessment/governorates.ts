/** Egypt's 27 governorates. Stored value = the id; display names live in messages (Assessment.governorates). */
export const GOVERNORATES = [
  'cairo',
  'giza',
  'alexandria',
  'qalyubia',
  'sharqia',
  'dakahlia',
  'gharbia',
  'monufia',
  'beheira',
  'kafr_el_sheikh',
  'damietta',
  'port_said',
  'ismailia',
  'suez',
  'north_sinai',
  'south_sinai',
  'fayoum',
  'beni_suef',
  'minya',
  'assiut',
  'sohag',
  'qena',
  'luxor',
  'aswan',
  'red_sea',
  'new_valley',
  'matrouh',
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

export const isGovernorate = (v: unknown): v is Governorate => (GOVERNORATES as readonly unknown[]).includes(v);
