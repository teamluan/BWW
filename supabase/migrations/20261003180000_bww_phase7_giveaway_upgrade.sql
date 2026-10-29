-- BWW Phase 7 - Giveaway-Upgrade (Quelle: 07_GIVEAWAYS.md, 02_DATABASE.md).
-- Idempotent: nur ADD COLUMN IF NOT EXISTS bei Luecke (Phase-2-Tabellen bleiben bestehen).
-- Neu: host_id/description/duration/requirements an bww_giveaways, joined_at/eligible an entries,
-- position/claimed an winners, 7 Requirement-Typen, Status scheduled/running/ended/cancelled
-- (legacy 'active' bleibt lesbar). Nur bww_-Prefix, RLS, Constraints, Indizes.

-- 1. bww_giveaways: exakte Felder aus 07 (channel_id/message_id/host_id/prize/description/winner_count/duration/ends_at/status/requirements)
alter table public.bww_giveaways add column if not exists host_id text;
alter table public.bww_giveaways add column if not exists description text;
alter table public.bww_giveaways add column if not exists duration text;
alter table public.bww_giveaways add column if not exists requirements jsonb not null default '[]'::jsonb;
alter table public.bww_giveaways add column if not exists ends_at timestamptz;
alter table public.bww_giveaways add column if not exists updated_at timestamptz not null default now();
do $$ begin
  begin update public.bww_giveaways set ends_at = end_at where ends_at is null and end_at is not null; exception when others then null; end;
  begin update public.bww_giveaways set end_at = ends_at where end_at is null and ends_at is not null; exception when others then null; end;
  begin update public.bww_giveaways set host_id = created_by where host_id is null and created_by is not null; exception when others then null; end;
end $$;

-- Status-Check: scheduled/running/ended/cancelled (+legacy active lesbar). winner_count > 0.
alter table public.bww_giveaways drop constraint if exists bww_giveaways_status_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaways_status_phase7_check') then
    alter table public.bww_giveaways add constraint bww_giveaways_status_phase7_check
      check (status in ('scheduled','running','ended','cancelled','active'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaways_winner_count_phase7_check') then
    alter table public.bww_giveaways add constraint bww_giveaways_winner_count_phase7_check check (winner_count > 0);
  end if;
end $$;

-- 2. bww_giveaway_entries: joined_at/eligible (+guild_id falls Luecke)
alter table public.bww_giveaway_entries add column if not exists guild_id text;
alter table public.bww_giveaway_entries add column if not exists joined_at timestamptz not null default now();
alter table public.bww_giveaway_entries add column if not exists eligible boolean not null default true;
do $$ begin
  begin update public.bww_giveaway_entries set joined_at = entered_at where joined_at is null and entered_at is not null; exception when others then null; end;
  begin update public.bww_giveaway_entries e set guild_id = g.guild_id from public.bww_giveaways g where g.id = e.giveaway_id and e.guild_id is null; exception when others then null; end;
end $$;

-- 3. bww_giveaway_winners: position/claimed (+guild_id falls Luecke)
alter table public.bww_giveaway_winners add column if not exists guild_id text;
alter table public.bww_giveaway_winners add column if not exists position integer;
alter table public.bww_giveaway_winners add column if not exists claimed boolean not null default false;
do $$ begin
  begin update public.bww_giveaway_winners set position = 1 where position is null; exception when others then null; end;
  begin update public.bww_giveaway_winners w set guild_id = g.guild_id from public.bww_giveaways g where g.id = w.giveaway_id and w.guild_id is null; exception when others then null; end;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_winners_position_phase7_check') then
    alter table public.bww_giveaway_winners add constraint bww_giveaway_winners_position_phase7_check check (position is null or position >= 1);
  end if;
end $$;

-- 4. bww_giveaway_requirements: 7 Typen (role/account_age/server_age/minimum_level/channel_message/booster/verified) + legacy lesbar
alter table public.bww_giveaway_requirements add column if not exists guild_id text;
alter table public.bww_giveaway_requirements drop constraint if exists bww_giveaway_requirements_requirement_type_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_requirements_type_phase7_check') then
    alter table public.bww_giveaway_requirements add constraint bww_giveaway_requirements_type_phase7_check
      check (requirement_type in ('role','account_age','server_age','minimum_level','channel_message','booster','verified','min_account_age_days','min_server_age_days','invite_count','message_count','bonus'));
  end if;
end $$;

-- 5. bww_giveaway_rerolls: old/new/reason (old_winner_id/new_winner_id/reason)
alter table public.bww_giveaway_rerolls add column if not exists guild_id text;
alter table public.bww_giveaway_rerolls add column if not exists rerolled_by text;
alter table public.bww_giveaway_rerolls add column if not exists old_winner_id text;
alter table public.bww_giveaway_rerolls add column if not exists new_winner_id text;
alter table public.bww_giveaway_rerolls add column if not exists reason text;

-- 6. FKs (modul-intern, idempotent wie Phase 2)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_entries_giveaway_fk') then alter table public.bww_giveaway_entries add constraint bww_giveaway_entries_giveaway_fk foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_winners_giveaway_fk') then alter table public.bww_giveaway_winners add constraint bww_giveaway_winners_giveaway_fk foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_req_giveaway_fk') then alter table public.bww_giveaway_requirements add constraint bww_giveaway_req_giveaway_fk foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_rerolls_giveaway_fk') then alter table public.bww_giveaway_rerolls add constraint bww_giveaway_rerolls_giveaway_fk foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade; end if; end $$;

