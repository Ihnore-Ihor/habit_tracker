import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import StreakWidget from '../components/widgets/StreakWidget.jsx';
import bambooSingle from '../assets/bamboo-slips-single.svg';
import { fetchUserHabits, logHabitExecution } from '../api/habits.js';
import api from '../api/client.js';
import ChineseFrame from '../components/common/ChineseFrame.jsx';

// ─── Week strip helper ────────────────────────────────────────────────────────

function buildWeek() {
  const today = new Date();
  const dow   = today.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const mon   = new Date(today);
  mon.setDate(today.getDate() + toMon);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return { letter, date: d.getDate(), today: d.toDateString() === today.toDateString() };
  });
}

// ─── Category pavilion config ─────────────────────────────────────────────────

const PAVILION_CONFIG = {
  1: { label: 'Study',    emoji: '📖', bg: 'rgba(168,213,226,0.18)', glow: 'rgba(168,213,226,0.55)' },
  2: { label: 'Sport',    emoji: '🏋️', bg: 'rgba(143,188,143,0.18)', glow: 'rgba(143,188,143,0.45)' },
  3: { label: 'Health',   emoji: '❤️', bg: 'rgba(232,180,180,0.18)', glow: 'rgba(232,180,180,0.55)' },
  4: { label: 'Wellness', emoji: '💆', bg: 'rgba(200,180,150,0.18)', glow: 'rgba(200,180,150,0.55)' },
};
const FALLBACK_PAVILION = {
  label: 'Other', emoji: '⭐',
  bg:   'rgba(184,168,136,0.18)',
  glow: 'rgba(184,168,136,0.45)',
};

// ─── Habit type resolver ──────────────────────────────────────────────────────
// slide   → isNegative: true  (always shows SlideToFail, never a checkbox)
// numeric → isNegative: false AND targetValue > 1
// boolean → isNegative: false AND targetValue == null || 1

function getHabitType(habit) {
  if (habit.isNegative) return 'slide';
  if (habit.targetValue != null && habit.targetValue > 1) return 'numeric';
  return 'boolean';
}

// ─── Motion variants ──────────────────────────────────────────────────────────

const pageVar = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const sectionVar = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
};
const cardListVar = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const cardVar = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
};

// ─── Atomic UI elements ───────────────────────────────────────────────────────

function CheckEmpty({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Mark as done"
      className="h-5 w-5 shrink-0 rounded-[4px] border-[1.5px] border-[#99A1AF] bg-[#F3F3F5] shadow-sm transition-colors active:border-jade active:bg-jade/10 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

function CheckDone({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Undo completion"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-jade shadow-sm transition-transform active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
        <path d="M1 3.5L4 6.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function FailedBadge({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Undo failure"
      className="grid h-9 w-[52px] shrink-0 place-items-center rounded-lg text-[10px] font-[500] text-garnet transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: 'rgba(200,90,84,0.15)',
        outline: '0.5px rgba(200,90,84,0.40) solid',
        outlineOffset: '-0.5px',
      }}
    >
      Failed
    </button>
  );
}

