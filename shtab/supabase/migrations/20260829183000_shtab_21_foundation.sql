-- Shtab 2.1: owner workspace, operational modules, settings and secure RLS.
-- Existing project, CRM and sync data is preserved and assigned to the current owner.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  locale text not null default 'ru-RU',
  timezone text not null default 'Europe/Berlin',
  currency text not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Штаб 2.1',
  description text,
  logo_text text not null default 'S2',
  locale text not null default 'ru-RU',
  timezone text not null default 'Europe/Berlin',
  currency text not null default 'RUB',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  workday_start time not null default '09:00',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.projects add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.projects add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists stage text not null default 'development';
alter table public.projects add column if not exists health text not null default 'stable' check (health in ('strong','stable','risk','critical'));
alter table public.projects add column if not exists color text not null default '#8fa4ff';
alter table public.projects add column if not exists goal text;
alter table public.projects add column if not exists next_step text;
alter table public.projects add column if not exists budget numeric(16,2) not null default 0 check (budget >= 0);
alter table public.projects add column if not exists revenue_target numeric(16,2) not null default 0 check (revenue_target >= 0);
alter table public.projects add column if not exists currency text not null default 'RUB';
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists target_date date;

alter table public.work_items add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.work_items add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.work_items add column if not exists description text;
alter table public.work_items add column if not exists assignee_name text;
alter table public.work_items add column if not exists impact smallint not null default 3 check (impact between 1 and 5);
alter table public.work_items add column if not exists urgency smallint not null default 3 check (urgency between 1 and 5);
alter table public.work_items add column if not exists tags text[] not null default '{}';
alter table public.work_items add column if not exists reminder_at timestamptz;
alter table public.work_items add column if not exists recurrence text;
alter table public.work_items add column if not exists completed_at timestamptz;
alter table public.work_items add column if not exists parent_id uuid references public.work_items(id) on delete set null;
alter table public.work_items add column if not exists related_entity_id uuid references public.external_entities(id) on delete set null;

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  body text,
  item_type text not null default 'note' check (item_type in ('note','idea','task','integration','ai_suggestion')),
  source text not null default 'manual',
  status text not null default 'new' check (status in ('new','processed','snoozed','archived')),
  snoozed_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waiting_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  counterparty text,
  status text not null default 'waiting' check (status in ('waiting','resolved','cancelled')),
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','at_risk','completed','cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  target_value numeric(16,2),
  current_value numeric(16,2),
  unit text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.key_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  target_value numeric(16,2),
  current_value numeric(16,2) not null default 0,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  entry_type text not null check (entry_type in ('income','expense')),
  status text not null default 'actual' check (status in ('planned','expected','actual','cancelled')),
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'RUB',
  category text,
  description text not null,
  source text not null default 'manual',
  occurred_on date not null default current_date,
  external_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  planned_income numeric(16,2) not null default 0,
  planned_expense numeric(16,2) not null default 0,
  currency text not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected' check (status in ('connected','not_connected','error','paused')),
  schedule text,
  last_success_at timestamptz,
  last_error text,
  public_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  role text not null,
  status text not null default 'disabled' check (status in ('waiting','working','approval','completed','error','disabled')),
  autonomy_level smallint not null default 0 check (autonomy_level between 0 and 3),
  monthly_limit numeric(16,2) not null default 0 check (monthly_limit >= 0),
  currency text not null default 'RUB',
  public_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  agent_id uuid not null references public.agent_profiles(id) on delete cascade,
  task text not null,
  status text not null default 'waiting' check (status in ('waiting','working','approval','completed','error','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  cost numeric(16,4) not null default 0 check (cost >= 0),
  currency text not null default 'RUB',
  result_summary text,
  error_message text,
  requires_approval boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user','ai','integration','system')),
  event_type text not null,
  title text not null,
  description text,
  source text not null default 'shtab-ui',
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_date date not null default current_date,
  top_task_ids uuid[] not null default '{}',
  briefing text,
  risks text[] not null default '{}',
  opportunities text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, plan_date)
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  week_start date not null,
  summary text,
  wins text,
  misses text,
  risks text,
  next_week text,
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, week_start)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  density text not null default 'comfortable' check (density in ('comfortable','compact')),
  auto_refresh_seconds integer not null default 60 check (auto_refresh_seconds between 0 and 3600),
  dashboard_layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deadlines boolean not null default true,
  overdue_tasks boolean not null default true,
  follow_ups boolean not null default true,
  integration_errors boolean not null default true,
  ai_approvals boolean not null default true,
  daily_brief boolean not null default true,
  weekly_review boolean not null default true,
  channels jsonb not null default '{"in_app":true}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
