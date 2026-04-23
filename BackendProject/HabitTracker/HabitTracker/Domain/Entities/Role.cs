using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Access-control role assigned to a <see cref="User"/>.
    /// Drives authorisation across the three workflows: regular users (B2C), content managers
    /// (CRUD on global catalog), and data analysts (anonymous aggregates, proposals).
    /// Seeded with the fixed triple {User, ContentManager, Analyst}.
    /// </summary>
    public class Role
    {
        /// <summary>Surrogate SERIAL primary key.</summary>
        [Key]
        public int Id { get; set; }

        /// <summary>Unique role name — one of the seeded values. Used by authorisation policies.</summary>
        [Required, MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Users assigned to this role.</summary>
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
