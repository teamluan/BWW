-- Remove obsolete legacy BWW dashboard tables.
-- These tables were verified to contain no application data and no foreign-key dependents.
drop table if exists public.bw_bot_status;
drop table if exists public.bw_guilds;
