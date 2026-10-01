create table if not exists public.bww_dashboard_actions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint bww_dashboard_actions_status_check check (status in ('pending','processing','completed','failed')),
  constraint bww_dashboard_actions_payload_object_check check (jsonb_typeof(payload) = 'object')
);

alter table public.bww_dashboard_actions enable row level security;
revoke all on public.bww_dashboard_actions from anon, authenticated;
grant all on public.bww_dashboard_actions to service_role;

create index if not exists bww_dashboard_actions_pending_idx
  on public.bww_dashboard_actions (status, created_at)
  where status = 'pending';

comment on table public.bww_dashboard_actions is 'Server-only queue for authenticated BWW dashboard actions executed by the Discord bot';