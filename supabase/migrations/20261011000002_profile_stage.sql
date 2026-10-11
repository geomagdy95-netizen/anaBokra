-- Profile stage for the 18–25 audience (world-spec §6 item 3): school, university (field + year) or
-- graduate (field + graduation year). Mirrors UserContext in packages/engine/src/types.ts.
-- Phase 1 keeps these on the device; this is the phase 2 server shape.

alter table public.profiles
  add column stage       text check (stage in ('school', 'university', 'graduate')),
  add column study_field text check (study_field in (
    'medicine', 'dentistry', 'pharmacy', 'nursing', 'allied_health', 'veterinary', 'engineering',
    'computing', 'science', 'agriculture', 'commerce', 'economics_politics', 'law', 'arts_humanities',
    'languages', 'mass_communication', 'education', 'arts', 'tourism_archaeology', 'technical', 'other')),
  add column study_year  smallint check (study_year between 1 and 7),
  add column grad_year   smallint check (grad_year between 1990 and 2100);
