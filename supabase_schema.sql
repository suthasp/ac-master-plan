-- ======================================================
-- AC Master Plan - Supabase Schema
-- Run this in Supabase SQL Editor
-- ======================================================

-- 1. Sites table
CREATE TABLE IF NOT EXISTS public.sites (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  ac_count     INTEGER NOT NULL DEFAULT 1,
  ac_type      TEXT NOT NULL DEFAULT 'Precision',
  source_1     TEXT,   -- e.g. "1/2026"
  source_2     TEXT,
  source_3     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plan entries table (one row per site+year+week)
CREATE TABLE IF NOT EXISTS public.plan_entries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id      UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL DEFAULT 2026,
  week_number  INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  status       TEXT NOT NULL CHECK (status IN ('P','F','D')),
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, year, week_number)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_plan_entries_site_id ON public.plan_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_plan_entries_year_week ON public.plan_entries(year, week_number);

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER trg_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_entries_updated_at
  BEFORE UPDATE ON public.plan_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Row Level Security
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entries ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write everything
CREATE POLICY "auth_read_sites"   ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sites" ON public.sites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_sites" ON public.sites FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_sites" ON public.sites FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_read_entries"   ON public.plan_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_entries" ON public.plan_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_entries" ON public.plan_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_entries" ON public.plan_entries FOR DELETE TO authenticated USING (true);

-- 6. Sample data
INSERT INTO public.sites (name, ac_count, ac_type, source_1, source_2) VALUES
  ('Site A - Data Center 1',  4, 'Precision', '1/2026', '2/2026'),
  ('Site B - Server Room',    2, 'Precision', '1/2026', NULL),
  ('Site C - Office HQ',      6, 'Split',     '2/2026', '3/2026'),
  ('Site D - Warehouse',      3, 'Precision', '1/2026', NULL),
  ('Site E - Branch Office',  2, 'Split',     '3/2026', NULL)
ON CONFLICT DO NOTHING;
