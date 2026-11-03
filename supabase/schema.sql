-- TradAI tracking: one events table, written only through log_event(), read only by the admin.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('visit','download','install','open','signin','signup','pro_open','pro_proof','pro_active')),
  source text not null check (source in ('web','app')),
  email text,
  app_version text,
  platform text,
  page text,
  referrer text,
  ip text,
  country text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_kind_idx on public.events (kind, created_at desc);
create index if not exists events_email_idx on public.events (lower(email));

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;

-- Only the owner can read.
drop policy if exists "owner reads events" on public.events;
create policy "owner reads events" on public.events for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'zisou555@gmail.com');

-- The website and the app call this. IP and country come from the request headers,
-- so clients cannot fake them.
create or replace function public.log_event(
  p_kind text, p_source text, p_email text default null, p_app_version text default null,
  p_platform text default null, p_page text default null, p_referrer text default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  fwd text := h ->> 'x-forwarded-for';
begin
  insert into public.events (kind, source, email, app_version, platform, page, referrer, ip, country, user_agent, meta)
  values (
    left(p_kind, 20), left(p_source, 10),
    nullif(left(lower(trim(p_email)), 200), ''),
    left(p_app_version, 40), left(p_platform, 40), left(p_page, 200), left(p_referrer, 300),
    coalesce(h ->> 'cf-connecting-ip', trim(split_part(fwd, ',', 1)), h ->> 'x-real-ip'),
    upper(left(h ->> 'cf-ipcountry', 2)),
    left(h ->> 'user-agent', 300),
    coalesce(p_meta, '{}'::jsonb)
  );
end $$;
revoke all on function public.log_event(text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.log_event(text,text,text,text,text,text,text,jsonb) to anon, authenticated;
