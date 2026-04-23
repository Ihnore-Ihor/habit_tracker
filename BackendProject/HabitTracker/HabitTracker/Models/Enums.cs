namespace HabitTracker.Models
{
    /// <summary>
    /// Cadence at which a <c>UserHabit</c> repeats.
    /// Mapped to the PostgreSQL enum <c>frequency_type</c> (registered in <c>Program.cs</c>).
    /// </summary>
    public enum FrequencyType { Daily, Weekly, Monthly, Once }

    /// <summary>
    /// Review lifecycle of an <c>AnalystProposal</c> as it moves through the content-manager queue.
    /// Mapped to the PostgreSQL enum <c>proposal_status</c>.
    /// </summary>
    public enum ProposalStatus { Pending, Implemented, Rejected }

    /// <summary>
    /// Coarse time-of-day window for a habit that has no fixed exact time.
    /// Serialized inside the JSONB <c>ScheduleRule</c>; NOT a PostgreSQL enum.
    /// </summary>
    public enum TimeSlot { Morning, Afternoon, Evening, Night, Anytime }

    /// <summary>
    /// Closed set of achievement condition keys recognised by the gamification engine.
    /// Content managers may only tweak <c>target_value</c> / <c>habit_id</c>, never the key itself.
    /// Mapped to the PostgreSQL enum <c>condition_key</c> (requires a custom name translator in Step 3
    /// because Npgsql's default snake_case translator mangles the all-caps member names).
    /// </summary>
    public enum ConditionKey
    {
        TOTAL_METRIC_VOLUME,
        POSITIVE_STREAK,
        NEGATIVE_STREAK,
        PERFECT_DAY_STREAK,
        ANY_X_HABITS_STREAK,
        FIRST_ACTION,
        SYNERGY_COMBO,
        CATEGORY_TOTAL_EXECUTIONS,
        TIME_SLOT_STREAK,
        CONSISTENT_BEDTIME_STREAK,
        SLEEP_DEBT_CLEARED,
        AFFECT_STABILITY,
        AFFECT_HIGH_DOMINANCE
    }
}