declare
  v_owner uuid;
  v_workspace uuid;
begin
  select id into v_owner from auth.users where lower(email)=lower('arslan.mambetov125@gmail.com') limit 1;
  if v_owner is null then
    raise exception 'Shtab owner auth user not found';
  end if;

  insert into public.profiles (user_id, display_name, locale, timezone, currency)
  values (v_owner, 'Арслан Мамбетов', 'ru-RU', 'Europe/Berlin', 'RUB')
  on conflict (user_id) do nothing;

  insert into public.workspaces (owner_id, name, description, locale, timezone, currency)
  values (v_owner, 'Штаб 2.1', 'Единый операционный центр проектов Арслана', 'ru-RU', 'Europe/Berlin', 'RUB')
  on conflict (owner_id) do update set name=excluded.name
  returning id into v_workspace;

  if v_workspace is null then
    select id into v_workspace from public.workspaces where owner_id=v_owner;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (v_workspace, v_owner, 'owner', 'Арслан Мамбетов')
  on conflict (workspace_id, user_id) do nothing;

  update public.projects set owner_id=v_owner, workspace_id=v_workspace
  where owner_id is null or workspace_id is null;
  update public.work_items set owner_id=v_owner, workspace_id=v_workspace
  where owner_id is null or workspace_id is null;

  insert into public.user_preferences (user_id, workspace_id)
  values (v_owner, v_workspace)
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id, workspace_id)
  values (v_owner, v_workspace)
  on conflict (user_id) do nothing;

  insert into public.integration_connections (owner_id, workspace_id, provider, status, schedule, last_success_at, public_settings)
  values
    (v_owner, v_workspace, 'supabase', 'connected', 'realtime', now(), '{"mode":"Data API + Auth"}'::jsonb),
    (v_owner, v_workspace, 'hubspot', 'connected', 'hourly', (select max(coalesce(finished_at,started_at)) from public.sync_runs where provider='hubspot'), '{"mode":"read-only sync"}'::jsonb),
    (v_owner, v_workspace, 'apollo', 'connected', 'hourly', (select max(coalesce(finished_at,started_at)) from public.sync_runs where provider='apollo'), '{"mode":"read-only sync"}'::jsonb),
    (v_owner, v_workspace, 'github', 'connected', 'on push', now(), '{"repository":"arslanmambetov125-afk/avangard-teh","branch":"shtab-2"}'::jsonb),
    (v_owner, v_workspace, 'vercel', 'connected', 'on push', now(), '{"project":"shtab-2","target":"production"}'::jsonb),
    (v_owner, v_workspace, 'google_drive', 'not_connected', null, null, '{}'::jsonb),
    (v_owner, v_workspace, 'gmail', 'not_connected', null, null, '{}'::jsonb),
    (v_owner, v_workspace, 'calendar', 'not_connected', null, null, '{}'::jsonb),
    (v_owner, v_workspace, 'heygen', 'not_connected', null, null, '{}'::jsonb),
    (v_owner, v_workspace, 'openai', 'not_connected', null, null, '{}'::jsonb)
  on conflict (workspace_id, provider) do nothing;
end $$;

