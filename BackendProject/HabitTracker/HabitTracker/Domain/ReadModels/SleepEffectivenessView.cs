namespace HabitTracker.Domain.ReadModels
{
    /// <summary>
    /// Keyless EF projection of <c>mvw_sleep_recommendation_effectiveness</c>.
    /// Two rows: cohort = 'adherent' | 'non_adherent'.
    /// </summary>
    public sealed class SleepEffectivenessView
    {
        /// <summary>'adherent' or 'non_adherent'.</summary>
        public string Cohort { get; init; } = string.Empty;

        public long NUsers { get; init; }

        /// <summary>Mean Pleasure score (-5…+5).</summary>
        public decimal MeanP { get; init; }

        /// <summary>Mean Arousal score (-5…+5).</summary>
        public decimal MeanA { get; init; }

        /// <summary>Mean Dominance score (-5…+5).</summary>
        public decimal MeanD { get; init; }
    }
}
