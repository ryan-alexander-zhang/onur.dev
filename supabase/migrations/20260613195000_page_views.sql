create table if not exists public.pages (
  slug text primary key,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_slug_not_empty check (slug <> ''),
  constraint pages_view_count_nonnegative check (view_count >= 0)
);

alter table public.pages enable row level security;

grant select on table public.pages to anon, authenticated, service_role;

drop policy if exists "Public can read page views" on public.pages;
create policy "Public can read page views"
  on public.pages
  for select
  using (true);

create or replace function public.increment_view_count(page_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pages (slug, view_count, created_at, updated_at)
  values (page_slug, 1, now(), now())
  on conflict (slug)
  do update
    set view_count = public.pages.view_count + 1,
        updated_at = now();
end;
$$;

revoke all on function public.increment_view_count(text) from public;
revoke all on function public.increment_view_count(text) from anon;
revoke all on function public.increment_view_count(text) from authenticated;
grant execute on function public.increment_view_count(text) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pages'
  ) then
    alter publication supabase_realtime add table public.pages;
  end if;
end
$$;
