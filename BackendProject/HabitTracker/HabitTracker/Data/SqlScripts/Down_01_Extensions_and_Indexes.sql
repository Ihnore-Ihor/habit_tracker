-- Down counterpart of 01_Extensions_and_Indexes.sql
ALTER TABLE sleep_logs DROP CONSTRAINT IF EXISTS no_overlapping_sleep;
-- btree_gist is left installed deliberately — other database objects or future
-- migrations may depend on it. Drop it manually if you're certain nothing else uses it.