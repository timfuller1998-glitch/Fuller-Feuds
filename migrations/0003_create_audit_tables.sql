-- ============================================================================
-- AUDIT LOGGING TABLES
-- ============================================================================
-- Creates tables for security audit logs, data access logs, and query
-- performance tracking to enable comprehensive security monitoring.
-- ============================================================================

-- Security audit logs - tracks all security-related events
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  level varchar(20) NOT NULL, -- 'info', 'warn', 'error', 'security'
  event_type varchar(50) NOT NULL, -- 'auth_failure', 'unauthorized_access', etc.
  user_id varchar,
  user_email varchar,
  user_role varchar,
  action varchar(100) NOT NULL,
  resource_type varchar(50),
  resource_id varchar,
  ip_address varchar,
  user_agent text,
  request_id varchar,
  error text,
  error_code varchar(50),
  metadata jsonb,
  timestamp timestamp DEFAULT now() NOT NULL
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_request_id ON security_audit_logs(request_id);

-- Data access logs - tracks access to sensitive data
CREATE TABLE IF NOT EXISTS data_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id varchar NOT NULL,
  user_role varchar,
  action varchar(100) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id varchar,
  access_level varchar(20) NOT NULL, -- 'read', 'write', 'delete'
  data_fields text[],
  ip_address varchar,
  user_agent text,
  request_id varchar,
  timestamp timestamp DEFAULT now() NOT NULL
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_data_access_user_id ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_timestamp ON data_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_access_resource_type ON data_access_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_data_access_request_id ON data_access_logs(request_id);

-- Query performance logs - tracks database query performance
CREATE TABLE IF NOT EXISTS query_performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id varchar,
  action varchar(100) NOT NULL,
  resource_type varchar(50),
  resource_id varchar,
  table_name varchar(100),
  operation varchar(20) NOT NULL, -- 'select', 'insert', 'update', 'delete'
  query_time_ms integer NOT NULL,
  rows_affected integer,
  ip_address varchar,
  user_agent text,
  request_id varchar,
  timestamp timestamp DEFAULT now() NOT NULL
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_query_perf_user_id ON query_performance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_perf_timestamp ON query_performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_perf_table_name ON query_performance_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_query_perf_query_time ON query_performance_logs(query_time_ms);

-- Enable RLS on audit tables (admin access only)
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_performance_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can read security audit logs"
  ON security_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can read data access logs"
  ON data_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can read query performance logs"
  ON query_performance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
      AND users.role = 'admin'
    )
  );

-- Note: Application code should insert into these tables (no public insert policy)
-- This allows logging from the application layer while restricting reads to admins

DO $$
BEGIN
  RAISE NOTICE 'Audit logging tables created successfully';
END $$;

