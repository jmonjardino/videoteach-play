-- Add price to courses
begin;

alter table public.courses
  add column if not exists price numeric(10,2) not null default 0 check (price >= 0);

commit;