function ProgressBar({ value, max, unit }) {
  const pct = Math.min(100, Math.round(((value || 0) / (max || 1)) * 100));
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-jade transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-[11px] font-[500] text-ink-soft">
        {(value || 0).toLocaleString()}/{(max || 0).toLocaleString()}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

// ─── Slide-to-fail ────────────────────────────────────────────────────────────
// Only shown for isNegative habits. Dragging past 75% of the track fires onFail.

function SlideToFail({ onFail, disabled }) {
  const controls  = useAnimation();
  const USABLE    = 78;
  const THRESHOLD = 58;

  const handleDragEnd = useCallback((_, info) => {
    if (disabled) {
      void controls.start({ x: 0, transition: { type: 'spring', stiffness: 350, damping: 28 } });
      return;
    }
    if (info.offset.x >= THRESHOLD) {
      void controls.start({ x: USABLE, transition: { type: 'spring', stiffness: 400, damping: 30 } });
      onFail();
    } else {
      void controls.start({ x: 0, transition: { type: 'spring', stiffness: 350, damping: 28 } });
    }
  }, [controls, onFail, disabled]);

  return (
    <div
      className="relative h-8 w-[132px] shrink-0 overflow-hidden rounded-lg"
      style={{
        background: 'rgba(200,90,84,0.08)',
        outline: '0.5px rgba(200,90,84,0.25) solid',
        outlineOffset: '-0.5px',
      }}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-end pr-3 text-[10px] font-[500] tracking-[0.04em] text-garnet/70">
        Slide to fail →
      </span>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: USABLE }}
        dragElastic={0}
        dragMomentum={false}
        animate={controls}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'none' }}
        className="absolute left-[3px] top-[3px] z-10 flex h-[26px] w-12 cursor-grab items-center justify-center rounded-[5px] bg-white shadow-sm active:cursor-grabbing"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ transform: 'rotate(90deg)' }}>
          <line x1="4" y1="2" x2="4" y2="10" stroke="rgba(200,90,84,0.60)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M1.5 5L4 2L6.5 5" stroke="rgba(200,90,84,0.60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.5 9L4 12L6.5 9" stroke="rgba(200,90,84,0.30)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </div>
  );
}

// ─── Numeric habit logger ─────────────────────────────────────────────────────
// Custom numpad — never triggers the native mobile keyboard.
// onLog({ value: number, isSuccess: boolean })
//   value      = the amount entered this session (sent as loggedValue to the API)
//   isSuccess  = (currentValue + value) >= targetValue

const NUMPAD_ROWS = [['7','8','9'],['4','5','6'],['1','2','3'],['⌫','0','✓']];

function getQuickChips(target) {
  if (!target || target <= 100)  return [10, 25, 50];
  if (target <= 500)             return [50, 100, 250];
  if (target <= 2000)            return [250, 500, 1000];
  return [1000, 2500, 5000];
}

