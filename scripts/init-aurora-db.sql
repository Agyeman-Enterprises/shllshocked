-- SHLLSHOCKD licensing schema for AURORA PostgreSQL
-- Run this in your AURORA postgres database

CREATE SCHEMA IF NOT EXISTS shllshockd;

CREATE TABLE shllshockd.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  purchased_at BIGINT NOT NULL,
  stripe_payment_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE shllshockd.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payload JSONB,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_licenses_email ON shllshockd.licenses(email);
CREATE INDEX idx_licenses_key ON shllshockd.licenses(license_key);
CREATE INDEX idx_webhook_logs_created ON shllshockd.webhook_logs(created_at);

-- Create service user for webhook handler (read/write to licensing tables only)
CREATE USER shllshockd_webhook WITH PASSWORD 'generate-strong-password-here';
GRANT USAGE ON SCHEMA shllshockd TO shllshockd_webhook;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA shllshockd TO shllshockd_webhook;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA shllshockd TO shllshockd_webhook;

-- Verify setup
SELECT table_name FROM information_schema.tables WHERE table_schema = 'shllshockd';
