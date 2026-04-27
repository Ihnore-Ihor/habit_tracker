import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import StreakWidget from '../components/widgets/StreakWidget.jsx';
import BottomNav from '../components/common/BottomNav.jsx';
import HabitFormDrawer from '../components/HabitFormDrawer.jsx';
import bambooSingle from '../assets/bamboo-slips-single.svg';
import { fetchUserHabits, logHabitExecution } from '../api/habits.js';
import api from '../api/client.js';
import ChineseFrame from '../components/common/ChineseFrame.jsx';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function buildWeekForDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow   = d.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const mon   = new Date(d);
  mon.setDate(d.getDate() + toMon);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return {
      letter,
      date:     day.getDate(),
      fullDate: new Date(day),
      isToday:  day.toDateString() === today.toDateString(),
      isFuture: day > today,
    };
  });
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function buildMonthCalendar(year, month) {
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Mon-first offset: (getDay() + 6) % 7  →  Mon=0 … Sun=6
  const offset   = (firstDay.getDay() + 6) % 7;

  const days = [];
  for (let i = offset; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push({ fullDate: d, date: d.getDate(), inMonth: false, isToday: false, isFuture: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    d.setHours(0, 0, 0, 0);
    days.push({
      fullDate: new Date(d), date: i, inMonth: true,
      isToday:  d.toDateString() === today.toDateString(),
      isFuture: d > today,
    });
  }
  const trailing = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ fullDate: d, date: i, inMonth: false, isToday: false, isFuture: false });
  }
  return days;
}

// ─── Status computation (extracted so it can be reused on date change) ────────