alter table public.projects alter column owner_id set default auth.uid();
alter table public.projects alter column owner_id set not null;
alter table public.projects alter column workspace_id set not null;
alter table public.work_items alter column owner_id set default auth.uid();
alter table public.work_items alter column owner_id set not null;
alter table public.work_items alter column workspace_id set not null;

create index if not exists projects_owner_workspace_idx on public.projects(owner_id, workspace_id);
create index if not exists projects_health_status_idx on public.projects(health, status);
create index if not exists work_items_owner_status_due_idx on public.work_items(owner_id, status, due_at);
create index if not exists work_items_workspace_project_idx on public.work_items(workspace_id, project_id);
create index if not exists inbox_items_owner_status_idx on public.inbox_items(owner_id, status, created_at desc);
create index if not exists waiting_items_owner_status_followup_idx on public.waiting_items(owner_id, status, follow_up_at);
create index if not exists goals_owner_status_due_idx on public.goals(owner_id, status, due_at);
create index if not exists finance_entries_owner_date_idx on public.finance_entries(owner_id, occurred_on desc);
create index if not exists finance_entries_project_idx on public.finance_entries(project_id, entry_type, status);
create index if not exists agent_runs_owner_status_idx on public.agent_runs(owner_id, status, created_at desc);
create index if not exists activity_events_owner_created_idx on public.activity_events(owner_id, created_at desc);
create index if not exists activity_events_project_idx on public.activity_events(project_id, created_at desc);

drop policy if exists shtab_owner_projects on public.projects;
drop policy if exists shtab_owner_select_projects on public.projects;
drop policy if exists shtab_owner_all_work_items on public.work_items;
drop policy if exists shtab_owner_work_items_select on public.work_items;
drop policy if exists shtab_owner_work_items_insert on public.work_items;
drop policy if exists shtab_owner_work_items_update on public.work_items;
drop policy if exists shtab_owner_integration_refs on public.integration_refs;
drop policy if exists shtab_owner_select_integration_refs on public.integration_refs;
drop policy if exists shtab_owner_external_entities on public.external_entities;
drop policy if exists shtab_owner_select_external_entities on public.external_entities;
drop policy if exists shtab_owner_sync_runs on public.sync_runs;
drop policy if exists shtab_owner_select_sync_runs on public.sync_runs;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.work_items enable row level security;
alter table public.inbox_items enable row level security;
alter table public.waiting_items enable row level security;
alter table public.goals enable row level security;
alter table public.key_results enable row level security;
alter table public.finance_entries enable row level security;
alter table public.budgets enable row level security;
alter table public.integration_connections enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.activity_events enable row level security;
alter table public.daily_plans enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;

