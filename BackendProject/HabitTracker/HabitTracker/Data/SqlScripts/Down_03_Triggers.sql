-- Down counterpart of 03_Triggers.sql
DROP TRIGGER IF EXISTS trg_soft_delete        ON achievements;
DROP TRIGGER IF EXISTS trg_soft_delete        ON user_habits;
DROP TRIGGER IF EXISTS trg_soft_delete        ON habits;
DROP TRIGGER IF EXISTS trg_soft_delete        ON categories;
DROP TRIGGER IF EXISTS trg_on_habit_execution ON habit_executions;
DROP TRIGGER IF EXISTS trg_users_updated_at   ON users;