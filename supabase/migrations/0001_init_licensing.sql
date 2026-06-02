-- SHLLSHOCKD licensing schema

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  purchased_at BIGINT NOT NULL,
  lemonsqueezy_order_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payload JSONB,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at);

-- RLS policies (public read on licenses is OK for verification)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licenses_public_read" ON licenses FOR SELECT USING (true);
CREATE POLICY "webhook_logs_no_public" ON webhook_logs USING (false);
