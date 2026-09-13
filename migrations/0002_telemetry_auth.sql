-- MELO telemetry authentication
-- Stores only a SHA-256 hash of each server-issued telemetry credential.

CREATE TABLE IF NOT EXISTS telemetry_credentials (
  installation_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY (installation_id)
    REFERENCES installations(installation_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_credentials_token_hash
ON telemetry_credentials(token_hash);

CREATE INDEX IF NOT EXISTS idx_telemetry_credentials_revoked_at
ON telemetry_credentials(revoked_at);
