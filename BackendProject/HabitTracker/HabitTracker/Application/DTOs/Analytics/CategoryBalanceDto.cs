namespace HabitTracker.Application.DTOs.Analytics
{
    /// <summary>
    /// Read-only projection of <c>vw_user_category_balance</c> — drives the radar chart.
    /// Only categories the user has at least one execution in are returned (INNER JOIN in the view).
    /// </summary>
    public sealed class CategoryBalanceDto
    {
        public Guid UserId { get; init; }
        public int CategoryId { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public string ColorHex { get; init; } = string.Empty;
        public bool IsNegative { get; init; }
        public decimal CategoryExecutions { get; init; }
        public decimal TotalExecutions { get; init; }

        /// <summary>Share of this category in the user's total execution volume, 0..100.</summary>
        public decimal Percentage { get; init; }
    }
}
