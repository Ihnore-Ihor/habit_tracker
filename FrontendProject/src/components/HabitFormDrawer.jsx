import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createUserHabit, updateUserHabit, deleteUserHabit } from '../api/habits.js';

const PAVILION_OPTIONS = [
  { value: 1, label: 'Study',    emoji: '📖' },
  { value: 2, label: 'Sport',    emoji: '🏋️' },
  { value: 3, label: 'Health',   emoji: '❤️' },
  { value: 4, label: 'Wellness', emoji: '💆' },
];

const EMPTY_FORM = {
  customName:  '',
  categoryId:  1,
  targetValue: 1,
  metricUnit:  '',
  isNegative:  false,
};

export default function HabitFormDrawer({ open, habit, onClose, onSaved }) {
  const isEdit = !!habit;

  const [form,          setForm]          = useState(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmDelete(false);
    setForm(
      habit
        ? {
            customName:  habit.customName  || '',
            categoryId:  habit.categoryId  ?? 1,
            targetValue: habit.targetValue ?? 1,
            metricUnit:  habit.metricUnit  || '',
            isNegative:  habit.isNegative  || false,
          }
        : EMPTY_FORM
    );
  }, [open, habit]);

  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.customName.trim()) { setError('Habit name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        customName:  form.customName.trim(),
        targetValue: Number(form.targetValue) || 1,
        metricUnit:  form.metricUnit.trim() || null,
      };
      if (isEdit) await updateUserHabit(habit.id, payload);
      else        await createUserHabit(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || 'Something went wrong. Please try again.');
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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-rice px-5 pb-10 pt-4"
            style={{ boxShadow: '0 -8px 48px -8px rgba(45,45,45,0.18)' }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />

            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-[18px] font-[600] text-ink">
                {isEdit ? 'Edit Habit' : 'New Habit'}
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06] text-ink-mute transition-colors active:bg-ink/10"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" />
                </svg>
              </button>
            </div>

            {/* ── Form fields ────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-[11px] font-[600] uppercase tracking-[0.08em] text-ink-mute">
                  Habit Name
                </label>
                <input
                  type="text"
                  value={form.customName}
                  onChange={(e) => patch('customName', e.target.value)}
                  placeholder="e.g. Morning Meditation"
                  maxLength={80}
                  className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[14px] text-ink placeholder-ink/30 outline-none transition-all focus:border-jade focus:ring-2 focus:ring-jade/25"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-[11px] font-[600] uppercase tracking-[0.08em] text-ink-mute">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PAVILION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch('categoryId', opt.value)}
                      className={[
                        'flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all',
                        form.categoryId === opt.value
                          ? 'bg-jade/20 ring-1 ring-jade/50'
                          : 'bg-ink/[0.05] active:bg-ink/10',
                      ].join(' ')}
                    >
                      <span className="text-xl leading-none">{opt.emoji}</span>
                      <span
                        className={`text-[10px] font-[500] ${
                          form.categoryId === opt.value ? 'text-jade-deep' : 'text-ink-soft'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target + Unit — hidden for avoidance habits */}
              {!form.isNegative && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-[600] uppercase tracking-[0.08em] text-ink-mute">
                      Target
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99999}
                      value={form.targetValue}
                      onChange={(e) => patch('targetValue', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[14px] text-ink outline-none transition-all focus:border-jade focus:ring-2 focus:ring-jade/25"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-[600] uppercase tracking-[0.08em] text-ink-mute">
                      Unit&nbsp;
                      <span className="font-[400] normal-case tracking-normal text-ink/30">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.metricUnit}
                      onChange={(e) => patch('metricUnit', e.target.value)}
                      placeholder="ml, steps…"
                      maxLength={20}
                      className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[14px] text-ink placeholder-ink/30 outline-none transition-all focus:border-jade focus:ring-2 focus:ring-jade/25"
                    />
                  </div>
                </div>
              )}

              {/* Avoidance toggle */}
              <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3">
                <div>
                  <p className="text-[13px] font-[500] text-ink">Avoidance Habit</p>
                  <p className="text-[11px] text-ink-mute">Track a behaviour you want to resist</p>
                </div>
                <button
                  type="button"
                  onClick={() => patch('isNegative', !form.isNegative)}
                  aria-label="Toggle avoidance habit"
                  className={[
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                    form.isNegative ? 'bg-garnet' : 'bg-ink/20',
                  ].join(' ')}
                >
                  <motion.div
                    animate={{ x: form.isNegative ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-xl bg-garnet/10 px-3 py-2.5 text-[12px] text-garnet"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="mt-5 flex flex-col gap-2.5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-2xl bg-jade py-3.5 text-[14px] font-[600] text-white disabled:opacity-60"
                style={{ boxShadow: '0 4px 20px -4px rgba(107,155,107,0.50)' }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Habit'}
              </motion.button>

              {isEdit && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDelete}
                  disabled={deleting}
                  className={[
                    'w-full rounded-2xl py-3.5 text-[14px] font-[500] transition-colors duration-200',
                    confirmDelete ? 'bg-garnet text-white' : 'bg-garnet/10 text-garnet',
                  ].join(' ')}
                >
                  {deleting ? 'Archiving…' : confirmDelete ? 'Tap again to confirm' : 'Archive Habit'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
