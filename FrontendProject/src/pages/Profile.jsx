import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import BottomNav from '../components/common/BottomNav.jsx';
import chineseArc from '../assets/chinese-arc.svg';
import { fetchUserHabits, fetchRecentExecutions } from '../api/habits.js';

const pageVar = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const itemVar = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 22 } },
};

function ToggleSwitch({ checked, onChange, activeColor }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: checked ? activeColor : 'rgba(45,45,45,0.15)' }}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className="shrink-0 text-ink/25">
    <polyline points="5 3 9 7 5 11" />
  </svg>
);

export default function Profile() {
  const { user, logout } = useAuth();

  const [executions,     setExecutions]     = useState([]);
  const [habits,         setHabits]         = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [prefs, setPrefs] = useState({
    notifications: true,
    reminders:     false,
    moodCheckins:  false,
  });

  useEffect(() => {
    Promise.all([
      fetchRecentExecutions(100),
      fetchUserHabits(),
    ])
      .then(([execs, habs]) => {
        setExecutions(execs);
        setHabits(habs);
      })
      .catch(() => {})
      .finally(() => setLoadingTimeline(false));
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const today = new Date();
  const todayExecs = executions
    .filter((e) => new Date(e.executionTime).toDateString() === today.toDateString())
    .sort((a, b) => new Date(a.executionTime) - new Date(b.executionTime));

  const habitMap = Object.fromEntries(habits.map((h) => [h.id, h]));

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

  const memberSinceYear = user?.raw?.iat
    ? new Date(user.raw.iat * 1000).getFullYear()
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-rice">
      <motion.main
        variants={pageVar}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-0"
      >

        {/* ── Arc header ── */}
        <motion.div
          variants={itemVar}
          className="relative -mx-4 mb-6 overflow-hidden rounded-b-3xl bg-jade/[0.06]"
          style={{ height: 190 }}
        >
          <img
            src={chineseArc}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain opacity-[0.14] pointer-events-none"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-jade/20 ring-4 ring-jade/25"
              style={{ boxShadow: '0 0 0 8px rgba(143,188,143,0.08)' }}
            >
              <span className="font-serif text-[26px] font-[600] leading-none text-jade-deep">
                {initials}
              </span>
            </div>
            <h1 className="font-serif text-[21px] font-[600] text-ink">
              {user?.name || 'Harmony User'}
            </h1>
            {user?.email && (
              <p className="text-[12px] text-ink-mute">{user.email}</p>
            )}
            {memberSinceYear && (
              <p className="text-[11px] text-ink/40">Member since {memberSinceYear}</p>
            )}
          </div>
        </motion.div>

        {/* ── Today's Journey ── */}
        <motion.div variants={itemVar} className="mb-4">
          <p className="mb-2 px-1 text-[10px] font-[600] uppercase tracking-[0.10em] text-ink-mute">
            Today's Journey
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/[0.07] bg-white/60">
            {loadingTimeline ? (
              <div className="space-y-2 p-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-[44px] animate-pulse rounded-xl bg-ink/[0.06]" />
                ))}
              </div>
            ) : todayExecs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="text-3xl">🌱</span>
                <p className="text-[12px] text-ink-mute">No activity logged yet today</p>
              </div>
            ) : (
              <div className="relative px-4 py-4">
                {/* Vertical spine */}
                <div
                  className="absolute left-[56px] top-[26px] w-px bg-jade/25"
                  style={{ bottom: 32 }}
                />

                {todayExecs.map((exec) => {
                  const habit = habitMap[exec.userHabitId];
                  const icon  = habit?.iconEmoji || (habit?.isNegative ? '🚫' : '✅');
                  const name  = habit?.customName || 'Activity';
                  return (
                    <div key={exec.id} className="relative mb-3 flex items-center gap-3">
                      {/* Time */}
                      <span className="w-10 shrink-0 text-right text-[10px] font-[500] leading-none text-ink-mute">
                        {formatTime(exec.executionTime)}
                      </span>
                      {/* Dot */}
                      <div className="relative z-10 shrink-0">
                        <div className="h-2.5 w-2.5 rounded-full bg-jade shadow-sm" />
                      </div>
                      {/* Entry card */}
                      <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink/[0.06] bg-rice px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-jade/10 text-base leading-none">
                          {icon}
                        </div>
                        <p className="text-[12px] font-[500] text-ink">{name}</p>
                        {exec.loggedValue > 1 && (
                          <span className="ml-auto text-[10px] font-[500] text-jade-deep">
                            +{exec.loggedValue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Now indicator */}
                <div className="relative flex items-center gap-3">
                  <span className="w-10 shrink-0 text-right text-[10px] font-[600] text-jade">Now</span>
                  <div className="relative z-10 h-2.5 w-2.5 animate-pulse rounded-full bg-jade" />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Account ── */}
        <motion.div variants={itemVar} className="mb-4">
          <p className="mb-2 px-1 text-[10px] font-[600] uppercase tracking-[0.10em] text-ink-mute">
            Account
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/[0.07] bg-white/60">
            {['Change Nickname', 'Change Password'].map((label, i) => (
              <div
                key={label}
                className={[
                  'flex cursor-default items-center gap-3 px-4 py-3.5 transition-colors active:bg-ink/[0.03]',
                  i === 0 ? 'border-b border-ink/[0.06]' : '',
                ].join(' ')}
              >
                <span className="flex-1 text-[13px] text-ink">{label}</span>
                <span className="text-[11px] text-ink-mute">Coming soon</span>
                <ChevronRight />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Preferences ── */}
        <motion.div variants={itemVar} className="mb-4">
          <p className="mb-2 px-1 text-[10px] font-[600] uppercase tracking-[0.10em] text-ink-mute">
            Preferences
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/[0.07] bg-white/60">
            {[
              { label: 'Notifications',   key: 'notifications', activeColor: '#8FBC8F', subtitle: 'Daily habit reminders' },
              { label: 'Habit Reminders', key: 'reminders',     activeColor: '#A8D5E2', subtitle: 'Custom schedule alerts' },
              { label: 'Mood Check-ins',  key: 'moodCheckins',  activeColor: '#E8B4B4', subtitle: 'Evening reflection prompts' },
            ].map((item, i, arr) => (
              <div
                key={item.key}
                className={[
                  'flex items-center gap-3 px-4 py-3.5',
                  i < arr.length - 1 ? 'border-b border-ink/[0.06]' : '',
                ].join(' ')}
              >
                <div className="flex-1">
                  <p className="text-[13px] font-[500] text-ink">{item.label}</p>
                  <p className="text-[11px] text-ink-mute">{item.subtitle}</p>
                </div>
                <ToggleSwitch
                  checked={prefs[item.key]}
                  onChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))}
                  activeColor={item.activeColor}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── System ── */}
        <motion.div variants={itemVar} className="mb-4">
          <p className="mb-2 px-1 text-[10px] font-[600] uppercase tracking-[0.10em] text-ink-mute">
            System
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink/[0.07] bg-white/60">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[18px] leading-none">🌏</span>
              <span className="flex-1 text-[13px] text-ink">Timezone</span>
              <span className="text-[12px] text-ink-mute">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── App identity ── */}
        <motion.div
          variants={itemVar}
          className="mb-5 rounded-2xl border border-ink/[0.07] bg-white/40 px-4 py-4 text-center"
        >
          <span className="font-seal text-2xl text-jade">和</span>
          <p className="mt-1 text-[12px] font-[400] text-ink-mute">Harmony · v1.0.0</p>
          <p className="text-[11px] text-ink/30">Cultivate virtue, one habit at a time.</p>
        </motion.div>

        {/* ── Sign Out ── */}
        <motion.div variants={itemVar}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={logout}
            className="w-full rounded-2xl border border-garnet/25 bg-garnet/[0.08] py-3.5 text-[14px] font-[500] text-garnet transition-colors active:bg-garnet/[0.14]"
          >
            Sign Out
          </motion.button>
        </motion.div>

      </motion.main>

      <BottomNav />
    </div>
  );
}