-- 7. RLS (Kap.5: Default-Deny anon/authenticated, service_role via Server-Layer, guild-isolierte Read-Policy)
alter table public.bww_giveaways enable row level security;
alter table public.bww_giveaway_entries enable row level security;
alter table public.bww_giveaway_winners enable row level security;
alter table public.bww_giveaway_requirements enable row level security;
alter table public.bww_giveaway_rerolls enable row level security;
revoke all on table public.bww_giveaways from anon, authenticated;
revoke all on table public.bww_giveaway_entries from anon, authenticated;
revoke all on table public.bww_giveaway_winners from anon, authenticated;
revoke all on table public.bww_giveaway_requirements from anon, authenticated;
revoke all on table public.bww_giveaway_rerolls from anon, authenticated;
grant select, insert, update, delete on table public.bww_giveaways to service_role;
grant select, insert, update, delete on table public.bww_giveaway_entries to service_role;
grant select, insert, update, delete on table public.bww_giveaway_winners to service_role;
grant select, insert, update, delete on table public.bww_giveaway_requirements to service_role;
grant select, insert, update, delete on table public.bww_giveaway_rerolls to service_role;
drop policy if exists bww_guild_isolated_read on public.bww_giveaways;
create policy bww_guild_isolated_read on public.bww_giveaways for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_entries;
create policy bww_guild_isolated_read on public.bww_giveaway_entries for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_winners;
create policy bww_guild_isolated_read on public.bww_giveaway_winners for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_requirements;
create policy bww_guild_isolated_read on public.bww_giveaway_requirements for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_rerolls;
create policy bww_guild_isolated_read on public.bww_giveaway_rerolls for select to authenticated using (public.bww_can_access_guild(guild_id));

-- 8. Indizes (Kap.6: guild_id/status/ends_at/giveaway_id/user_id/created_at)
create index if not exists bww_giveaways_phase7_status_ends_idx on public.bww_giveaways (guild_id, status, ends_at);
create index if not exists bww_giveaway_entries_phase7_giveaway_idx on public.bww_giveaway_entries (giveaway_id);
create index if not exists bww_giveaway_entries_phase7_user_idx on public.bww_giveaway_entries (guild_id, user_id);
create index if not exists bww_giveaway_winners_phase7_giveaway_idx on public.bww_giveaway_winners (giveaway_id, position);
create index if not exists bww_giveaway_requirements_phase7_giveaway_idx on public.bww_giveaway_requirements (giveaway_id, requirement_type);
create index if not exists bww_giveaway_rerolls_phase7_giveaway_idx on public.bww_giveaway_rerolls (giveaway_id, created_at desc);
