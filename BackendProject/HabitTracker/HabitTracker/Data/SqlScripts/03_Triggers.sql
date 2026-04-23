-- ============================================================================
-- 03_Triggers.sql
-- Purpose : Attach trigger functions from 02_Functions.sql to the relevant
--           tables. Each CREATE is preceded by a defensive DROP so the script
--           is re-runnable (useful during local dev / re-baselining).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- trg_users_updated_at : maintains `users.updated_at` on every UPDATE.
-- Pairs with EF's DB-generated configuration on User.UpdatedAt.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();


-- ---------------------------------------------------------------------------
-- trg_on_habit_execution : O(1) streak maintenance on every execution insert.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_on_habit_execution ON habit_executions;
CREATE TRIGGER trg_on_habit_execution
AFTER INSERT ON habit_executions
FOR EACH ROW
EXECUTE PROCEDURE fn_on_habit_execution();


-- ---------------------------------------------------------------------------
-- trg_soft_delete : intercepts DELETE on the four archivable tables and
-- replaces it with an `UPDATE is_archived = true`. See fn_soft_delete() for
-- the bypass mechanism used by GDPR hard-deletes.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_soft_delete ON categories;
CREATE TRIGGER trg_soft_delete
BEFORE DELETE ON categories
FOR EACH ROW
EXECUTE PROCEDURE fn_soft_delete();

DROP TRIGGER IF EXISTS trg_soft_delete ON habits;
CREATE TRIGGER trg_soft_delete
BEFORE DELETE ON habits
FOR EACH ROW
EXECUTE PROCEDURE fn_soft_delete();

DROP TRIGGER IF EXISTS trg_soft_delete ON user_habits;
CREATE TRIGGER trg_soft_delete
BEFORE DELETE ON user_habits
FOR EACH ROW
EXECUTE PROCEDURE fn_soft_delete();

DROP TRIGGER IF EXISTS trg_soft_delete ON achievements;
CREATE TRIGGER trg_soft_delete
BEFORE DELETE ON achievements
FOR EACH ROW
EXECUTE PROCEDURE fn_soft_delete();