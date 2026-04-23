namespace HabitTracker.Domain.ValueObjects
{
    /// <summary>
    /// Multi-day sleep schedule produced by the smart-sleep algorithm.
    /// Persisted as JSONB in <c>SleepRecommendation.SleepPlan</c>.
    /// </summary>
    public class SleepPlan
    {
        /// <summary>
        /// Chronologically ordered list of planned nights. Horizon is algorithm-controlled
        /// (typically a handful of upcoming days needed to clear accumulated sleep debt).
        /// </summary>
        public List<SleepPlanDay> Days { get; set; } = new();
    }

    /// <summary>
    /// One planned night within a <see cref="SleepPlan"/>.
    /// Times are local wall-clock values interpreted against the user's <c>Timezone</c>.
    /// </summary>
    public class SleepPlanDay
    {
        /// <summary>Calendar date the plan applies to (the day on which the user wakes up).</summary>
        public DateOnly Date { get; set; }

        /// <summary>Target local time the user should already be asleep by.</summary>
        public TimeOnly IdealBedtime { get; set; }

        /// <summary>Target local wake time that feeds back into <c>UserSleepProfile.TargetWakeTime</c>.</summary>
        public TimeOnly PlannedWake { get; set; }

        /// <summary>Planned sleep duration in hours. Must respect <c>UserSleepProfile.AbsoluteMinSleepHours</c>.</summary>
        public decimal PlannedSleepHours { get; set; }

        /// <summary>Circadian cutoffs (caffeine / food / screens) derived from <see cref="IdealBedtime"/>.</summary>
        public Zeitgebers Zeitgebers { get; set; } = new();
    }

    /// <summary>
    /// Circadian cutoff times ("time-givers") that help the user fall asleep at <c>IdealBedtime</c>.
    /// Each value is a fixed offset before bedtime, pre-computed by the algorithm so the client
    /// can render them without further maths.
    /// </summary>
    public class Zeitgebers
    {
        /// <summary>Latest local time the user should consume caffeine.</summary>
        public TimeOnly? LastCaffeine { get; set; }

        /// <summary>Latest local time the user should eat a meal.</summary>
        public TimeOnly? LastMeal { get; set; }

        /// <summary>Latest local time the user should be looking at bright screens.</summary>
        public TimeOnly? ScreensOff { get; set; }
    }
}
