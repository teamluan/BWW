create table if not exists public.bww_embed_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_embed_templates_name_check check (char_length(name) between 1 and 64),
  constraint bww_embed_templates_data_object_check check (jsonb_typeof(data) = 'object'),
  constraint bww_embed_templates_guild_name_unique unique (guild_id, name)
);

alter table public.bww_embed_templates enable row level security;
revoke all on public.bww_embed_templates from anon, authenticated;
grant all on public.bww_embed_templates to service_role;

create index if not exists bww_embed_templates_guild_idx
  on public.bww_embed_templates (guild_id, updated_at desc);

comment on table public.bww_embed_templates is 'Per-guild Components V2 embed templates managed by the BWW dashboard';