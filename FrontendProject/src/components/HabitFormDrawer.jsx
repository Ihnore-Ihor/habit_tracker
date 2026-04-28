import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import createStampSvg from '../assets/create-new-habbit-button.svg';
import { createUserHabit, updateUserHabit, deleteUserHabit } from '../api/habits.js';

// ─── Static config ────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 1, label: 'Study',            emoji: '📖' },
  { value: 2, label: 'Sport',            emoji: '🏋️' },
  { value: 3, label: 'Health',           emoji: '❤️' },
  { value: 4, label: 'Wellness',         emoji: '💆' },
  { value: 5, label: 'Everyday Routine', emoji: '🧹' },
];

// Display order Mon→Sun. Backend uses Sun=0, Mon=1 … Sat=6
const DAYS_CONFIG = [
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
  { label: 'S', value: 0 },
];

// timeSlot enum: 0=Anytime, 1=Morning, 2=Afternoon, 3=Evening, 4=Night
const TIME_SLOT_OPTIONS = [
  { value: 0, label: 'Anytime',   color: '#A0826D' },
  { value: 1, label: 'Morning',   color: '#C85A54' },
  { value: 2, label: 'Afternoon', color: '#7DBFCC' },
  { value: 3, label: 'Evening',   color: '#364153' },
  { value: 4, label: 'Night',     color: '#1A2035' },
];

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sat + Sun

const EMPTY_FORM = {
  habitId:        null,    // catalog template id — sent for new habits from catalog
  iconEmoji:      '✨',
  customName:     '',
  description:    '',      // UI-only note, NOT included in API payload
  isNegative:     false,
  categoryId:     1,
  measurementType: 'boolean',
  targetValue:    '',
  metricUnit:     '',
  colorHex:       '#8FBC8F',
  // FrequencyType: 0=Daily, 1=Weekly, 2=Monthly, 3=Once
  frequencyType:  0,
  // Weekly — Specific Days mode
  weeklyMode:     'specific', // 'specific' | 'flexible'
  selectedDays:   ALL_DAYS,
  // Weekly — Flexible mode
  timesPerPeriod: '',
  // Monthly
  dayOfMonth:     '',
  // Once
  oneTimeDate:    '',
  // Time of day
  timeSlot:       0,       // 0=Anytime 1=Morning 2=Afternoon 3=Evening
  useExactTime:   false,
  exactTime:      '',      // e.g. "14:30"
};

// ─── Schedule rule builder ────────────────────────────────────────────────────
// Returns a fully-nulled scheduleRule object for the C# ScheduleRuleDto.
// Every field not relevant to the selected FrequencyType is explicitly null.

function buildScheduleRule(form) {
  const ft = parseInt(form.frequencyType ?? 0);
  const timeSlot  = form.useExactTime ? null : parseInt(form.timeSlot ?? 0);
  const exactTime = form.useExactTime ? (form.exactTime || null) : null;

  switch (ft) {
    case 0: // Daily
      return { daysOfWeek: null, timesPerPeriod: null, dayOfMonth: null, oneTimeDate: null, timeSlot, exactTime };

    case 1: // Weekly
      if (form.weeklyMode === 'flexible') {
        return {
          daysOfWeek:     null,
          timesPerPeriod: parseInt(form.timesPerPeriod) || null,
          dayOfMonth:     null,
          oneTimeDate:    null,
          timeSlot,
          exactTime,
        };
      }
      return {
        daysOfWeek:     form.selectedDays.length > 0 ? form.selectedDays : ALL_DAYS,
        timesPerPeriod: null,
        dayOfMonth:     null,
        oneTimeDate:    null,
        timeSlot,
        exactTime,
      };

    case 2: // Monthly
      return {
        daysOfWeek:     null,
        timesPerPeriod: null,
        dayOfMonth:     parseInt(form.dayOfMonth) || null,
        oneTimeDate:    null,
        timeSlot,
        exactTime,
      };

    case 3: // Once
      return {
        daysOfWeek:     null,
        timesPerPeriod: null,
        dayOfMonth:     null,
        oneTimeDate:    form.oneTimeDate || null,
        timeSlot,
        exactTime,
      };

    default:
      return { daysOfWeek: null, timesPerPeriod: null, dayOfMonth: null, oneTimeDate: null, timeSlot, exactTime };
  }
}

