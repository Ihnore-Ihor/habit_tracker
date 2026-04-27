import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import BottomNav from '../components/common/BottomNav.jsx';

const pageVar = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const itemVar = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 22 } },
};

const SETTINGS = [
  { icon: '🌏', label: 'Timezone',       value: () => Intl.DateTimeFormat().resolvedOptions().timeZone },
  { icon: '🎨', label: 'Theme',          value: () => 'Apothecary (default)' },
  { icon: '🔔', label: 'Notifications',  value: () => 'Coming soon' },
  { icon: '📊', label: 'Data & Privacy', value: () => 'Coming soon' },
  { icon: '❓', label: 'Help & Feedback',value: () => 'Coming soon' },
];

export default function Profile() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="flex min-h-screen flex-col bg-rice">
      <motion.main
        variants={pageVar}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-10"
      >
        {/* ── Avatar + identity ────────────────────────────────────── */}
        <motion.div variants={itemVar} className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-jade/20 ring-4 ring-jade/25"
            style={{ boxShadow: '0 0 0 8px rgba(143,188,143,0.08)' }}
          >
            <span className="font-serif text-[28px] font-[600] leading-none text-jade-deep">
              {initials}
            </span>
          </div>

          <div className="text-center">
            <h1 className="font-serif text-[22px] font-[600] text-ink">
              {user?.name || 'Harmony User'}
            </h1>
            {user?.email && (
              <p className="mt-0.5 text-[13px] text-ink-mute">{user.email}</p>
            )}
          </div>

          <span className="rounded-full bg-jade/15 px-3 py-1 text-[11px] font-[600] text-jade-deep">
            User
          </span>
        </motion.div>

        {/* ── Notifications placeholder ─────────────────────────── */}
        <motion.div
          variants={itemVar}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-diamond/30 bg-diamond/10 px-4 py-3.5"
        >
          <span className="text-xl leading-none">🔔</span>
          <div className="flex-1">
            <p className="text-[13px] font-[500] text-ink">Notifications</p>
            <p className="text-[11px] text-ink-mute">No new notifications</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-garnet" />
        </motion.div>

        {/* ── Settings list ────────────────────────────────────────── */}
        <motion.div
          variants={itemVar}
          className="mb-3 overflow-hidden rounded-2xl border border-ink/[0.07] bg-white/60"
        >
          <p className="px-4 pb-1.5 pt-3.5 text-[10px] font-[600] uppercase tracking-[0.10em] text-ink-mute">
            Preferences
          </p>
          {SETTINGS.map((item, i) => (
            <div
              key={item.label}
              className={[
                'flex cursor-default items-center gap-3 px-4 py-3.5 transition-colors active:bg-ink/[0.03]',
                i < SETTINGS.length - 1 ? 'border-b border-ink/[0.06]' : '',
              ].join(' ')}
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="flex-1 text-[13px] text-ink">{item.label}</span>
              <span className="text-[12px] text-ink-mute">{item.value()}</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 text-ink/25"
              >
                <polyline points="5 3 9 7 5 11" />
              </svg>
            </div>
          ))}
        </motion.div>

        {/* ── App identity ─────────────────────────────────────────── */}
        <motion.div
          variants={itemVar}
          className="mb-5 rounded-2xl border border-ink/[0.07] bg-white/40 px-4 py-4 text-center"
        >
          <span className="font-seal text-2xl text-jade">和</span>
          <p className="mt-1 text-[12px] font-[400] text-ink-mute">Harmony · Version 1.0</p>
          <p className="text-[11px] text-ink/30">Cultivate virtue, one habit at a time.</p>
        </motion.div>

        {/* ── Logout ───────────────────────────────────────────────── */}
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