function computeStatusForDate(habitsData, executionsData, targetDate) {
  const t = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const localDateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

  const statusMap = {};

  habitsData.forEach((h) => {
    const dateExecs = executionsData
      .filter((e) => {
        if (e.userHabitId !== h.id) return false;
        const execDate = new Date(e.executionTime);
        const execDateStr = `${execDate.getFullYear()}-${String(execDate.getMonth() + 1).padStart(2, '0')}-${String(execDate.getDate()).padStart(2, '0')}`;
        return execDateStr === localDateStr;
      })
      .sort((a, b) => new Date(b.executionTime) - new Date(a.executionTime));

    const lastValue = dateExecs.length > 0 ? dateExecs[0].loggedValue : null;
    const totalSum  = Math.max(0, dateExecs.reduce((sum, e) => sum + e.loggedValue, 0));
    let currentStatus = 'pending';

    if (h.isNegative) {
      if (lastValue !== null && lastValue > 0) currentStatus = 'failed';
    } else {
      if (h.targetValue > 1) {
        if (totalSum >= h.targetValue) currentStatus = 'done';
      } else {
        if (lastValue === 1) currentStatus = 'done';
      }
    }

    statusMap[h.id] = {
      status:      currentStatus,
      loggedValue: h.targetValue > 1 ? totalSum : (lastValue || 0),
    };
  });

  return statusMap;
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
      type="button" onClick={onClick} disabled={disabled} aria-label="Mark as done"
      className="h-5 w-5 shrink-0 rounded-[4px] border-[1.5px] border-[#99A1AF] bg-[#F3F3F5] shadow-sm transition-colors active:border-jade active:bg-jade/10 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

function CheckDone({ onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label="Undo completion"
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
      type="button" onClick={onClick} disabled={disabled} aria-label="Undo failure"
      className="grid h-9 w-[52px] shrink-0 place-items-center rounded-lg text-[10px] font-[500] text-garnet transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: 'rgba(200,90,84,0.15)', outline: '0.5px rgba(200,90,84,0.40) solid', outlineOffset: '-0.5px' }}
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
        <div className="h-full rounded-full bg-jade transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-[11px] font-[500] text-ink-soft">
        {(value || 0).toLocaleString()}/{(max || 0).toLocaleString()}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

// ─── Slide-to-fail ────────────────────────────────────────────────────────────

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
      style={{ background: 'rgba(200,90,84,0.08)', outline: '0.5px rgba(200,90,84,0.25) solid', outlineOffset: '-0.5px' }}
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
      <div className="mb-3 rounded-xl border border-ink/10 bg-ink/[0.05] px-3 py-3 text-center">
        <span className="text-[28px] font-light tabular-nums leading-none tracking-tight text-ink">
          {buf || '0'}
        </span>
        {unit && <span className="ml-1.5 text-[14px] text-ink-soft">{unit}</span>}
      </div>
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

function HabitCard({ habit, statusInfo, isExpanded, isProcessing, isReadOnly, onToggleExpand, onDone, onFail, onUndo, onLog, onEdit }) {
  const type    = getHabitType(habit);
  const { status, loggedValue } = statusInfo;
  const isDone    = status === 'done';
  const isFailed  = status === 'failed';
  const isPending = status === 'pending';

  const title     = habit.customName || 'Unnamed Habit';
  const icon      = habit.iconEmoji  || (habit.isNegative ? '🚫' : '✅');
  const accentHex = habit.isNegative ? '#C85A54' : (habit.colorHex || '#8FBC8F');
  // In read-only mode numeric cards don't expand
  const canExpand = type === 'numeric' && isPending && !isReadOnly;

  // Effective disabled state for interaction controls
  const blocked = isProcessing || isReadOnly;

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

              {/* Action zone */}
              <div
                className="ml-1 flex shrink-0 items-center gap-1.5 self-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Edit button — pencil icon, always available */}
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    aria-label="Edit habit"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-ink/25 transition-colors active:bg-ink/10 active:text-ink/50"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
                    </svg>
                  </button>
                )}

                {isDone && (
                  <CheckDone
                    disabled={blocked}
                    onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  />
                )}
                {isFailed && (
                  <FailedBadge
                    disabled={blocked}
                    onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  />
                )}
                {isPending && (
                  <>
                    {type === 'boolean' && (
                      <CheckEmpty
                        disabled={blocked}
                        onClick={(e) => { e.stopPropagation(); onDone(); }}
                      />
                    )}
                    {type === 'numeric' && (
                      <motion.button
                        type="button"
                        animate={{ rotate: isExpanded ? 45 : 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                        disabled={blocked}
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: `${accentHex}25`, border: `1px solid ${accentHex}50` }}
                      >
                        <span className="text-sm font-bold leading-none" style={{ color: accentHex }}>+</span>
                      </motion.button>
                    )}
                    {type === 'slide' && (
                      <SlideToFail onFail={onFail} disabled={blocked} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Numeric logger panel */}
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

function PavilionSection({ config, habits, habitStatus, expandedId, processingHabits, isReadOnly, onDone, onFail, onUndo, onLog, onToggleExpand, onEdit }) {
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
            isReadOnly={isReadOnly}
            onToggleExpand={() => onToggleExpand(h.id)}
            onDone={() => onDone(h.id)}
            onFail={() => onFail(h.id)}
            onUndo={() => onUndo(h.id)}
            onLog={(payload) => onLog(h.id, payload)}
            onEdit={() => onEdit(h)}
          />
        ))}
      </motion.div>
    </motion.section>
  );
}

// ─── Week strip with date-selection and expandable month calendar ─────────────

function WeekStrip({ selectedDate, onSelectDate }) {
  const [showCal,   setShowCal]   = useState(false);
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  // Sync the calendar view to match the selected date's month whenever it changes
  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate]);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekDays = useMemo(() => buildWeekForDate(selectedDate), [selectedDate]);
  const calDays  = useMemo(() => buildMonthCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const isSameDay  = (a, b) => a.toDateString() === b.toDateString();
  const isSelected = (d)    => isSameDay(d, selectedDate);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handlePickDay = (fullDate) => {
    onSelectDate(fullDate);
    setShowCal(false);
  };

  return (
    <div>
      {/* ── 7-day row ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {weekDays.map((d, i) => {
          const sel = isSelected(d.fullDate);
          const tod = d.isToday;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(d.fullDate)}
              className={`flex flex-col items-center gap-1 ${d.isFuture ? 'opacity-50' : ''}`}
            >
              <span className={`text-[9px] font-[500] uppercase tracking-[0.02em] ${sel || tod ? 'text-jade-deep' : 'text-[#99A1AF]'}`}>
                {d.letter}
              </span>
              <div className={[
                'relative flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-[500] transition-colors',
                sel  ? 'bg-jade text-white shadow-sm' :
                tod  ? 'border border-jade text-jade-deep' :
                       'text-[#4A5565]',
              ].join(' ')}>
                {d.date}
                {/* Today dot when today is NOT selected */}
                {tod && !sel && (
                  <span className="absolute -bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-jade" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Expand toggle ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowCal((s) => !s)}
        aria-label={showCal ? 'Collapse calendar' : 'Expand calendar'}
        className="mt-2 flex w-full items-center justify-center gap-2 py-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <div className="h-px w-8 bg-ink/20" />
        <motion.div
          animate={{ rotate: showCal ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 3.5 5 6.5 8 3.5" />
          </svg>
        </motion.div>
        <div className="h-px w-8 bg-ink/20" />
      </button>

      {/* ── Expandable month calendar ──────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showCal && (
          <motion.div
            key="cal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-ink/[0.08] bg-white/60 px-3 py-3">
              {/* Month navigation */}
              <div className="mb-2 flex items-center justify-between">
                <button onClick={prevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/[0.06] text-ink-mute transition-colors active:bg-ink/10">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6.5 2 3 5 6.5 8" />
                  </svg>
                </button>
                <span className="text-[12px] font-[600] text-ink">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/[0.06] text-ink-mute transition-colors active:bg-ink/10">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 2 7 5 3.5 8" />
                  </svg>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {['M','T','W','T','F','S','S'].map((l, i) => (
                  <div key={i} className="text-center text-[9px] font-[500] uppercase tracking-[0.04em] text-[#99A1AF]">{l}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map((d, i) => {
                  const sel = d.inMonth && isSelected(d.fullDate);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!d.inMonth}
                      onClick={() => d.inMonth && handlePickDay(d.fullDate)}
                      className={[
                        'flex h-7 w-full items-center justify-center rounded-full text-[11px] font-[500] transition-colors',
                        !d.inMonth  ? 'invisible pointer-events-none' :
                        sel         ? 'bg-jade text-white shadow-sm' :
                        d.isToday   ? 'border border-jade text-jade-deep' :
                        d.isFuture  ? 'text-[#4A5565] opacity-40' :
                                      'text-[#4A5565] active:bg-ink/10',
                      ].join(' ')}
                    >
                      {d.inMonth ? d.date : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useAuth();

  // ── Date selection ────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const isTodaySelected = useMemo(() => {
    const s = new Date(selectedDate); s.setHours(0, 0, 0, 0);
    return s.getTime() === today.getTime();
  }, [selectedDate, today]);

  // Future guard: viewing a date past today → read-only
  const isReadOnly = useMemo(() => {
    const s = new Date(selectedDate); s.setHours(0, 0, 0, 0);
    return s > today;
  }, [selectedDate, today]);

  // ── Habit & execution state ───────────────────────────────────────────────
  const [habits,        setHabits]        = useState([]);
  const [allExecutions, setAllExecutions] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState('');

  const [habitStatus, setHabitStatus] = useState({});
  const habitStatusRef   = useRef(habitStatus);
  const habitsRef        = useRef(habits);
  const allExecutionsRef = useRef(allExecutions);
  const selectedDateRef  = useRef(selectedDate);

  useEffect(() => { habitStatusRef.current   = habitStatus;   }, [habitStatus]);
  useEffect(() => { habitsRef.current        = habits;        }, [habits]);
  useEffect(() => { allExecutionsRef.current = allExecutions; }, [allExecutions]);
  useEffect(() => { selectedDateRef.current  = selectedDate;  }, [selectedDate]);

  const [expandedId,       setExpandedId]       = useState(null);
  const [processingHabits, setProcessingHabits] = useState(new Set());

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editHabit,  setEditHabit]  = useState(null);

  const openAddDrawer  = useCallback(() => { setEditHabit(null);  setDrawerOpen(true); }, []);
  const openEditDrawer = useCallback((h) => { setEditHabit(h);    setDrawerOpen(true); }, []);
  const closeDrawer    = useCallback(() => { setDrawerOpen(false); }, []);

  // ── Yin/yang streak counts ────────────────────────────────────────────────
  const { yinCount, yangCount } = useMemo(() => {
    let yin = 0; let yang = 0;
    habits.forEach((h) => {
      if (h.isNegative) yin  += (h.currentStreak || 0);
      else              yang += (h.currentStreak || 0);
    });
    return { yinCount: yin, yangCount: yang };
  }, [habits]);

  // ── Data loading ──────────────────────────────────────────────────────────
  // refreshData: fetches fresh habits + executions, recomputes status for
  // whatever date is current at call time (via selectedDateRef).
  const refreshData = useCallback(async () => {
    const [habitsData, executionsData] = await Promise.all([
      fetchUserHabits(),
      api.get('/api/user-habits/executions/recent?take=500').then((r) => r.data).catch(() => []),
    ]);
    setHabits(habitsData);
    setAllExecutions(executionsData);
    setHabitStatus(computeStatusForDate(habitsData, executionsData, selectedDateRef.current));
  }, []); // stable — uses ref for date

  useEffect(() => {
    refreshData()
      .catch(() => setFetchError('Could not load habits.'))
      .finally(() => setLoading(false));
  }, [refreshData]);

  // When selectedDate changes, recompute status from the cached executions
  // without a new network round-trip.
  useEffect(() => {
    if (loading) return;
    setHabitStatus(
      computeStatusForDate(habitsRef.current, allExecutionsRef.current, selectedDate)
    );
    setExpandedId(null);
  }, [selectedDate, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pavilion grouping ──────────────────────────────────────────────────────
  const { pavilionGroups, unknownHabits } = useMemo(() => {
    const groups  = Object.fromEntries(Object.keys(PAVILION_CONFIG).map((k) => [k, []]));
    const unknown = [];
    habits.forEach((h) => {
      if (PAVILION_CONFIG[h.categoryId]) groups[h.categoryId].push(h);
      else                               unknown.push(h);
    });
    return { pavilionGroups: groups, unknownHabits: unknown };
  }, [habits]);

  // ── Processing locks ──────────────────────────────────────────────────────
  const lockHabit   = useCallback((id) => setProcessingHabits((s) => new Set(s).add(id)), []);
  const unlockHabit = useCallback((id) => setProcessingHabits((s) => { const n = new Set(s); n.delete(id); return n; }), []);

  // ── Action handlers (DO NOT TOUCH the undo/log logic below) ──────────────

  const handleDone = useCallback(async (habitId) => {
    if (processingHabits.has(habitId)) return;
    lockHabit(habitId);
    const prev = habitStatusRef.current[habitId];
    setHabitStatus((s) => ({ ...s, [habitId]: { status: 'done', loggedValue: 1 } }));
    try {
      await logHabitExecution(habitId, { loggedValue: 1 });
      await refreshData();
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
      await refreshData();
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
    if (currentData.loggedValue <= 0) return;

    lockHabit(habitId);
    const prev = currentData;
    setHabitStatus((s) => ({ ...s, [habitId]: { status: 'pending', loggedValue: 0 } }));
    setExpandedId(null);
    try {
      await logHabitExecution(habitId, { loggedValue: -(currentData.loggedValue) });
      await refreshData();
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
      return { ...s, [habitId]: { status: newTotal >= target ? 'done' : 'pending', loggedValue: newTotal } };
    });
    try {
      await logHabitExecution(habitId, { loggedValue: payload.value });
      await refreshData();
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

  // ── Return to today shortcut ───────────────────────────────────────────────
  const goToToday = useCallback(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-rice">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-rice-100/95 px-4 pb-3 pt-3 backdrop-blur-md"
        style={{ borderBottom: '0.5px solid rgba(45,45,45,0.10)' }}
      >
        <div className="mx-auto max-w-md space-y-3">

          {/* Title row + bell + streak */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-seal text-xl leading-none text-jade">和</span>
              <span className="text-[14px] font-[400] text-[#364153]">Harmony</span>
            </div>
            <div className="flex items-center gap-2.5">
              <StreakWidget yin={yinCount} yang={yangCount} />
            </div>
          </div>

          {/* Interactive week strip + expandable calendar */}
          <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          {/* Viewing-date banner — hidden when on today */}
          <AnimatePresence>
            {!isTodaySelected && (
              <motion.div
                key="date-banner"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="overflow-hidden"
              >
                <div className={`flex items-center justify-between rounded-xl px-3 py-1.5 ${isReadOnly ? 'bg-diamond/25' : 'bg-jade/10'}`}>
                  <span className={`text-[11px] font-[500] ${isReadOnly ? 'text-diamond' : 'text-jade-deep'}`}>
                    {isReadOnly ? '🔮' : '📜'}&nbsp;
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {isReadOnly ? ' · upcoming' : ' · past'}
                  </span>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="text-[11px] font-[600] text-jade-deep"
                  >
                    Back to today
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Scrollable content ──────────────────────────────────────── */}
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

        {/* Read-only future date notice */}
        {isReadOnly && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-diamond/30 bg-diamond/10 px-4 py-3 text-[12px] text-ink-soft"
          >
            🔮 This is a future date — habits are shown as scheduled. Logging is disabled.
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
                  isReadOnly={isReadOnly}
                  onDone={handleDone}
                  onFail={handleFail}
                  onUndo={handleUndo}
                  onLog={handleLog}
                  onToggleExpand={handleToggleExpand}
                  onEdit={openEditDrawer}
                />
              );
            })}

            {unknownHabits.length > 0 && (
              <PavilionSection
                config={FALLBACK_PAVILION}
                habits={unknownHabits}
                habitStatus={habitStatus}
                expandedId={expandedId}
                processingHabits={processingHabits}
                isReadOnly={isReadOnly}
                onDone={handleDone}
                onFail={handleFail}
                onUndo={handleUndo}
                onLog={handleLog}
                onToggleExpand={handleToggleExpand}
                onEdit={openEditDrawer}
              />
            )}
          </>
        )}

        {!loading && !fetchError && hasHabits && <ProverbCard />}
      </motion.main>

      {/* ── Add habit FAB ────────────────────────────────────────────── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.55 }}
        whileTap={{ scale: 0.90 }}
        onClick={openAddDrawer}
        aria-label="Add habit"
        className="fixed bottom-[84px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-jade"
        style={{ boxShadow: '0 4px 24px -4px rgba(107,155,107,0.65)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>

      {/* ── Bottom nav ───────────────────────────────────────────────── */}
      <BottomNav />

      {/* ── Habit form drawer ────────────────────────────────────────── */}
      <HabitFormDrawer
        open={drawerOpen}
        habit={editHabit}
        onClose={closeDrawer}
        onSaved={refreshData}
      />
    </div>
  );
}
