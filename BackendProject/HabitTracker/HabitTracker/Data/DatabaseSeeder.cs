using System.Globalization;
using System.Text;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.ValueObjects;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Data
{
    public static class DatabaseSeeder
    {
        private static readonly HashSet<string> VipEmails = new(StringComparer.OrdinalIgnoreCase)
        {
            "alice@example.com", "igmail@gmail.com", "bgmail@gmail.com"
        };

        private record UserHabitInfo(Guid Id, bool IsNegative, decimal? TargetValue);
        private record UserInfo(Guid UserId, string Timezone, List<UserHabitInfo> UserHabits);

        // ── Entry point ───────────────────────────────────────────────────────────
        public static async Task SeedAsync(AppDbContext db, string csvFilePath = "Data/real.csv")
        {
            if (await db.Users.AnyAsync())
            {
                Console.WriteLine("[Seeder] Database already contains users — skipping.");
                return;
            }

            Console.WriteLine("[Seeder] Step 1: Base entities...");
            var (cats, habits, achievements) = await SeedBaseEntitiesAsync(db);

            Console.WriteLine("[Seeder] Step 2: VIP users...");
            var vipInfos = await SeedVipUsersAsync(db, habits, cats);

            Console.WriteLine("[Seeder] Step 3: CSV import...");
            var csvUserInfos = await ImportCsvUsersAsync(db, csvFilePath, habits, cats);

            Console.WriteLine("[Seeder] Step 4: History generation...");
            db.ChangeTracker.AutoDetectChangesEnabled = false;
            try
            {
                var rnd = new Random(42);

                foreach (var vip in vipInfos)
                {
                    Console.WriteLine($"[Seeder]   VIP {vip.UserId} — 180 days...");
                    GenerateUserHistory(db, vip.UserId, 180, vip.Timezone, vip.UserHabits,
                                        achievements, completionRate: 0.70 + rnd.NextDouble() * 0.15, rnd);
                    await db.SaveChangesAsync();
                    db.ChangeTracker.Clear();
                }

                int sampleSize = (int)(csvUserInfos.Count * (0.02 + rnd.NextDouble() * 0.01));
                var sampled = csvUserInfos.OrderBy(_ => rnd.NextDouble()).Take(sampleSize).ToList();
                Console.WriteLine($"[Seeder]   Generating 30-day history for {sampled.Count} CSV users...");

                int batchIdx = 0;
                foreach (var u in sampled)
                {
                    GenerateUserHistory(db, u.UserId, 30, u.Timezone, u.UserHabits,
                                        achievements, completionRate: 0.30 + rnd.NextDouble() * 0.30, rnd);
                    if (++batchIdx % 50 == 0)
                    {
                        await db.SaveChangesAsync();
                        db.ChangeTracker.Clear();
                        Console.WriteLine($"[Seeder]   History progress: {batchIdx}/{sampled.Count}");
                    }
                }
                if (batchIdx % 50 != 0)
                {
                    await db.SaveChangesAsync();
                    db.ChangeTracker.Clear();
                }
            }
            finally
            {
                db.ChangeTracker.AutoDetectChangesEnabled = true;
            }

            Console.WriteLine("[Seeder] Step 5: Refreshing materialized views...");
            await RefreshMaterializedViewsAsync(db);

            Console.WriteLine("[Seeder] Done.");
        }

        // ── Step 1: Base entities ─────────────────────────────────────────────────
        private static async Task<(List<Category> cats, List<Habit> habits, List<Achievement> achievements)>
            SeedBaseEntitiesAsync(AppDbContext db)
        {
            var cats = new List<Category>
            {
                new() { Name = "Health",       ColorHex = "#E8B4B4", IconEmoji = "❤️",  IsNegative = false },
                new() { Name = "Fitness",      ColorHex = "#8FBC8F", IconEmoji = "💪",  IsNegative = false },
                new() { Name = "Mindfulness",  ColorHex = "#C8B8A0", IconEmoji = "🧘",  IsNegative = false },
                new() { Name = "Learning",     ColorHex = "#A8D5E2", IconEmoji = "📚",  IsNegative = false },
                new() { Name = "Bad Habits",   ColorHex = "#C85A54", IconEmoji = "⚠️",  IsNegative = true  }
            };
            db.Categories.AddRange(cats);
            await db.SaveChangesAsync();

            // Positive habits: indices 0-6. Negative: 7-8. Neutral: 9.
            var habits = new List<Habit>
            {
                new() { CategoryId = cats[0].Id, Title = "Drink Water",         IsNegative = false, Description = "Stay hydrated — 2 L per day",    IconEmoji = "💧" },
                new() { CategoryId = cats[1].Id, Title = "Morning Exercise",     IsNegative = false, Description = "20 min morning workout",         IconEmoji = "🏃" },
                new() { CategoryId = cats[1].Id, Title = "Evening Walk",         IsNegative = false, Description = "30 min brisk walk",              IconEmoji = "🚶" },
                new() { CategoryId = cats[2].Id, Title = "Meditation",           IsNegative = false, Description = "10 min mindfulness session",     IconEmoji = "🧘" },
                new() { CategoryId = cats[2].Id, Title = "Journaling",           IsNegative = false, Description = "Write in journal before bed",    IconEmoji = "📓" },
                new() { CategoryId = cats[3].Id, Title = "Read a Book",          IsNegative = false, Description = "Read at least 20 pages",         IconEmoji = "📚" },
                new() { CategoryId = cats[3].Id, Title = "Learn a Language",     IsNegative = false, Description = "30 min language practice",       IconEmoji = "🗣️" },
                new() { CategoryId = cats[4].Id, Title = "Late Night Snacking",  IsNegative = true,  Description = "Avoid eating after 9 pm",        IconEmoji = "🍪" },
                new() { CategoryId = cats[4].Id, Title = "Social Media Overuse", IsNegative = true,  Description = "Keep usage under 1 hour",        IconEmoji = "📵" },
                new() { CategoryId = cats[0].Id, Title = "Sleep On Time",        IsNegative = false, Description = "In bed by 23:00",                IconEmoji = "🌙" }
            };
            db.Habits.AddRange(habits);
            await db.SaveChangesAsync();

            var achievements = new List<Achievement>
            {
                new() { Title = "First Step",      Description = "Complete your very first habit",            ColorHex = "#FFD700", IconUrl = "🥇", ConditionKey = ConditionKey.FIRST_ACTION,         TargetValue = 1      },
                new() { Title = "Week Warrior",    Description = "Maintain a 7-day positive streak",          ColorHex = "#C0C0C0", IconUrl = "🔥", ConditionKey = ConditionKey.POSITIVE_STREAK,      TargetValue = 7      },
                new() { Title = "Month Master",    Description = "Maintain a 30-day positive streak",         ColorHex = "#CD7F32", IconUrl = "🏆", ConditionKey = ConditionKey.POSITIVE_STREAK,      TargetValue = 30     },
                new() { Title = "Clean Slate",     Description = "Avoid a negative habit for 14 days",        ColorHex = "#22C55E", IconUrl = "✨", ConditionKey = ConditionKey.NEGATIVE_STREAK,      TargetValue = 14     },
                new() { Title = "Perfect Day",     Description = "Complete every scheduled habit in one day", ColorHex = "#6366F1", IconUrl = "⭐", ConditionKey = ConditionKey.PERFECT_DAY_STREAK,   TargetValue = 1      },
                new() { Title = "Hydration Hero",  Description = "Log 100 000 ml of water total",             ColorHex = "#38BDF8", IconUrl = "💧", ConditionKey = ConditionKey.TOTAL_METRIC_VOLUME,  TargetValue = 100000 },
                new() { Title = "Zen Master",      Description = "Maintain emotional stability for 7 days",   ColorHex = "#A78BFA", IconUrl = "🧘", ConditionKey = ConditionKey.AFFECT_STABILITY,     TargetValue = 7      }
            };
            db.Achievements.AddRange(achievements);
            await db.SaveChangesAsync();

            return (cats, habits, achievements);
        }

        // ── Step 2: VIP users ─────────────────────────────────────────────────────
        private static async Task<List<UserInfo>> SeedVipUsersAsync(
            AppDbContext db, List<Habit> habits, List<Category> cats)
        {
            var vipDefs = new[]
            {
                (Id: Guid.Parse("019dd585-b649-7bac-b8f4-40dfa0c1a566"), RoleId: 1, Nickname: "Alice",  Email: "alice@example.com", Hash: "$2a$11$36InzFnvxY72gQT5rqrK7eZBZXiDdd6Cz0bSW/rOxcuHeDPYC/tbm", Tz: "Europe/Kyiv"),
                (Id: Guid.Parse("c0e534bd-ebcf-4b9b-b4d4-2eb73e501630"), RoleId: 3, Nickname: "Ihor",   Email: "igmail@gmail.com",  Hash: "$2a$12$PC4cNm6UQ7Z1ZXCPw.2ZYuvu07H1wZWxjHegcLzUz/6taLe1iSG1S", Tz: "Europe/Kiev"),
                (Id: Guid.Parse("fdf4e1dc-058f-4bdb-950b-b0389f306594"), RoleId: 2, Nickname: "Ihor2",  Email: "bgmail@gmail.com",  Hash: "$2a$12$frkAaUrAusDLz66GrEDTguzGMBc1ooxcLuTbQ8P2bMR61a661knrC", Tz: "Europe/Kiev")
            };

            // 4 positive global habit indices + 1 negative
            int[] posIdx = { 0, 1, 3, 5 }; // Water, Exercise, Meditation, Reading
            int negIdx  = 7;               // Late Night Snacking

            var result = new List<UserInfo>();

            foreach (var v in vipDefs)
            {
                db.Users.Add(new User
                {
                    Id           = v.Id,
                    RoleId       = v.RoleId,
                    Nickname     = v.Nickname,
                    Email        = v.Email,
                    PasswordHash = v.Hash,
                    Timezone     = v.Tz
                });

                db.UserSleepProfiles.Add(new UserSleepProfile
                {
                    UserId                = v.Id,
                    TargetWakeTime        = new TimeOnly(7, 0),
                    BaseSleepHours        = 8m,
                    AbsoluteMinSleepHours = 6m,
                    ShiftStepMinutes      = 15,
                    WeekendDeviationHours = 1m,
                    CurrentWakeTime       = new TimeOnly(7, 0),
                    SleepDebtMinutes      = 0
                });

                var uhList = new List<UserHabitInfo>();

                foreach (var idx in posIdx)
                {
                    var h  = habits[idx];
                    var tv = idx == 0 ? 2000m : 1m; // Water: 2000 ml; others: 1 rep
                    var mu = idx == 0 ? "ml" : null;
                    var uh = new UserHabit
                    {
                        UserId        = v.Id,
                        HabitId       = h.Id,
                        CategoryId    = h.CategoryId,
                        FrequencyType = FrequencyType.Daily,
                        TargetValue   = tv,
                        MetricUnit    = mu,
                        IsNegative    = false,
                        ColorHex      = cats.First(c => c.Id == h.CategoryId).ColorHex,
                        IconEmoji     = h.IconEmoji
                    };
                    db.UserHabits.Add(uh);
                    uhList.Add(new UserHabitInfo(uh.Id, false, tv));
                }

                var negH = habits[negIdx];
                var uhNeg = new UserHabit
                {
                    UserId        = v.Id,
                    HabitId       = negH.Id,
                    CategoryId    = negH.CategoryId,
                    FrequencyType = FrequencyType.Daily,
                    IsNegative    = true,
                    ColorHex      = "#C85A54",
                    IconEmoji     = negH.IconEmoji
                };
                db.UserHabits.Add(uhNeg);
                uhList.Add(new UserHabitInfo(uhNeg.Id, true, null));

                result.Add(new UserInfo(v.Id, v.Tz, uhList));
            }

            await db.SaveChangesAsync();
            return result;
        }

        // ── Step 3: CSV import ────────────────────────────────────────────────────
        private static async Task<List<UserInfo>> ImportCsvUsersAsync(
            AppDbContext db, string csvFilePath, List<Habit> habits, List<Category> cats)
        {
            if (!File.Exists(csvFilePath))
            {
                Console.WriteLine($"[Seeder] CSV not found at '{csvFilePath}' — skipping import.");
                return new List<UserInfo>();
            }

            var rnd          = new Random(99);
            int batchSize    = 1000;
            int count        = 0;
            var seenIds      = new HashSet<Guid>();
            var result       = new List<UserInfo>();
            // Positive habit pool: indices 0-6
            var posPool      = Enumerable.Range(0, 7).ToArray();

            db.ChangeTracker.AutoDetectChangesEnabled = false;
            try
            {
                using var reader = new StreamReader(csvFilePath);
                await reader.ReadLineAsync(); // header

                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    var f = ParseCsvRow(line);
                    if (f.Count < 32) continue;

                    var email = f[3];
                    if (VipEmails.Contains(email)) continue;

                    if (!Guid.TryParse(f[0], out Guid userId)) userId = Guid.NewGuid();
                    if (!seenIds.Add(userId)) continue; // duplicate row

                    var tz = string.IsNullOrWhiteSpace(f[5]) ? "UTC" : f[5];

                    db.Users.Add(new User
                    {
                        Id           = userId,
                        RoleId       = int.TryParse(f[1], out int rid) ? rid : 1,
                        Nickname     = f[2],
                        Email        = email,
                        PasswordHash = f[4],
                        Timezone     = tz
                    });

                    db.UserSleepProfiles.Add(new UserSleepProfile
                    {
                        UserId                = userId,
                        TargetWakeTime        = TimeOnly.TryParse(f[7], out var twt)  ? twt  : new TimeOnly(7, 0),
                        BaseSleepHours        = decimal.TryParse(f[8],  NumberStyles.Any, CultureInfo.InvariantCulture, out decimal bsh) ? bsh  : 8m,
                        AbsoluteMinSleepHours = decimal.TryParse(f[9],  NumberStyles.Any, CultureInfo.InvariantCulture, out decimal ams) ? Math.Max(ams, 0.1m) : 6m,
                        ShiftStepMinutes      = int.TryParse(f[10], out int ssm)      ? ssm  : 15,
                        WeekendDeviationHours = decimal.TryParse(f[11], NumberStyles.Any, CultureInfo.InvariantCulture, out decimal wdh) ? wdh  : 0m,
                        CurrentWakeTime       = TimeOnly.TryParse(f[12], out var cwt) ? cwt  : new TimeOnly(7, 0),
                        SleepDebtMinutes      = int.TryParse(f[13], out int sdm)      ? sdm  : 0
                    });

                    // Assign 2-3 random positive habits
                    var chosenIdx = posPool.OrderBy(_ => rnd.Next()).Take(rnd.Next(2, 4)).ToArray();
                    var uhList = new List<UserHabitInfo>();
                    foreach (var idx in chosenIdx)
                    {
                        var h  = habits[idx];
                        var tv = idx == 0 ? 2000m : 1m;
                        var mu = idx == 0 ? "ml"   : null;
                        var uh = new UserHabit
                        {
                            UserId        = userId,
                            HabitId       = h.Id,
                            CategoryId    = h.CategoryId,
                            FrequencyType = FrequencyType.Daily,
                            TargetValue   = tv,
                            MetricUnit    = mu,
                            IsNegative    = false,
                            ColorHex      = cats.First(c => c.Id == h.CategoryId).ColorHex,
                            IconEmoji     = h.IconEmoji
                        };
                        db.UserHabits.Add(uh);
                        uhList.Add(new UserHabitInfo(uh.Id, false, tv));
                    }

                    result.Add(new UserInfo(userId, tz, uhList));
                    count++;

                    if (count % batchSize == 0)
                    {
                        await db.SaveChangesAsync();
                        db.ChangeTracker.Clear();
                        Console.WriteLine($"[Seeder]   Imported {count} users...");
                    }
                }

                if (count % batchSize != 0)
                {
                    await db.SaveChangesAsync();
                    db.ChangeTracker.Clear();
                }

                Console.WriteLine($"[Seeder] CSV import complete — {count} users.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Seeder] CSV import error: {ex.Message}");
                throw;
            }
            finally
            {
                db.ChangeTracker.AutoDetectChangesEnabled = true;
            }

            return result;
        }

        // ── Step 4: History generation ────────────────────────────────────────────
        // completionRate: 0.70-0.85 for VIPs, 0.30-0.60 for CSV sample users.
        private static void GenerateUserHistory(
            AppDbContext db,
            Guid userId,
            int daysInPast,
            string timezone,
            List<UserHabitInfo> userHabits,
            List<Achievement> achievements,
            double completionRate,
            Random rnd)
        {
            if (userHabits.Count == 0 || daysInPast <= 0) return;

            var tz       = GetTimeZoneOrUtc(timezone);
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

            // ── Build sleep windows ──────────────────────────────────────────────
            // Index 0 = oldest night (daysInPast nights ago).
            // Sleep starts at 22:00–02:00 local, lasts 6–9 h.
            // Consecutive windows never overlap because sleep ends ≤ 11:00
            // and the next window starts ≥ 22:00 the same evening.
            var sleepWindows = new (DateTime StartUtc, DateTime EndUtc)[daysInPast];
            for (int i = 0; i < daysInPast; i++)
            {
                int dayOffset        = daysInPast - i;               // oldest first
                var nightStart       = nowLocal.AddDays(-dayOffset);  // the evening this sleep begins
                var startLocal       = nightStart.AddHours(22 + rnd.NextDouble() * 4); // 22:00–02:00
                var endLocal         = startLocal.AddHours(6 + rnd.NextDouble() * 3);  // +6 to +9 h
                sleepWindows[i] = (ToUtcSafe(startLocal, tz), ToUtcSafe(endLocal, tz));
            }

            // Insert sleep logs
            foreach (var (s, e) in sleepWindows)
            {
                db.SleepLogs.Add(new SleepLog
                {
                    UserId       = userId,
                    SleepStart   = s,
                    SleepEnd     = e,
                    SleepQuality = rnd.Next(1, 11) // 1-10 inclusive
                });
            }

            // ── Generate activity in each waking window ──────────────────────────
            for (int i = 0; i < sleepWindows.Length; i++)
            {
                var wakingStart = sleepWindows[i].EndUtc;
                var wakingEnd   = (i + 1 < sleepWindows.Length)
                    ? sleepWindows[i + 1].StartUtc
                    : wakingStart.AddHours(14); // last day: approximate waking end
                var wakingHours = Math.Max((wakingEnd - wakingStart).TotalHours, 4.0);

                // Habit executions
                foreach (var uh in userHabits)
                {
                    if (uh.IsNegative)
                    {
                        // Log a "failure" when the user does NOT beat the negative habit.
                        // Lower completionRate → more failures (inverse relationship).
                        if (rnd.NextDouble() > completionRate)
                        {
                            // Failures typically happen late in the waking day (80-95% mark)
                            var t = wakingStart.AddHours(wakingHours * (0.80 + rnd.NextDouble() * 0.15));
                            db.HabitExecutions.Add(new HabitExecution
                            {
                                UserHabitId   = uh.Id,
                                ExecutionTime = t,
                                LoggedValue   = 1m
                            });
                        }
                    }
                    else
                    {
                        if (rnd.NextDouble() < completionRate)
                        {
                            // Spread executions across the waking day (10%–80% of waking window)
                            var fraction    = 0.10 + rnd.NextDouble() * 0.70;
                            var t           = wakingStart.AddHours(wakingHours * fraction);
                            decimal logged  = uh.TargetValue.HasValue
                                ? Math.Round(uh.TargetValue.Value * (decimal)(0.85 + rnd.NextDouble() * 0.30), 2)
                                : 1m;
                            db.HabitExecutions.Add(new HabitExecution
                            {
                                UserHabitId   = uh.Id,
                                ExecutionTime = t,
                                LoggedValue   = logged
                            });
                        }
                    }
                }

                // Affect entries: 1-3 per waking day, mostly mild scores
                int numAffect = rnd.Next(1, 4);
                for (int a = 0; a < numAffect; a++)
                {
                    double fraction = Math.Clamp((a + 0.5) / numAffect + (rnd.NextDouble() - 0.5) * 0.2, 0.05, 0.95);
                    db.AffectEntries.Add(new AffectEntry
                    {
                        UserId         = userId,
                        PleasureScore  = AffectScore(rnd, -1, 3),
                        ArousalScore   = AffectScore(rnd, -1, 3),
                        DominanceScore = AffectScore(rnd,  0, 3),
                        RecordedAt     = wakingStart.AddHours(wakingHours * fraction)
                    });
                }
            }

            // Randomly unlock 1-3 achievements
            int numAch = rnd.Next(1, Math.Min(4, achievements.Count + 1));
            foreach (var ach in achievements.OrderBy(_ => rnd.Next()).Take(numAch))
            {
                var daysAgo    = rnd.Next(1, daysInPast);
                var unlockTime = sleepWindows[sleepWindows.Length - daysAgo].EndUtc
                                     .AddHours(1 + rnd.NextDouble() * 8);
                db.UserAchievements.Add(new UserAchievement
                {
                    UserId          = userId,
                    AchievementId   = ach.Id,
                    CurrentProgress = ach.TargetValue ?? 0,
                    IsUnlocked      = true,
                    UnlockedAt      = unlockTime
                });
            }
        }

        // Generates a score mostly in [normalMin, normalMax], occasionally up to [-5, 5].
        private static int AffectScore(Random rnd, int normalMin, int normalMax)
        {
            if (rnd.NextDouble() < 0.85)
                return rnd.Next(normalMin, normalMax + 1);
            return rnd.Next(-5, 6); // full legal range
        }

        // ── Step 5: Refresh materialized views ───────────────────────────────────
        private static async Task RefreshMaterializedViewsAsync(AppDbContext db)
        {
            // Use standard (non-CONCURRENT) refresh — views are populated WITH NO DATA on first run.
            string[] views =
            [
                "mvw_achievement_rarity",
                "mvw_analyst_proposal_impact",
                "mvw_global_habit_stats",
                "mvw_sleep_recommendation_effectiveness"
            ];

            string[] rawSqls =
            [
                "REFRESH MATERIALIZED VIEW mvw_achievement_rarity",
                "REFRESH MATERIALIZED VIEW mvw_analyst_proposal_impact",
                "REFRESH MATERIALIZED VIEW mvw_global_habit_stats",
                "REFRESH MATERIALIZED VIEW mvw_sleep_recommendation_effectiveness"
            ];

            for (int vi = 0; vi < views.Length; vi++)
            {
                try
                {
                    await db.Database.ExecuteSqlRawAsync(rawSqls[vi]);
                    Console.WriteLine($"[Seeder]   Refreshed {views[vi]}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Seeder]   Warning — could not refresh {views[vi]}: {ex.Message}");
                }
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────
        private static DateTime ToUtcSafe(DateTime localDt, TimeZoneInfo tz)
        {
            var unspecified = DateTime.SpecifyKind(localDt, DateTimeKind.Unspecified);
            if (tz.IsInvalidTime(unspecified))
                unspecified = unspecified.AddHours(1); // skip forward past DST gap
            return TimeZoneInfo.ConvertTimeToUtc(unspecified, tz);
        }

        private static TimeZoneInfo GetTimeZoneOrUtc(string? timezone)
        {
            if (string.IsNullOrWhiteSpace(timezone)) return TimeZoneInfo.Utc;
            try   { return TimeZoneInfo.FindSystemTimeZoneById(timezone); }
            catch { return TimeZoneInfo.Utc; }
        }

        private static List<string> ParseCsvRow(string row)
        {
            var result       = new List<string>();
            var currentField = new StringBuilder();
            bool inQuotes    = false;

            for (int i = 0; i < row.Length; i++)
            {
                char c = row[i];
                if (c == '"')
                {
                    if (inQuotes && i + 1 < row.Length && row[i + 1] == '"')
                    { currentField.Append('"'); i++; }
                    else
                    { inQuotes = !inQuotes; }
                }
                else if (c == ',' && !inQuotes)
                { result.Add(currentField.ToString()); currentField.Clear(); }
                else
                { currentField.Append(c); }
            }

            result.Add(currentField.ToString());
            return result;
        }
    }
}
