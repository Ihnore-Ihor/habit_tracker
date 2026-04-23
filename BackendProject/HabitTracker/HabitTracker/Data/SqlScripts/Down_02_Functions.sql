-- Down counterpart of 02_Functions.sql
-- Ordered so that trigger-attached functions drop only after 03_Triggers Down.
DROP FUNCTION IF EXISTS fn_calculate_daily_affect_centroid(UUID, DATE);
DROP FUNCTION IF EXISTS fn_is_habit_scheduled(TEXT, JSONB, DATE);
DROP FUNCTION IF EXISTS fn_on_habit_execution();
DROP FUNCTION IF EXISTS fn_soft_delete();
DROP FUNCTION IF EXISTS update_updated_at_column();