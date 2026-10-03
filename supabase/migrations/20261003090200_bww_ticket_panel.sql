alter table public.bww_tickets
  add column if not exists panel_message_id text;

alter table public.bww_tickets
  add column if not exists reopened_at timestamptz;