// ─── Shared styled select wrapper ─────────────────────────────────────────────

function StyledSelect({ value, onChange, children, className = '' }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={[
          'w-full appearance-none rounded-xl border border-ink/10 bg-white px-4 py-3',
          'text-[13px] text-ink outline-none transition-all',
          'focus:border-jade focus:ring-1 focus:ring-jade',
          className,
        ].join(' ')}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 4 6 8 10 4" />
        </svg>
      </div>
    </div>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-[600] uppercase tracking-[0.08em] text-ink-mute">
      {children}
    </label>
  );
}

// ─── Pure form hydrator (module-level to avoid re-creation on every render) ───
// Handles catalog DTO (may use .name or .title) and user-habit DTO (.customName).

function buildFormFromHabit(habit, isEdit) {
  const isNumeric = habit.targetValue != null && habit.targetValue > 1;
  const hasExact  = !!(habit.scheduleRule?.exactTime);
  const hasTimes  = habit.scheduleRule?.timesPerPeriod != null;
  return {
    habitId:         isEdit ? null : (habit.id || null),
    iconEmoji:       habit.iconEmoji   || '✨',
    // Catalog templates may return .name or .title; user habits use .customName
    customName:      habit.customName  || habit.name || habit.title || '',
    description:     habit.description || habit.customName || '',
    isNegative:      habit.isNegative  || false,
    // Catalog may nest category; user habits have flat categoryId
    categoryId:      habit.categoryId  ?? habit.category?.id ?? 1,
    measurementType: isNumeric ? 'numeric' : 'boolean',
    targetValue:     isNumeric ? String(habit.targetValue) : '',
    metricUnit:      habit.metricUnit  || '',
    colorHex:        habit.colorHex    || habit.defaultColorHex || '#8FBC8F',
    frequencyType:   habit.frequencyType ?? 0,
    weeklyMode:      hasTimes ? 'flexible' : 'specific',
    selectedDays:    habit.scheduleRule?.daysOfWeek   ?? ALL_DAYS,
    timesPerPeriod:  hasTimes ? String(habit.scheduleRule.timesPerPeriod) : '',
    dayOfMonth:      habit.scheduleRule?.dayOfMonth != null
      ? String(habit.scheduleRule.dayOfMonth) : '',
    oneTimeDate:     habit.scheduleRule?.oneTimeDate || '',
    timeSlot:        habit.scheduleRule?.timeSlot    ?? 0,
    useExactTime:    hasExact,
    exactTime:       habit.scheduleRule?.exactTime   || '',
  };
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function HabitFormDrawer({ open, habit, isEdit, onClose, onSaved }) {
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error,         setError]         = useState('');

  // Effect A — clear transient UI state; reset form to empty when opening with no habit.
  // Deliberately omits `habit` / `isEdit` from deps — Effect B owns those transitions.
  useEffect(() => {
    setError('');
    setConfirmDelete(false);
    if (open && !habit) setForm(EMPTY_FORM);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B — pre-fill form whenever the habit identity changes (catalog selection or
  // edit open). No `!open` guard: fires immediately so data is ready before the drawer
  // animation completes, regardless of whether `open` changed in the same batch.
  useEffect(() => {
    if (!habit) return;
    setForm(buildFormFromHabit(habit, isEdit));
  }, [habit, isEdit]);

  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (dayValue) => {
    setForm((f) => {
      const next = f.selectedDays.includes(dayValue)
        ? f.selectedDays.filter((d) => d !== dayValue)
        : [...f.selectedDays, dayValue];
      return { ...f, selectedDays: next };
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.customName.trim()) { setError('Habit name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        habitId:       isEdit ? null : (form.habitId || null),
        categoryId:    parseInt(form.categoryId),
        customName:    form.customName.trim(),
        isNegative:    form.isNegative,
        targetValue:   form.measurementType === 'numeric'
          ? (parseFloat(form.targetValue) || null)
          : null,
        metricUnit:    form.measurementType === 'numeric'
          ? (form.metricUnit.trim() || null)
          : null,
        frequencyType: parseInt(form.frequencyType ?? 0),
        colorHex:      form.colorHex  || '#8FBC8F',
        iconEmoji:     form.iconEmoji || '✨',
        scheduleRule:  buildScheduleRule(form),
      };

      if (isEdit) await updateUserHabit(habit.id, payload);
      else        await createUserHabit(payload);

      onSaved?.();
      onClose();
    } catch (e) {
      setError(
        e?.response?.data?.message ||
        e?.response?.data?.title   ||
        'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    setError('');
    try {
      await deleteUserHabit(habit.id);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not archive habit.');
    } finally {
      setDeleting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="form-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            key="form-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-rice"
            style={{
              boxShadow: '0 -8px 48px -8px rgba(45,45,45,0.18)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* ── Sticky header ── */}
            <div
              className="sticky top-0 z-10 rounded-t-3xl bg-rice px-5 pb-3 pt-4"
              style={{ borderBottom: '0.5px solid rgba(45,45,45,0.06)' }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/20" />
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[18px] font-[600] text-ink">
                  {isEdit ? 'Edit Habit' : 'New Habit'}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06] text-ink-mute transition-colors active:bg-ink/10"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Form body ── */}
            <div className="space-y-5 px-5 pb-10 pt-5">

              {/* 1 ── Icon | Name | Color */}
              <div className="flex items-center gap-2">
                {/* Emoji input */}
                <input
                  type="text"
                  value={form.iconEmoji}
                  onChange={(e) => patch('iconEmoji', e.target.value)}
                  maxLength={10}
                  aria-label="Habit emoji"
                  className="h-11 w-11 shrink-0 rounded-xl bg-ink/[0.06] text-center text-xl outline-none transition-colors focus:bg-ink/10 focus:ring-2 focus:ring-jade/25"
                />

                {/* Name */}
                <input
                  type="text"
                  value={form.customName}
                  onChange={(e) => patch('customName', e.target.value)}
                  placeholder="e.g. Morning meditation"
                  maxLength={80}
                  className="flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-[14px] text-ink placeholder-ink/30 outline-none transition-all focus:border-jade focus:ring-1 focus:ring-jade"
                />

                {/* Native color picker disguised as a colored circle */}
                <label className="relative h-11 w-11 shrink-0 cursor-pointer" aria-label="Pick colour">
                  <div
                    className="h-full w-full rounded-xl border-[3px] border-white shadow-md transition-transform active:scale-95"
                    style={{ backgroundColor: form.colorHex }}
                  />
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => patch('colorHex', e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>

              {/* 2 ── Note (UI only) */}
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold tracking-[1.2px] text-[#4A5565] uppercase">
                  Description <span className="text-[10px] font-normal lowercase tracking-normal text-ink-mute">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => patch('description', e.target.value)}
                  placeholder="What is this habit about?"
                  className="w-full resize-none rounded-xl border border-[#D1D5DC] bg-white/60 px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-[#8FBC8F] focus:ring-1 focus:ring-[#8FBC8F]"
                  rows={3}
                />
              </div>

              {/* 3 ── Build / Avoid */}
              <div>
                <FieldLabel>Habit Type</FieldLabel>
                <div className="flex gap-1 rounded-xl bg-ink/[0.06] p-1">
                  <button
                    type="button"
                    onClick={() => patch('isNegative', false)}
                    className={[
                      'flex-1 rounded-lg py-2 text-[13px] font-[500] transition-all',
                      !form.isNegative ? 'bg-jade text-white shadow-sm' : 'text-ink-soft',
                    ].join(' ')}
                  >
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => patch('isNegative', true)}
                    className={[
                      'flex-1 rounded-lg py-2 text-[13px] font-[500] transition-all',
                      form.isNegative ? 'bg-garnet text-white shadow-sm' : 'text-ink-soft',
                    ].join(' ')}
                  >
                    Avoid
                  </button>
                </div>
              </div>

              {/* 4 ── Category */}
              <div>
                <FieldLabel>Category</FieldLabel>
                <StyledSelect
                  value={form.categoryId}
                  onChange={(e) => patch('categoryId', Number(e.target.value))}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji}  {opt.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>

              {/* 5 ── Measurement + conditional numeric fields */}
              <div>
                <FieldLabel>Measurement</FieldLabel>
                <div className="flex gap-1 rounded-xl bg-ink/[0.06] p-1">
                  <button
                    type="button"
                    onClick={() => { patch('measurementType', 'boolean'); patch('targetValue', ''); }}
                    className={[
                      'flex-1 rounded-lg py-2 text-[13px] font-[500] transition-all',
                      form.measurementType === 'boolean'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink-soft',
                    ].join(' ')}
                  >
                    Yes / No
                  </button>
                  <button
                    type="button"
                    onClick={() => patch('measurementType', 'numeric')}
                    className={[
                      'flex-1 rounded-lg py-2 text-[13px] font-[500] transition-all',
                      form.measurementType === 'numeric'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink-soft',
                    ].join(' ')}
                  >
                    Numeric
                  </button>
                </div>

                <AnimatePresence>
                  {form.measurementType === 'numeric' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={1}
                          value={form.targetValue}
                          onChange={(e) => patch('targetValue', e.target.value)}
                          placeholder="Target (e.g. 2000)"
                          className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-[13px] text-ink placeholder-ink/30 outline-none focus:border-jade focus:ring-1 focus:ring-jade"
                        />
                        <input
                          type="text"
                          value={form.metricUnit}
                          onChange={(e) => patch('metricUnit', e.target.value)}
                          placeholder="Unit (ml, pages…)"
                          maxLength={20}
                          className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-[13px] text-ink placeholder-ink/30 outline-none focus:border-jade focus:ring-1 focus:ring-jade"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 6 ── Frequency */}
              <div>
                <FieldLabel>Frequency</FieldLabel>
                <StyledSelect
                  value={form.frequencyType}
                  onChange={(e) => patch('frequencyType', Number(e.target.value))}
                >
                  <option value={0}>Daily — every day</option>
                  <option value={1}>Weekly — choose days</option>
                  <option value={2}>Monthly — choose a day</option>
                  <option value={3}>Once — specific date</option>
                </StyledSelect>
              </div>

              {/* 7 ── Frequency-specific scheduling */}
              <AnimatePresence mode="wait">

                {/* Weekly */}
                {form.frequencyType === 1 && (
                  <motion.div
                    key="weekly-schedule"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                    className="overflow-hidden space-y-3"
                  >
                    {/* Specific Days vs Flexible sub-toggle */}
                    <div>
                      <FieldLabel>Weekly Schedule</FieldLabel>
                      <div className="flex gap-1 rounded-xl bg-ink/[0.06] p-1">
                        <button
                          type="button"
                          onClick={() => patch('weeklyMode', 'specific')}
                          className={[
                            'flex-1 rounded-lg py-2 text-[12px] font-[500] transition-all',
                            form.weeklyMode === 'specific'
                              ? 'bg-white text-ink shadow-sm'
                              : 'text-ink-soft',
                          ].join(' ')}
                        >
                          Specific Days
                        </button>
                        <button
                          type="button"
                          onClick={() => patch('weeklyMode', 'flexible')}
                          className={[
                            'flex-1 rounded-lg py-2 text-[12px] font-[500] transition-all',
                            form.weeklyMode === 'flexible'
                              ? 'bg-white text-ink shadow-sm'
                              : 'text-ink-soft',
                          ].join(' ')}
                        >
                          Flexible
                        </button>
                      </div>
                    </div>

                    {/* Content depending on weeklyMode */}
                    <AnimatePresence mode="wait">
                      {form.weeklyMode === 'specific' ? (
                        <motion.div
                          key="specific-days"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14 }}
                        >
                          <FieldLabel>Days</FieldLabel>
                          <div className="flex gap-1.5">
                            {DAYS_CONFIG.map((day) => {
                              const active = form.selectedDays.includes(day.value);
                              return (
                                <button
                                  key={`day-${day.value}`}
                                  type="button"
                                  onClick={() => toggleDay(day.value)}
                                  className={[
                                    'flex h-9 flex-1 items-center justify-center rounded-lg text-[11px] font-[600] transition-all',
                                    active
                                      ? 'bg-jade text-white shadow-sm'
                                      : 'bg-ink/[0.06] text-ink-soft',
                                  ].join(' ')}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="flexible-times"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.14 }}
                        >
                          <FieldLabel>Times per week</FieldLabel>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={1}
                              max={7}
                              value={form.timesPerPeriod}
                              onChange={(e) => patch('timesPerPeriod', e.target.value)}
                              placeholder="e.g. 3"
                              className="w-24 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-center text-[13px] text-ink placeholder-ink/30 outline-none focus:border-jade focus:ring-1 focus:ring-jade"
                            />
                            <span className="text-[12px] text-ink-mute">times this week</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Monthly */}
                {form.frequencyType === 2 && (
                  <motion.div
                    key="monthly-schedule"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <FieldLabel>Day of the month</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={form.dayOfMonth}
                        onChange={(e) => patch('dayOfMonth', e.target.value)}
                        placeholder="e.g. 15"
                        className="w-24 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-center text-[13px] text-ink placeholder-ink/30 outline-none focus:border-jade focus:ring-1 focus:ring-jade"
                      />
                      <span className="text-[12px] text-ink-mute">day of each month</span>
                    </div>
                  </motion.div>
                )}

                {/* Once */}
                {form.frequencyType === 3 && (
                  <motion.div
                    key="once-schedule"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <FieldLabel>Date</FieldLabel>
                    <input
                      type="date"
                      value={form.oneTimeDate}
                      onChange={(e) => patch('oneTimeDate', e.target.value)}
                      className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-[13px] text-ink outline-none transition-all focus:border-jade focus:ring-1 focus:ring-jade"
                    />
                  </motion.div>
                )}

              </AnimatePresence>

              {/* 8 ── Time of Day */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <FieldLabel>Time of Day</FieldLabel>
                  <button
                    type="button"
                    onClick={() => patch('useExactTime', !form.useExactTime)}
                    className={[
                      'rounded-lg px-2.5 py-1 text-[10px] font-[600] uppercase tracking-[0.06em] transition-all',
                      form.useExactTime
                        ? 'bg-jade/20 text-jade-deep'
                        : 'bg-ink/[0.06] text-ink/40',
                    ].join(' ')}
                  >
                    ⏰ Exact Time
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {form.useExactTime ? (
                    <motion.div
                      key="exact"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <input
                        type="time"
                        value={form.exactTime}
                        onChange={(e) => patch('exactTime', e.target.value)}
                        className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-[13px] text-ink outline-none transition-all focus:border-jade focus:ring-1 focus:ring-jade"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="slots"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      {TIME_SLOT_OPTIONS.map((slot) => {
                        const active = form.timeSlot === slot.value;
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => patch('timeSlot', slot.value)}
                            className={[
                              'rounded-lg px-2.5 py-1.5 text-[11px] font-[500] transition-all active:scale-95',
                              active ? 'text-white shadow-sm' : 'bg-ink/[0.06] text-ink-soft',
                            ].join(' ')}
                            style={active ? { backgroundColor: slot.color } : undefined}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl bg-garnet/10 px-3 py-2.5 text-[12px] text-garnet"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── Submit / Actions Zone ── */}
              <div className="mt-8 flex flex-col gap-3 pb-6">
                {isEdit ? (
                  <>
                    <button 
                      type="button" 
                      onClick={handleSave} 
                      disabled={saving}
                      className="w-full rounded-xl bg-[#8FBC8F] py-3.5 font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleDelete} 
                      disabled={deleting}
                      className="w-full rounded-xl bg-[#C85A54]/10 py-3.5 font-semibold text-[#C85A54] transition-all active:scale-95 disabled:opacity-50"
                    >
                      {deleting
                        ? 'Archiving…'
                        : confirmDelete
                        ? '⚠ Tap again to confirm'
                        : 'Archive Habit'}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col justify-center items-center">
                    {saving && (
                      <p className="mb-2 text-[12px] text-ink-soft">Saving…</p>
                    )}
                    <img 
                      src={createStampSvg} 
                      alt="Create Habit" 
                      onClick={saving ? undefined : handleSave}
                      className={`w-[120px] h-auto transition-transform ${saving ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:opacity-90 active:scale-95'}`}
                    />
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
