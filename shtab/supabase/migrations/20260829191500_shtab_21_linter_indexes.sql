-- Standalone leading-column indexes required by the database linter.

create index if not exists projects_workspace_id_idx on public.projects (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
