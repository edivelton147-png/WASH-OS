-- WASH-OS · Historial operacional detallado para Resumen de reuniones
-- Ejecutar en el SQL editor de Supabase del proyecto WASH-OS.
-- La aplicación escribe desde /api/history con SUPABASE_SERVICE_ROLE_KEY en Vercel.
-- No guardar archivos pesados aquí: solo metadatos, referencias textuales y resultados procesados.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.meeting_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  type text,
  title text,
  date date,
  month int,
  year int,
  summary text,
  pending_tasks jsonb default '[]'::jsonb,
  completed_or_coordinated jsonb default '[]'::jsonb,
  risks jsonb default '[]'::jsonb,
  notes jsonb default '[]'::jsonb,
  source_reference text,
  provider text,
  model text,
  raw_result jsonb default '{}'::jsonb,
  tags text[] default '{}'::text[]
);

create index if not exists meeting_history_type_idx on public.meeting_history (type);
create index if not exists meeting_history_year_month_idx on public.meeting_history (year, month);
create index if not exists meeting_history_created_at_idx on public.meeting_history (created_at desc);
create index if not exists meeting_history_tags_idx on public.meeting_history using gin (tags);

-- Búsqueda simple usada por /api/history?q=texto.
create index if not exists meeting_history_title_trgm_idx
  on public.meeting_history using gin (title gin_trgm_ops);
create index if not exists meeting_history_summary_trgm_idx
  on public.meeting_history using gin (summary gin_trgm_ops);

