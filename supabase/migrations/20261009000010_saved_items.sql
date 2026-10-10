begin;
-- MX-22: saved_opportunities can hold programs, universities and providers (slug ids from the content
-- package) as well as curated opportunities. RLS policies and the engagement consent-gate trigger are
-- table-level and stay in place.
alter table public.saved_opportunities
  add column item_kind text not null default 'opportunity' check (item_kind in ('program', 'university', 'provider', 'opportunity')),
  add column item_id   text;

update public.saved_opportunities set item_id = opportunity_id::text where item_id is null;

alter table public.saved_opportunities drop constraint saved_opportunities_pkey;

alter table public.saved_opportunities
  alter column item_id set not null,
  alter column item_kind drop default,
  alter column opportunity_id drop not null,
  add check (item_kind <> 'opportunity' or opportunity_id is not null),
  add check (char_length(item_id) between 1 and 160);


alter table public.saved_opportunities add primary key (user_id, item_kind, item_id);
commit;
