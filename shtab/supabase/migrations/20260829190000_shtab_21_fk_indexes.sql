-- Cover foreign keys used by RLS, joins and cascading deletes.

create index if not exists activity_events_workspace_idx on public.activity_events (workspace_id);

create index if not exists agent_approvals_run_idx on public.agent_approvals (agent_run_id);
create index if not exists agent_approvals_owner_idx on public.agent_approvals (owner_id);
create index if not exists agent_approvals_workspace_idx on public.agent_approvals (workspace_id);

create index if not exists agent_profiles_owner_idx on public.agent_profiles (owner_id);
create index if not exists agent_profiles_project_idx on public.agent_profiles (project_id);
create index if not exists agent_profiles_workspace_idx on public.agent_profiles (workspace_id);

create index if not exists agent_runs_agent_idx on public.agent_runs (agent_id);
create index if not exists agent_runs_project_idx on public.agent_runs (project_id);
create index if not exists agent_runs_workspace_idx on public.agent_runs (workspace_id);

create index if not exists budgets_owner_idx on public.budgets (owner_id);
create index if not exists budgets_project_idx on public.budgets (project_id);
create index if not exists budgets_workspace_idx on public.budgets (workspace_id);

create index if not exists daily_plans_owner_idx on public.daily_plans (owner_id);
create index if not exists finance_entries_workspace_idx on public.finance_entries (workspace_id);

create index if not exists goals_project_idx on public.goals (project_id);
create index if not exists goals_workspace_idx on public.goals (workspace_id);

create index if not exists inbox_items_project_idx on public.inbox_items (project_id);
create index if not exists inbox_items_workspace_idx on public.inbox_items (workspace_id);

create index if not exists integration_connections_owner_idx on public.integration_connections (owner_id);

create index if not exists key_results_goal_idx on public.key_results (goal_id);
create index if not exists key_results_owner_idx on public.key_results (owner_id);
create index if not exists key_results_workspace_idx on public.key_results (workspace_id);

create index if not exists notification_preferences_workspace_idx on public.notification_preferences (workspace_id);
create index if not exists user_preferences_workspace_idx on public.user_preferences (workspace_id);

create index if not exists waiting_items_project_idx on public.waiting_items (project_id);
create index if not exists waiting_items_workspace_idx on public.waiting_items (workspace_id);

create index if not exists weekly_reviews_owner_idx on public.weekly_reviews (owner_id);

create index if not exists work_items_parent_idx on public.work_items (parent_id);
create index if not exists work_items_related_entity_idx on public.work_items (related_entity_id);
