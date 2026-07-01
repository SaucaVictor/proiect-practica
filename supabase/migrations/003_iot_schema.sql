-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — IoT Classroom Schema Migration
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── IoT Devices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_devices (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  online      BOOLEAN NOT NULL DEFAULT FALSE
);

-- ─── IoT Sensors ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_sensors (
  name          TEXT PRIMARY KEY,
  latest_value  TEXT NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_ip     TEXT NOT NULL
);

-- ─── IoT Sensor Readings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_sensor_readings (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sensor_name TEXT NOT NULL REFERENCES public.iot_sensors(name) ON DELETE CASCADE,
  value       NUMERIC NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_ip   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_sensor_name_timestamp ON public.iot_sensor_readings (sensor_name, timestamp DESC);

-- ─── IoT Settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_settings (
  id                TEXT PRIMARY KEY DEFAULT '1',
  mode              TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  thermostat_target NUMERIC NOT NULL DEFAULT 22,
  display           TEXT NOT NULL DEFAULT 'All', -- 'All', 'Curent', 'Light', 'Temperature', 'Persons'
  fan               INTEGER NOT NULL DEFAULT 0, -- 0-255
  led               INTEGER NOT NULL DEFAULT 0, -- 0-255
  ptc               INTEGER NOT NULL DEFAULT 0 -- 0-255
);

-- Seed default settings row
INSERT INTO public.iot_settings (id, mode, thermostat_target, display, fan, led, ptc)
VALUES ('1', 'manual', 22, 'All', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ─── IoT Scenarios ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_scenarios (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  type              TEXT NOT NULL, -- 'simple' | 'light_control' | 'temperature_control'
  conditions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions           JSONB NOT NULL DEFAULT '[]'::jsonb,
  thermostat_target NUMERIC,
  deadband          NUMERIC,
  max_range         NUMERIC,
  high_threshold    NUMERIC,
  low_threshold     NUMERIC,
  mid_brightness    NUMERIC,
  full_brightness   NUMERIC,
  off_delay         NUMERIC,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── IoT Commands ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iot_commands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_commands ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies (Allow all read/write operations for convenience in IoT demo environment)
CREATE POLICY "Allow all public operations on iot_devices" ON public.iot_devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations on iot_sensors" ON public.iot_sensors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations on iot_sensor_readings" ON public.iot_sensor_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations on iot_settings" ON public.iot_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations on iot_scenarios" ON public.iot_scenarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public operations on iot_commands" ON public.iot_commands FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_sensors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_scenarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_commands;
