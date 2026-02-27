namespace HabitTracker.Models;

public class HabitExample
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsCompletedToday { get; set; }
}