create policy shtab_profile_owner on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shtab_workspace_owner on public.workspaces for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_members_owner_or_self on public.workspace_members for select to authenticated
using ((select auth.uid()) = user_id or exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy shtab_members_owner_insert on public.workspace_members for insert to authenticated
with check (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy shtab_members_owner_update on public.workspace_members for update to authenticated
using (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())))
with check (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy shtab_members_owner_delete on public.workspace_members for delete to authenticated
using (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy shtab_projects_owner on public.projects for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_work_items_owner on public.work_items for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy shtab_owner_integration_refs on public.integration_refs for select to authenticated
using ((select (auth.jwt() ->> 'email')) = 'arslan.mambetov125@gmail.com');
create policy shtab_owner_external_entities on public.external_entities for select to authenticated
using ((select (auth.jwt() ->> 'email')) = 'arslan.mambetov125@gmail.com');
create policy shtab_owner_sync_runs on public.sync_runs for select to authenticated
using ((select (auth.jwt() ->> 'email')) = 'arslan.mambetov125@gmail.com');

create policy shtab_inbox_owner on public.inbox_items for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_waiting_owner on public.waiting_items for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_goals_owner on public.goals for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_key_results_owner on public.key_results for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_finance_owner on public.finance_entries for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_budgets_owner on public.budgets for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_connections_owner on public.integration_connections for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_agents_owner on public.agent_profiles for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_agent_runs_owner on public.agent_runs for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_approvals_owner on public.agent_approvals for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_activity_owner_select on public.activity_events for select to authenticated
using ((select auth.uid()) = owner_id);
create policy shtab_activity_owner_insert on public.activity_events for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy shtab_daily_plans_owner on public.daily_plans for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_reviews_owner on public.weekly_reviews for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy shtab_preferences_owner on public.user_preferences for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shtab_notifications_owner on public.notification_preferences for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.profiles, public.workspaces, public.workspace_members,
  public.inbox_items, public.waiting_items, public.goals, public.key_results,
  public.finance_entries, public.budgets, public.integration_connections,
  public.agent_profiles, public.agent_runs, public.agent_approvals,
  public.activity_events, public.daily_plans, public.weekly_reviews,
  public.user_preferences, public.notification_preferences from anon;

grant select, insert, update, delete on table public.profiles, public.workspaces, public.workspace_members,
  public.projects, public.work_items, public.inbox_items, public.waiting_items,
  public.goals, public.key_results, public.finance_entries, public.budgets,
  public.integration_connections, public.agent_profiles, public.agent_runs,
  public.agent_approvals, public.daily_plans, public.weekly_reviews,
  public.user_preferences, public.notification_preferences to authenticated;
grant select, insert on table public.activity_events to authenticated;
grant select on table public.integration_refs, public.external_entities, public.sync_runs to authenticated;
grant all on table public.profiles, public.workspaces, public.workspace_members,
  public.projects, public.work_items, public.inbox_items, public.waiting_items,
  public.goals, public.key_results, public.finance_entries, public.budgets,
  public.integration_connections, public.agent_profiles, public.agent_runs,
  public.agent_approvals, public.activity_events, public.daily_plans,
  public.weekly_reviews, public.user_preferences, public.notification_preferences to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter view public.project_dashboard_v1 set (security_invoker=true);

create or replace view public.project_dashboard_v2
with (security_invoker=true)
as
select
  p.*,
  (select count(*) from public.external_entities e where e.project_id=p.id and e.provider='hubspot' and e.entity_type='company') as hubspot_companies,
  (select count(*) from public.external_entities e where e.project_id=p.id and e.provider='hubspot' and e.entity_type='contact') as hubspot_contacts,
  (select count(*) from public.external_entities e where e.project_id=p.id and e.provider='hubspot' and e.entity_type='deal') as hubspot_deals,
  (select count(*) from public.external_entities e where e.project_id=p.id and e.provider='apollo' and e.entity_type in ('account','company')) as apollo_accounts,
  (select count(*) from public.external_entities e where e.project_id=p.id and e.provider='apollo' and e.entity_type='contact') as apollo_contacts,
  (select count(*) from public.work_items w where w.project_id=p.id and w.status not in ('done','cancelled')) as open_tasks,
  (select count(*) from public.waiting_items wi where wi.project_id=p.id and wi.status='waiting') as waiting_count,
  (select count(*) from public.goals g where g.project_id=p.id and g.status in ('active','at_risk')) as active_goals,
  (select coalesce(sum(case when f.entry_type='income' and f.status='actual' then f.amount else 0 end),0) from public.finance_entries f where f.project_id=p.id) as actual_income,
  (select coalesce(sum(case when f.entry_type='expense' and f.status='actual' then f.amount else 0 end),0) from public.finance_entries f where f.project_id=p.id) as actual_expense,
  (select max(e.synced_at) from public.external_entities e where e.project_id=p.id) as last_synced_at
from public.projects p;

revoke all on table public.project_dashboard_v2 from anon;
grant select on table public.project_dashboard_v2 to authenticated, service_role;

comment on view public.project_dashboard_v2 is 'Owner-scoped project operations dashboard for Shtab 2.1';
