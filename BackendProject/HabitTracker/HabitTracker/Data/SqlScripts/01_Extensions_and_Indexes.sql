-- ============================================================================
-- 01_Extensions_and_Indexes.sql
-- Purpose : PostgreSQL extensions and EF-inexpressible constraints.
-- Applied : on Up() of AddDatabaseObjects migration.
-- Notes   : B-Tree / GIN / Partial indexes for the five spec-named IDs
--           (idx_affect_user_time, idx_sleep_logs_user_time, idx_affect_tags,
--            idx_executions_userhabit_time, idx_user_habits_user_archived)
--           are already emitted by the InitialSetup migration via Fluent API —
--           we deliberately do NOT recreate them here.
-- ============================================================================

-- btree_gist lets a GiST index mix scalar equality (user_id) with a range
-- overlap operator — required for the no_overlapping_sleep EXCLUDE below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- no_overlapping_sleep: two sleep intervals for the same user may not overlap.
-- tstzrange over (sleep_start, sleep_end) with '[)' boundaries lets adjacent
-- intervals touch but not overlap.
ALTER TABLE sleep_logs
  ADD CONSTRAINT no_overlapping_sleep
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(sleep_start, sleep_end, '[)') WITH &&
  );