function NumericHabitLogger({ targetValue, unit, currentValue, onLog, disabled }) {
  const [buf, setBuf] = useState('');
  const entered = parseInt(buf, 10) || 0;

  const submit = useCallback((val) => {
    if (disabled || val <= 0) return;
    onLog({ value: val, isSuccess: (currentValue + val) >= targetValue });
    setBuf('');
  }, [disabled, currentValue, targetValue, onLog]);

  const handleKey = useCallback((key) => {
    if (disabled) return;
    if (key === '⌫') {
      setBuf((b) => b.slice(0, -1));
    } else if (key === '✓') {
      submit(entered);
    } else {
      setBuf((b) => (b === '0' ? key : b + key).slice(0, 5));
    }
  }, [disabled, entered, submit]);

  const chips     = getQuickChips(targetValue);
  const remaining = Math.max(0, (targetValue || 0) - currentValue);

  return (
    <div>
      {remaining > 0 && (
        <p className="mb-2 text-center text-[11px] text-ink-mute">
          {remaining.toLocaleString()}{unit ? ` ${unit}` : ''} remaining
        </p>
      )}

      {/* Quick-add chips */}
      <div className="flex flex-wrap justify-center gap-2 pb-3">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => submit(c)} disabled={disabled}
            className="rounded-lg bg-jade/15 px-3 py-1.5 text-[12px] font-bold text-jade-deep transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            +{c.toLocaleString()}
          </button>
        ))}
        {remaining > 0 && !chips.includes(remaining) && (
          <button type="button" onClick={() => submit(remaining)} disabled={disabled}
            className="rounded-lg bg-garnet/10 px-3 py-1.5 text-[12px] font-bold text-garnet transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            +{remaining.toLocaleString()} finish
          </button>
        )}
      </div>

      {/* Value display */}
      <div className="mb-3 rounded-xl border border-ink/10 bg-ink/[0.05] px-3 py-3 text-center">
        <span className="text-[28px] font-light tabular-nums leading-none tracking-tight text-ink">
          {buf || '0'}
        </span>
        {unit && <span className="ml-1.5 text-[14px] text-ink-soft">{unit}</span>}
      </div>

      {/* 4×3 numpad */}
      <div className="grid grid-cols-3 gap-2">
        {NUMPAD_ROWS.flat().map((key) => (
          <button key={key} type="button" onClick={() => handleKey(key)} disabled={disabled}
            className={[
              'flex h-12 items-center justify-center rounded-xl transition-transform active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed',
              key === '✓' ? 'bg-jade font-bold text-white shadow-md'
                          : key === '⌫' ? 'bg-ink/5 text-ink-mute'
                                        : 'border border-ink/5 bg-white text-[20px] font-medium text-ink shadow-sm',
            ].join(' ')}>
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Habit card ───────────────────────────────────────────────────────────────

function HabitCard({ habit, statusInfo, isExpanded, isProcessing, onToggleExpand, onDone, onFail, onUndo, onLog }) {
  const type    = getHabitType(habit);
  const { status, loggedValue } = statusInfo;
  const isDone    = status === 'done';
  const isFailed  = status === 'failed';
  const isPending = status === 'pending';

  const title     = habit.customName || 'Unnamed Habit';
  const icon      = habit.iconEmoji  || (habit.isNegative ? '🚫' : '✅');
  const accentHex = habit.isNegative ? '#C85A54' : (habit.colorHex || '#8FBC8F');
  const canExpand = type === 'numeric' && isPending;

  return (
    <motion.div layout variants={cardVar} className="relative w-full drop-shadow-sm">
      <ChineseFrame frame={3} slice={25} className="w-full drop-shadow-sm">
        <div className="relative p-[2px] bg-transparent">
          <div className="relative overflow-hidden rounded-[8px] bg-[#F9F6EE]" style={{ minHeight: 64 }}>

            <div className="pointer-events-none absolute inset-0 opacity-[0.08]"
                 style={{ backgroundColor: accentHex }} />

            {/* Main content row */}
            <div
              className={`relative z-10 flex items-start gap-3 px-4 py-[15px] ${canExpand && !isProcessing ? 'cursor-pointer select-none' : ''}`}
              onClick={canExpand && !isProcessing ? onToggleExpand : undefined}
            >
              <span className="mt-0.5 shrink-0 text-xl leading-none">{icon}</span>

              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-[600] leading-5 text-ink ${isDone || isFailed ? 'line-through opacity-50' : ''}`}>
                  {title}
                </p>
                <p className="mt-[2px] text-[11px] leading-[14px] text-ink-soft">
                  {habit.metricUnit
                    ? `Target: ${habit.targetValue?.toLocaleString()} ${habit.metricUnit}`
                    : 'Daily objective'}
                </p>
                {type === 'numeric' && (
                  <ProgressBar value={loggedValue} max={habit.targetValue} unit={habit.metricUnit} />
                )}
              </div>

              {/* Action zone — stopPropagation so clicks never bubble to the expand handler */}
              <div
                className="ml-1 flex shrink-0 items-center self-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Done → CheckDone fires undo. Single button, no wrapper div to prevent double-fire. */}
                {isDone && (
                  <CheckDone
                    disabled={isProcessing}
                    onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  />
                )}

                {/* Failed → FailedBadge fires undo */}
                {isFailed && (
                  <FailedBadge
                    disabled={isProcessing}
                    onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  />
                )}

                {isPending && (
                  <>
                    {type === 'boolean' && (
                      <CheckEmpty
                        disabled={isProcessing}
                        onClick={(e) => { e.stopPropagation(); onDone(); }}
                      />
                    )}
                    {type === 'numeric' && (
                      <motion.button
                        type="button"
                        animate={{ rotate: isExpanded ? 45 : 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                        disabled={isProcessing}
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: `${accentHex}25`, border: `1px solid ${accentHex}50` }}
                      >
                        <span className="text-sm font-bold leading-none" style={{ color: accentHex }}>+</span>
                      </motion.button>
                    )}
                    {type === 'slide' && (
                      <SlideToFail onFail={onFail} disabled={isProcessing} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Numeric logger — springs open/closed */}
            <AnimatePresence initial={false}>
              {isExpanded && canExpand && (
                <motion.div
                  key="logger"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="relative z-10 overflow-hidden"
                >
                  <div className="border-t border-ink/10 bg-white/50 px-4 pb-4 pt-3">
                    <NumericHabitLogger
                      targetValue={habit.targetValue}
                      unit={habit.metricUnit || ''}
                      currentValue={loggedValue}
                      disabled={isProcessing}
                      onLog={onLog}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ChineseFrame>
    </motion.div>
  );
}

// ─── Pavilion section ─────────────────────────────────────────────────────────

function PavilionSection({ config, habits, habitStatus, expandedId, processingHabits, onDone, onFail, onUndo, onLog, onToggleExpand }) {
  return (
    <motion.section
      variants={sectionVar}
      className="rounded-3xl p-5"
      style={{ background: config.bg, boxShadow: `0 4px 64px 0px ${config.glow}` }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-[12px] font-[600] uppercase tracking-[0.10em] text-[#4A5565]">
          {config.label}
        </span>
        <div className="h-px flex-1 bg-[#D1D5DC]" />
        <span className="text-lg leading-none">{config.emoji}</span>
      </div>

      <motion.div variants={cardListVar} className="flex flex-col gap-3">
        {habits.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            statusInfo={habitStatus[h.id] || { status: 'pending', loggedValue: 0 }}
            isExpanded={expandedId === h.id}
            isProcessing={processingHabits.has(h.id)}
            onToggleExpand={() => onToggleExpand(h.id)}
            onDone={() => onDone(h.id)}
            onFail={() => onFail(h.id)}
            onUndo={() => onUndo(h.id)}
            onLog={(payload) => onLog(h.id, payload)}
          />
        ))}
      </motion.div>
    </motion.section>
  );
}

// ─── Week day strip ───────────────────────────────────────────────────────────

function WeekStrip({ days }) {
  return (
    <div className="flex items-center justify-between">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className={`text-[9px] font-[500] uppercase tracking-[0.02em] ${d.today ? 'text-jade-deep' : 'text-[#99A1AF]'}`}>
            {d.letter}
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-[500] transition-colors ${d.today ? 'bg-jade text-white shadow-sm' : 'text-[#4A5565]'}`}>
            {d.date}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Proverb card ─────────────────────────────────────────────────────────────

function ProverbCard() {
  return (
    <motion.div
      variants={sectionVar}
      className="relative overflow-hidden rounded-2xl px-6 py-5 text-center"
      style={{ background: 'rgba(255,255,255,0.40)', outline: '0.5px rgba(229,231,235,0.50) solid', outlineOffset: '-0.5px' }}
    >
      <img src={bambooSingle} alt="" aria-hidden
           className="absolute inset-0 h-full w-full object-cover opacity-[0.05] blend-multiply" />
      <blockquote className="relative text-[12px] font-[400] italic leading-[1.7] text-[#4A5565]">
        "The journey of cultivating virtue is like tending a garden—
        <br />each small habit is a seed that blooms into wisdom."
      </blockquote>
      <p className="relative mt-2.5 text-[10px] tracking-[0.02em] text-jade">— Palace Proverb</p>
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      {[3, 2, 2, 2].map((count, i) => (
        <div key={i} className="animate-pulse rounded-3xl bg-ink/[0.06] p-5">
          <div className="mb-3 h-3 w-20 rounded-full bg-ink/10" />
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, j) => (
              <div key={j} className="h-[66px] rounded-[14px] bg-white/50" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-16 text-center"
    >
      <span className="text-5xl">🌱</span>
      <div>
        <p className="text-[15px] font-[600] text-ink">No habits yet</p>
        <p className="mt-1 text-[12px] text-ink-soft">Tap the + button to add your first habit</p>
      </div>
    </motion.div>
  );
}

// ─── Bottom navigation ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'habits',    label: 'Habits',
    Icon: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg> },
  { id: 'sleep',     label: 'Sleep/Mood',
    Icon: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M14 3.5A7 7 0 1 1 4 14a5.5 5.5 0 0 0 10-10.5z" /></svg> },
  { id: 'awards',    label: 'Awards',
    Icon: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="7.5" r="4.5" /><path d="M7 11.5l-2 5 5-1.5 5 1.5-2-5" /></svg> },
  { id: 'analytics', label: 'Analytics',
    Icon: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,15 7,9 11,12 17,4" /></svg> },
  { id: 'profile',   label: 'Profile',
    Icon: () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10" cy="7" r="3" /><path d="M4 18a6 6 0 0 1 12 0" /></svg> },
];

function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-2">
        <div
          className="flex items-center rounded-2xl bg-white/70 px-1 py-1.5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
          style={{ outline: '0.5px rgba(255,255,255,0.40) solid', outlineOffset: '-0.5px' }}
        >
          {NAV_ITEMS.map((item) => {
            const { id, label } = item;
            const NavIcon = item.Icon;
            const isActive = id === active;
            return (
              <button key={id} onClick={() => onChange(id)}
                className={['flex flex-1 flex-col items-center gap-[5px] rounded-xl py-2 transition-colors', isActive ? 'bg-jade/[0.15]' : ''].join(' ')}>
                <span className={isActive ? 'text-jade-deep' : 'text-[#6A7282]'}>
                  <NavIcon />
                </span>
                <span className={['text-[10px] leading-none tracking-[0.01em]', isActive ? 'font-[600] text-jade-deep' : 'font-[500] text-[#6A7282]'].join(' ')}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useAuth();
  const days = useMemo(() => buildWeek(), []);
  const [navActive, setNavActive] = useState('habits');

  const [habits, setHabits]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Per-habit UI state: { [id]: { status: 'pending'|'done'|'failed', loggedValue: number } }
  const [habitStatus, setHabitStatus] = useState({});
  // Ref mirrors state so async handlers always read the latest snapshot.
  const habitStatusRef = useRef(habitStatus);
  useEffect(() => { habitStatusRef.current = habitStatus; }, [habitStatus]);

  const [expandedId, setExpandedId] = useState(null);
  // Set of habitIds currently awaiting an API response — prevents double-fire.
  const [processingHabits, setProcessingHabits] = useState(new Set());

  const lockHabit   = useCallback((id) => setProcessingHabits((s) => new Set(s).add(id)), []);
  const unlockHabit = useCallback((id) => setProcessingHabits((s) => { const n = new Set(s); n.delete(id); return n; }), []);

  const { yinCount, yangCount } = useMemo(() => {
    let yin = 0; // Avoid
    let yang = 0; // Good
    habits.forEach((h) => {
      // Беремо тільки чистий стрік з бази, жодних локальних маніпуляцій
      if (h.isNegative) yin += (h.currentStreak || 0);
      else yang += (h.currentStreak || 0);
    });
    return { yinCount: yin, yangCount: yang };
  }, [habits]);

  // Завантаження даних
  useEffect(() => {
    Promise.all([
      fetchUserHabits(),
      api.get('/api/user-habits/executions/recent?take=100').then(r => r.data).catch(() => [])
    ])
      .then(([habitsData, executionsData]) => {
        setHabits(habitsData);
        
        const initialStatus = {};
        const todayStr = new Date().toISOString().split('T')[0];

        habitsData.forEach(h => {
           // 1. Беремо всі записи за сьогодні для цієї звички
           const todayExecs = executionsData
             .filter(e => e.userHabitId === h.id && e.executionTime.startsWith(todayStr))
             // 2. Сортуємо: найсвіжіші зверху
             .sort((a, b) => new Date(b.executionTime) - new Date(a.executionTime));
           
           // 3. Отримуємо останнє значення, яке ввів користувач (або null, якщо нічого не було)
           const lastValue = todayExecs.length > 0 ? todayExecs[0].loggedValue : null;
           
           // 4. Сума нам потрібна ТІЛЬКИ для прогрес-бару числових звичок.
           // Math.max guards against compensating records making the local total negative.
           const totalSum = Math.max(0, todayExecs.reduce((sum, e) => sum + e.loggedValue, 0));

           let currentStatus = 'pending';

           if (h.isNegative) {
               // ПОГАНА: якщо останній запис > 0 (наприклад 1) - це провал. 
               // Якщо останній запис 0 або записів немає - вона в очікуванні (слайдер).
               if (lastValue !== null && lastValue > 0) currentStatus = 'failed';
           } else {
               if (h.targetValue > 1) {
                   // ЧИСЛОВА: тут все ще працює логіка суми (наприклад, випив 500 + 500 мл)
                   if (totalSum >= h.targetValue) currentStatus = 'done';
               } else {
                   // БУЛЕВА: дивимось ТІЛЬКИ на останній сигнал
                   // Якщо останній клік був "Undo" (0), вона стане 'pending' навіть якщо раніше було (1)
                   if (lastValue === 1) currentStatus = 'done';
               }
           }

           initialStatus[h.id] = { 
               status: currentStatus, 
               loggedValue: h.targetValue > 1 ? totalSum : (lastValue || 0) 
           };
        });
        setHabitStatus(initialStatus);
      })
      .catch(() => setFetchError('Could not load habits.'))
      .finally(() => setLoading(false));
  }, []);

  // Group habits by categoryId. Habits with an unconfigured category go to a fallback bucket.
  const { pavilionGroups, unknownHabits } = useMemo(() => {
    const groups  = Object.fromEntries(Object.keys(PAVILION_CONFIG).map((k) => [k, []]));
    const unknown = [];
    habits.forEach((h) => {
      if (PAVILION_CONFIG[h.categoryId]) {
        groups[h.categoryId].push(h);
      } else {
        unknown.push(h);
      }
    });
    return { pavilionGroups: groups, unknownHabits: unknown };
  }, [habits]);

  // ── Action handlers ───────────────────────────────────────────────────────
  // All handlers optimistically update local state and roll back on API error.
  // Payload shape is always { loggedValue: number } — the strict API contract.

  const handleDone = useCallback(async (habitId) => {
    if (processingHabits.has(habitId)) return;
    lockHabit(habitId);
    const prev = habitStatusRef.current[habitId];
    setHabitStatus((s) => ({ ...s, [habitId]: { status: 'done', loggedValue: 1 } }));
    try {
      await logHabitExecution(habitId, { loggedValue: 1 });
    } catch {
      setHabitStatus((s) => ({ ...s, [habitId]: prev }));
    } finally {
      unlockHabit(habitId);
    }
  }, [processingHabits, lockHabit, unlockHabit]);

  const handleFail = useCallback(async (habitId) => {
    if (processingHabits.has(habitId)) return;
    lockHabit(habitId);
    const prev = habitStatusRef.current[habitId];
    setHabitStatus((s) => ({ ...s, [habitId]: { status: 'failed', loggedValue: 1 } }));
    setExpandedId(null);
    try {
      await logHabitExecution(habitId, { loggedValue: 1 });
    } catch {
      setHabitStatus((s) => ({ ...s, [habitId]: prev }));
    } finally {
      unlockHabit(habitId);
    }
  }, [processingHabits, lockHabit, unlockHabit]);

  const handleUndo = useCallback(async (habitId) => {
    if (processingHabits.has(habitId)) return;
    const currentData = habitStatusRef.current[habitId];
    if (!currentData) return;

    // Nothing to negate — guard applies to all habit types.
    if (currentData.loggedValue <= 0) return;

    lockHabit(habitId);
    const prev = currentData;
    setHabitStatus((s) => ({ ...s, [habitId]: { status: 'pending', loggedValue: 0 } }));
    setExpandedId(null);

    try {
      // Always negate the full accumulated value so SUM(logged_value) returns to 0.
      await logHabitExecution(habitId, { loggedValue: -(currentData.loggedValue) });
      const freshHabits = await fetchUserHabits();
      setHabits(freshHabits);
    } catch {
      setHabitStatus((s) => ({ ...s, [habitId]: prev }));
    } finally {
      unlockHabit(habitId);
    }
  }, [processingHabits, lockHabit, unlockHabit]);

  const handleLog = useCallback(async (habitId, payload) => {
    if (processingHabits.has(habitId)) return;
    lockHabit(habitId);
    const prev  = habitStatusRef.current[habitId];
    const habit = habits.find((h) => h.id === habitId);

    setHabitStatus((s) => {
      const cur      = s[habitId] || { status: 'pending', loggedValue: 0 };
      const newTotal = cur.loggedValue + payload.value;
      const target   = habit?.targetValue || 1;
      return {
        ...s,
        [habitId]: {
          status:      newTotal >= target ? 'done' : 'pending',
          loggedValue: newTotal,
        },
      };
    });

    try {
      await logHabitExecution(habitId, { loggedValue: payload.value });
      const freshHabits = await fetchUserHabits();
      setHabits(freshHabits);
    } catch {
      setHabitStatus((s) => ({ ...s, [habitId]: prev }));
    } finally {
      unlockHabit(habitId);
    }
  }, [processingHabits, habits, lockHabit, unlockHabit]);

  const handleToggleExpand = useCallback((habitId) => {
    setExpandedId((prev) => (prev === habitId ? null : habitId));
  }, []);

  const hasHabits = habits.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-rice">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-rice-100/95 px-4 pb-3 pt-3 backdrop-blur-md"
        style={{ borderBottom: '0.5px solid rgba(45,45,45,0.10)' }}
      >
        <div className="mx-auto max-w-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-seal text-xl leading-none text-jade">和</span>
              <span className="text-[14px] font-[400] text-[#364153]">Harmony</span>
            </div>
            <StreakWidget yin={yinCount} yang={yangCount} />
          </div>
          <WeekStrip days={days} />
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <motion.main
        variants={pageVar}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 pb-28 pt-5"
      >
        {loading && <LoadingSkeleton />}

        {fetchError && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-garnet/30 bg-garnet/5 px-4 py-3 text-[13px] text-garnet"
          >
            {fetchError}
          </motion.div>
        )}

        {!loading && !fetchError && !hasHabits && <EmptyState />}

        {!loading && !fetchError && hasHabits && (
          <>
            {Object.entries(PAVILION_CONFIG).map(([catId, config]) => {
              const catHabits = pavilionGroups[catId] || [];
              if (!catHabits.length) return null;
              return (
                <PavilionSection
                  key={catId}
                  config={config}
                  habits={catHabits}
                  habitStatus={habitStatus}
                  expandedId={expandedId}
                  processingHabits={processingHabits}
                  onDone={handleDone}
                  onFail={handleFail}
                  onUndo={handleUndo}
                  onLog={handleLog}
                  onToggleExpand={handleToggleExpand}
                />
              );
            })}

            {/* Safety net: habits with a categoryId not in PAVILION_CONFIG */}
            {unknownHabits.length > 0 && (
              <PavilionSection
                config={FALLBACK_PAVILION}
                habits={unknownHabits}
                habitStatus={habitStatus}
                expandedId={expandedId}
                processingHabits={processingHabits}
                onDone={handleDone}
                onFail={handleFail}
                onUndo={handleUndo}
                onLog={handleLog}
                onToggleExpand={handleToggleExpand}
              />
            )}
          </>
        )}

        {!loading && !fetchError && hasHabits && <ProverbCard />}
      </motion.main>

      {/* ── Add habit FAB ───────────────────────────────────────────── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.55 }}
        whileTap={{ scale: 0.90 }}
        aria-label="Add habit"
        className="fixed bottom-[84px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-jade"
        style={{ boxShadow: '0 4px 24px -4px rgba(107,155,107,0.65)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>

      {/* ── Bottom nav ──────────────────────────────────────────────── */}
      <BottomNav active={navActive} onChange={setNavActive} />
    </div>
  );
}
