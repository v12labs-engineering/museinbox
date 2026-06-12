create table if not exists public.museinbox_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.museinbox_state enable row level security;

create or replace function public.set_museinbox_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_museinbox_state_updated_at on public.museinbox_state;

create trigger set_museinbox_state_updated_at
before update on public.museinbox_state
for each row
execute function public.set_museinbox_state_updated_at();
