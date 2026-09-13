CREATE TABLE IF NOT EXISTS bug_reports (
  report_id TEXT PRIMARY KEY,
  installation_id TEXT,
  app_version TEXT NOT NULL,
  build TEXT,
  platform TEXT NOT NULL,
  os_version TEXT,
  client_schema INTEGER NOT NULL DEFAULT 1,
  what_happened TEXT NOT NULL,
  reproduction_steps TEXT,
  expected_result TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  submitted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id)
    REFERENCES installations(installation_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_submitted_at ON bug_reports(submitted_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_installation ON bug_reports(installation_id);

CREATE TABLE IF NOT EXISTS bug_report_attachments (
  attachment_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (report_id)
    REFERENCES bug_reports(report_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bug_report_attachments_report ON bug_report_attachments(report_id);
