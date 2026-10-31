create extension if not exists pgcrypto;
create table registration_status (
 id uuid primary key default gen_random_uuid(), exam_date date not null, region text not null, testing_location text not null,
 exam_level text not null check (exam_level in ('professional','subprofessional')),
 status text not null check (status in ('not_verified','announced','opening_soon','open','closed','verification_failed','verification_required')),
 opening_at timestamptz, verified_source_url text, verification_method text not null, evidence text,
 checked_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(exam_date,region,testing_location,exam_level)
);
create table announcements (
 id uuid primary key default gen_random_uuid(), title text not null, source_url text not null unique,
 published_at timestamptz, discovered_at timestamptz not null default now(), relevant boolean not null default false
);
create table notification_subscriptions (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique, device_token text not null,
 region text not null default 'Region V', testing_location text not null default 'Masbate',
 professional boolean not null default true, subprofessional boolean not null default true,
 opening_alerts boolean not null default true, slot_alerts boolean not null default true,
 announcement_alerts boolean not null default true, closing_alerts boolean not null default true,
 enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table notification_history (
 id uuid primary key default gen_random_uuid(), subscription_id uuid references notification_subscriptions(id) on delete cascade,
 event_key text not null, event_type text not null, notification_title text not null, notification_message text not null,
 delivered_at timestamptz, delivery_status text not null default 'pending', source_url text,
 unique(subscription_id,event_key)
);
create table monitoring_logs (
 id bigint generated always as identity primary key, checked_at timestamptz not null default now(), source_url text not null,
 http_status integer, detected_status text, verification_result text not null, error_message text
);
create table api_rate_limits (bucket text primary key, count integer not null, reset_at timestamptz not null);
create index registration_status_checked_idx on registration_status(checked_at desc);
create index announcements_discovered_idx on announcements(discovered_at desc);
create index monitoring_logs_checked_idx on monitoring_logs(checked_at desc);
create index subscriptions_filters_idx on notification_subscriptions(enabled,region,testing_location);
create index notification_history_event_idx on notification_history(event_key);
alter table registration_status enable row level security;
alter table announcements enable row level security;
alter table notification_subscriptions enable row level security;
alter table notification_history enable row level security;
alter table monitoring_logs enable row level security;
alter table api_rate_limits enable row level security;
-- No direct anonymous access: only the server-side service role reads or writes these tables.
create or replace function consume_api_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
 insert into api_rate_limits(bucket,count,reset_at) values(p_bucket,1,now()+make_interval(secs=>p_window_seconds))
 on conflict(bucket) do update set count = case when api_rate_limits.reset_at < now() then 1 else api_rate_limits.count+1 end,
 reset_at = case when api_rate_limits.reset_at < now() then now()+make_interval(secs=>p_window_seconds) else api_rate_limits.reset_at end
 returning count into n;
 return n <= p_max;
end $$;
revoke all on function consume_api_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function consume_api_limit(text,integer,integer) to service_role;
