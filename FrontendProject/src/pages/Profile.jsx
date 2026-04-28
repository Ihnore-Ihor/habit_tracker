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

  // State for Timezone overriding
  const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezoneMode, setTimezoneMode] = useState('auto'); // 'auto' or 'manual'
  const [manualTimezone, setManualTimezone] = useState(systemTz);

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
      
      {/* ── Header ── */}
      <div 
        className="relative w-full bg-rice pb-8 pt-12 overflow-hidden" 
        style={{ borderBottom: '1px solid rgba(229, 231, 235, 0.50)' }}
      >
        {/* Background Arc Watermark */}
        <img
          src={chineseArc}
          alt=""
          aria-hidden
          className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 h-[150%] w-auto object-contain opacity-[0.08] pointer-events-none"
        />
        
        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center justify-center gap-1.5">
           <h1 className="text-[22px] font-serif font-[500] tracking-wide text-[#364153]">
             {user?.name || 'Jade Pavilion'}
           </h1>
           <p className="text-[12px] text-[#6A7282]">
             {memberSinceYear ? `Member since ${memberSinceYear}` : 'Harmony Member'}
           </p>
        </div>
      </div>

      <motion.main
        variants={pageVar}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-6"
      >

        {/* ── Today's Journey ── */}
        <motion.div variants={itemVar} className="mb-8">
          <div className="mb-4 flex items-center gap-3">
             <h2 className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
               Today's Journey
             </h2>
             <div className="flex-1 h-px bg-[#D1D5DC]" />
          </div>
          
          <div className="overflow-hidden rounded-[14px] bg-white/60" style={{ outline: '1.5px solid rgba(229, 231, 235, 0.50)', outlineOffset: '-1.5px' }}>
            {loadingTimeline ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/[0.06]" />
                ))}
              </div>
            ) : todayExecs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-3xl opacity-50">🍃</span>
                <p className="text-[12px] text-[#6A7282]">Your journey begins here.</p>
              </div>
            ) : (
              // Scrollable container for the timeline
              <div className="relative px-5 py-5 max-h-[300px] overflow-y-auto custom-scrollbar">
                
                {/* Vertical spine */}
                <div
                  className="absolute left-[64px] top-[30px] w-px bg-[#D1D5DC]"
                  style={{ bottom: 40 }}
                />

                {todayExecs.map((exec) => {
                  const habit = habitMap[exec.userHabitId];
                  const icon  = habit?.iconEmoji || (habit?.isNegative ? '🚫' : '✅');
                  const name  = habit?.customName || habit?.title || 'Activity';
                  const accentHex = habit?.colorHex || (habit?.isNegative ? '#C85A54' : '#8FBC8F');

                  return (
                    <div key={exec.id} className="relative mb-4 flex items-center gap-4">
                      {/* Time */}
                      <span className="w-9 shrink-0 text-right text-[11px] font-[500] text-[#6A7282]">
                        {formatTime(exec.executionTime)}
                      </span>
                      
                      {/* Interactive Dot */}
                      <div className="relative z-10 flex shrink-0 items-center justify-center bg-white h-4 w-4 rounded-full">
                        <div 
                           className="h-[10px] w-[10px] rounded-full shadow-sm outline outline-1 outline-white" 
                           style={{ backgroundColor: accentHex }}
                        />
                      </div>
                      
                      {/* Entry card */}
                      <div className="flex flex-1 items-center gap-3 rounded-xl border border-ink/[0.06] bg-rice px-3 py-2.5">
                        <div 
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base leading-none"
                          style={{ backgroundColor: `${accentHex}15`, color: accentHex }}
                        >
                          {icon}
                        </div>
                        <p className="text-[13px] font-[500] text-[#364153] leading-snug">{name}</p>
                        {exec.loggedValue > 1 && (
                          <span className="ml-auto text-[11px] font-[600]" style={{ color: accentHex }}>
                            +{exec.loggedValue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Now indicator */}
                <div className="relative mt-2 flex items-center gap-4">
                  <span className="w-9 shrink-0 text-right text-[12px] font-[400] italic text-[#6A7282]">Now</span>
                  <div className="relative z-10 flex shrink-0 items-center justify-center bg-white h-4 w-4 rounded-full">
                     <div className="h-[8px] w-[8px] animate-pulse rounded-full bg-[#99A1AF]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Account ── */}
        <motion.div variants={itemVar} className="mb-6">
          <div className="mb-3 flex items-center gap-3">
             <h2 className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
               Account
             </h2>
             <div className="flex-1 h-px bg-[#D1D5DC]" />
          </div>
          <div className="overflow-hidden rounded-[14px] bg-white/60" style={{ outline: '1.5px solid rgba(229, 231, 235, 0.50)', outlineOffset: '-1.5px' }}>
            {[
              { label: 'Change Nickname', action: () => alert('Nickname modal coming soon!') },
              { label: 'Change Password', action: () => alert('Password reset flow coming soon!') }
            ].map((item, i) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={[
                  'w-full flex items-center justify-between px-5 py-4 transition-colors active:bg-ink/[0.03]',
                  i === 0 ? 'border-b border-ink/[0.06]' : '',
                ].join(' ')}
              >
                <span className="text-[14px] font-[500] text-[#364153]">{item.label}</span>
                <ChevronRight />
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Preferences ── */}
        <motion.div variants={itemVar} className="mb-6">
           <div className="mb-3 flex items-center gap-3">
             <h2 className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
               Preferences
             </h2>
             <div className="flex-1 h-px bg-[#D1D5DC]" />
          </div>
          <div className="overflow-hidden rounded-[14px] bg-white/60" style={{ outline: '1.5px solid rgba(229, 231, 235, 0.50)', outlineOffset: '-1.5px' }}>
            {[
              { label: 'Notifications',   key: 'notifications', activeColor: '#8FBC8F' },
              { label: 'Habit Reminders', key: 'reminders',     activeColor: '#7AB8CC' },
              { label: 'Mood Check-ins',  key: 'moodCheckins',  activeColor: '#E8B4B4' },
            ].map((item, i, arr) => (
              <div
                key={item.key}
                className={[
                  'flex items-center justify-between px-5 py-4',
                  i < arr.length - 1 ? 'border-b border-ink/[0.06]' : '',
                ].join(' ')}
              >
                <span className="text-[14px] font-[400] text-[#364153]">{item.label}</span>
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
        <motion.div variants={itemVar} className="mb-8">
           <div className="mb-3 flex items-center gap-3">
             <h2 className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
               System
             </h2>
             <div className="flex-1 h-px bg-[#D1D5DC]" />
          </div>
          <div className="overflow-hidden rounded-[14px] bg-white/60" style={{ outline: '1.5px solid rgba(229, 231, 235, 0.50)', outlineOffset: '-1.5px' }}>
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/[0.06]">
              <span className="text-[14px] font-[500] text-[#4A5565]">Timezone Mode</span>
              <select 
                className="bg-transparent text-[14px] font-[500] text-[#364153] outline-none text-right cursor-pointer"
                value={timezoneMode}
                onChange={(e) => setTimezoneMode(e.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-[14px] font-[500] text-[#4A5565]">Timezone</span>
              {timezoneMode === 'auto' ? (
                <span className="text-[14px] font-[500] text-[#364153]">
                  {systemTz}
                </span>
              ) : (
                <select 
                  className="bg-transparent text-[14px] font-[500] text-[#364153] outline-none text-right cursor-pointer"
                  value={manualTimezone}
                  onChange={(e) => setManualTimezone(e.target.value)}
                >
                  <option value="Europe/Kyiv">Europe/Kyiv</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  {/* Додай інші, якщо потрібно */}
                </select>
              )}
            </div>

          </div>
        </motion.div>

        {/* ── App identity ── */}
        <motion.div
          variants={itemVar}
          className="mb-8 flex flex-col items-center justify-center gap-1"
        >
          <img src={chineseArc} alt="Harmony Logo" className="h-10 opacity-40 mb-2" />
          <p className="text-[10px] font-[400] text-[#99A1AF] tracking-[0.12px]">
            和 Harmony v1.0.0
          </p>
        </motion.div>

      </motion.main>

      <BottomNav />
    </div>
  );
}
