-- Down counterpart of 06_StoredProcedures.sql
DROP PROCEDURE IF EXISTS sp_update_achievement_progress(UUID, condition_key, INT);
DROP PROCEDURE IF EXISTS sp_daily_streak_maintenance();