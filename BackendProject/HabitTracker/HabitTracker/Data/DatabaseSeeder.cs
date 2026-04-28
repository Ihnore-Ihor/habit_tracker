using HabitTracker.Domain.Entities;
using HabitTracker.Domain.ValueObjects;
using HabitTracker.Models; // For TimeSlot and FrequencyType
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Data
{
    public static class DatabaseSeeder
    {
        public static async Task SeedAsync(AppDbContext db)
        {
            // If there are already categories in the database, assume it's seeded
            if (await db.Categories.AnyAsync()) return;

            // 1. Create Categories
            var catStudy = new Category { Name = "Study", ColorHex = "#A8D5E2" };
            var catSport = new Category { Name = "Sport", ColorHex = "#8FBC8F" };
            var catHealth = new Category { Name = "Health", ColorHex = "#E8B4B4" };
            var catWellness = new Category { Name = "Wellness", ColorHex = "#C8B8A0" };
            
            db.Categories.AddRange(catStudy, catSport, catHealth, catWellness);
            await db.SaveChangesAsync(); // SAVE CATEGORIES (to get their IDs)

            // 2. Create Global Habits in Catalog
            var hRead = new Habit { CategoryId = catStudy.Id, Title = "Read classical literature", Description = "Spend time reading books", IsNegative = false };
            var hTaiChi = new Habit { CategoryId = catSport.Id, Title = "Morning Tai Chi", Description = "Practice gentle martial arts", IsNegative = false };
            var hWater = new Habit { CategoryId = catHealth.Id, Title = "Water intake", Description = "Stay hydrated", IsNegative = false };
            var hSnack = new Habit { CategoryId = catHealth.Id, Title = "Late night snacking", Description = "Avoid eating after dinner", IsNegative = true };
            
            db.Habits.AddRange(hRead, hTaiChi, hWater, hSnack);
            await db.SaveChangesAsync(); // SAVE HABITS (to get their IDs)

            // 3. Find or create a test user
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "alice@example.com");
            if (user == null)
            {
                user = new User
                {
                    Email = "alice@example.com",
                    Nickname = "Alice",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("hunter2hunter2"),
                    Timezone = "Europe/Kyiv",
                    RoleId = 1 // User
                };
                db.Users.Add(user);
                await db.SaveChangesAsync(); // SAVE USER (to get Guid)
            }

            // 4. Create sleep profile
            var sleepProfile = new UserSleepProfile
            {
                UserId = user.Id,
                TargetWakeTime = new TimeOnly(7, 0, 0),
                BaseSleepHours = 8,
                AbsoluteMinSleepHours = 5,
                ShiftStepMinutes = 15,
                WeekendDeviationHours = 1.5m,
                CurrentWakeTime = new TimeOnly(7, 0, 0)
            };
            db.UserSleepProfiles.Add(sleepProfile);
            await db.SaveChangesAsync();

            // 5. Create subscriptions (UserHabits)
            // NOTE: we must specify CategoryId for UserHabit as it's a required FK
            var uhRead = new UserHabit 
            { 
                UserId = user.Id, 
                HabitId = hRead.Id, 
                CategoryId = catStudy.Id, 
                CustomName = "Read classical literature", 
                FrequencyType = Models.FrequencyType.Daily, 
                ScheduleRule = new ScheduleRule { TimeSlot = TimeSlot.Evening },
                IconEmoji = "📚",
                ColorHex = "#A8D5E2"
            }; 

            var uhWater = new UserHabit 
            { 
                UserId = user.Id, 
                HabitId = hWater.Id, 
                CategoryId = catHealth.Id, 
                CustomName = "Water intake", 
                FrequencyType = Models.FrequencyType.Daily, 
                TargetValue = 2000, 
                MetricUnit = "ml",
                IconEmoji = "💧",
                ColorHex = "#E8B4B4"
            };

            var uhSnack = new UserHabit 
            { 
                UserId = user.Id, 
                HabitId = hSnack.Id, 
                CategoryId = catHealth.Id, 
                CustomName = "Late night snacking", 
                FrequencyType = Models.FrequencyType.Daily, 
                IsNegative = true,
                CurrentStreak = 27,
                LongestStreak = 27,
                IconEmoji = "🍪",
                ColorHex = "#C85A54"
            };
            
            db.UserHabits.AddRange(uhRead, uhWater, uhSnack);
            await db.SaveChangesAsync(); // SAVE SUBSCRIPTIONS

            // 6. LIFE SIMULATION (Last 30 days)
            var rnd = new Random(42);
            var today = DateTime.UtcNow.Date;

            for (int i = 30; i >= 0; i--)
            {
                var day = today.AddDays(-i);

                // Mood (Affect)
                db.AffectEntries.Add(new AffectEntry { UserId = user.Id, PleasureScore = rnd.Next(1, 6), ArousalScore = rnd.Next(0, 6), DominanceScore = rnd.Next(1, 6), RecordedAt = day.AddHours(10) });
                db.AffectEntries.Add(new AffectEntry { UserId = user.Id, PleasureScore = rnd.Next(-1, 5), ArousalScore = rnd.Next(-2, 5), DominanceScore = rnd.Next(0, 5), RecordedAt = day.AddHours(20) });

                // Sleep
                var sleepStart = day.AddDays(-1).AddHours(22 + rnd.NextDouble() * 2); 
                var sleepEnd = sleepStart.AddHours(6 + rnd.NextDouble() * 3);
                db.SleepLogs.Add(new SleepLog { UserId = user.Id, SleepStart = sleepStart, SleepEnd = sleepEnd, SleepQuality = rnd.Next(5, 10) });

                // Habit execution
                if (rnd.NextDouble() < 0.8) 
                    db.HabitExecutions.Add(new HabitExecution { UserHabitId = uhRead.Id, LoggedValue = 1, ExecutionTime = day.AddHours(21) });
                
                if (rnd.NextDouble() < 0.9) 
                    db.HabitExecutions.Add(new HabitExecution { UserHabitId = uhWater.Id, LoggedValue = rnd.Next(1500, 2500), ExecutionTime = day.AddHours(15) });

                // Negative habit (Late night snacking)
                // LoggedValue = 1 means the user FAILED (ate late).
                // To have a 27-day streak, we only add "failure" logs for days older than 27 days (i > 26).
                if (i > 26 && rnd.NextDouble() < 0.4) 
                    db.HabitExecutions.Add(new HabitExecution { UserHabitId = uhSnack.Id, LoggedValue = 1, ExecutionTime = day.AddHours(23) });
            }

            await db.SaveChangesAsync();
        }
    }
}