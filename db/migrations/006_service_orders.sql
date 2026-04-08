-- ============================================================================
-- SERVICE ORDERS - Done-for-You Onboarding Flow
-- ============================================================================
-- Migration for service_orders and service_order_events tables
-- Tracks client orders for managed call services (calls_1000, calls_5000, etc.)
-- SAFE: All changes use IF NOT EXISTS, backwards-compatible
-- ============================================================================

-- ============================================================================
-- 1. SERVICE ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_orders (
  id SERIAL PRIMARY KEY,
  
  -- Client/User reference
  client_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Contact info (for orders without full user profile)
  company_name VARCHAR,
  contact_name VARCHAR,
  contact_email VARCHAR,
  contact_phone VARCHAR,
  
  -- Package details
  package_code VARCHAR NOT NULL,  -- e.g., 'calls_1000', 'calls_5000'
  target_calls INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'eur',
  
  -- Order status
  status VARCHAR NOT NULL DEFAULT 'draft',  -- draft|paid|intake|in_progress|paused|completed|canceled
  
  -- Payment tracking
  payment_status VARCHAR NOT NULL DEFAULT 'unpaid',  -- unpaid|paid|failed|refunded
  payment_reference VARCHAR,  -- Stripe payment intent ID or checkout session ID
  
  -- Operational references
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  -- TODO: Add FK constraint when import_jobs table is created
  lead_import_job_id INTEGER,  -- NULL for now - no import_jobs table yet
  
  -- Staff assignment
  assigned_staff_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  
  -- Flexible metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for service_orders
CREATE INDEX IF NOT EXISTS service_orders_status_idx ON service_orders(status);
CREATE INDEX IF NOT EXISTS service_orders_payment_status_idx ON service_orders(payment_status);
CREATE INDEX IF NOT EXISTS service_orders_created_idx ON service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_client_idx ON service_orders(client_user_id);
CREATE INDEX IF NOT EXISTS service_orders_staff_idx ON service_orders(assigned_staff_id);

-- ============================================================================
-- 2. SERVICE ORDER EVENTS TABLE (Timeline/Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_order_events (
  id SERIAL PRIMARY KEY,
  
  -- Parent order reference
  order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  
  -- Event details
  type VARCHAR NOT NULL,  -- created|paid|lead_upload|assigned|started|paused|completed|note
  title VARCHAR NOT NULL,
  description TEXT,
  
  -- Actor who triggered the event
  actor_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  
  -- Flexible metadata for event-specific data
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for service_order_events
CREATE INDEX IF NOT EXISTS service_order_events_order_idx ON service_order_events(order_id);
CREATE INDEX IF NOT EXISTS service_order_events_type_idx ON service_order_events(type);
CREATE INDEX IF NOT EXISTS service_order_events_created_idx ON service_order_events(created_at DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   - service_orders: Client orders for managed call services
--   - service_order_events: Timeline/audit trail for order changes
-- ============================================================================

-- ============================================================================
-- ROLLBACK PLAN (execute manually if needed)
-- ============================================================================
-- DROP INDEX IF EXISTS service_order_events_created_idx;
-- DROP INDEX IF EXISTS service_order_events_type_idx;
-- DROP INDEX IF EXISTS service_order_events_order_idx;
-- DROP TABLE IF EXISTS service_order_events;
-- DROP INDEX IF EXISTS service_orders_staff_idx;
-- DROP INDEX IF EXISTS service_orders_client_idx;
-- DROP INDEX IF EXISTS service_orders_created_idx;
-- DROP INDEX IF EXISTS service_orders_payment_status_idx;
-- DROP INDEX IF EXISTS service_orders_status_idx;
-- DROP TABLE IF EXISTS service_orders;
-- ============================================================================
