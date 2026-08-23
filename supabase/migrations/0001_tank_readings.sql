-- Rode este arquivo uma vez no seu projeto Supabase (SQL Editor do dashboard, ou
-- `supabase db push` se estiver usando a CLI) antes de habilitar SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE_KEY no .env. O backend só faz upsert/insert nestas
-- tabelas — não cria schema sozinho.

create table if not exists tank_current_readings (
  otodata_device_id bigint primary key,
  name text,
  city text,
  region text,
  product text,
  status text not null,
  last_level numeric,
  inventory numeric,
  capacity numeric,
  hours_to_empty numeric,
  -- Guardados como texto: o formato de data devolvido pela API Otodata para
  -- esses dois campos não foi validado ainda contra um parser de timestamp.
  last_fill text,
  last_read text,
  battery_alarm boolean not null default false,
  signal_strength numeric,
  tank_name text,
  tank_number text,
  synced_at timestamptz not null
);

create table if not exists tank_reading_events (
  id bigint generated always as identity primary key,
  otodata_device_id bigint not null references tank_current_readings (otodata_device_id),
  previous_status text,
  new_status text not null,
  last_level numeric,
  changed_at timestamptz not null
);

create index if not exists tank_reading_events_device_idx
  on tank_reading_events (otodata_device_id, changed_at desc);

-- RLS ligado por padrão de segurança; sem policies para anon/authenticated,
-- só a service role (que ignora RLS) escreve e lê essas tabelas hoje.
alter table tank_current_readings enable row level security;
alter table tank_reading_events enable row level security;
