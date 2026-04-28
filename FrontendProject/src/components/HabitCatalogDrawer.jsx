import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCatalogHabits } from '../api/habits.js';

// ─── Static category metadata ─────────────────────────────────────────────────

const CATEGORY_META = {
  1: { name: 'Study',            emoji: '📖', description: 'Learning and mental growth' },
  2: { name: 'Sport',            emoji: '🏋️', description: 'Physical fitness and movement' },
  3: { name: 'Health',           emoji: '❤️', description: 'Wellbeing and body care' },
  4: { name: 'Wellness',         emoji: '💆', description: 'Mental balance and self-care' },
  5: { name: 'Everyday Routine', emoji: '🧹', description: 'Daily structure and maintenance' },
};

const CATEGORY_ORDER = [1, 2, 3, 4, 5];

// ─── Shared micro-components ──────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="#99A1AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0">
      <polyline points="5 3 9 7 5 11" />
    </svg>
  );
}

function SkeletonRows({ count = 4 }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-ink/[0.06]" />
      ))}
    </div>
  );
}

// ─── Pane slide variants ──────────────────────────────────────────────────────

const panelVar = {
  enter:  (dir) => ({ x: dir > 0 ?  64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 28 } },
  exit:   (dir) => ({ x: dir > 0 ? -64 :  64, opacity: 0, transition: { duration: 0.14 } }),
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function HabitCatalogDrawer({ open, onClose, onSelectHabit, onCreateCustom }) {
  const [catalogHabits, setCatalogHabits] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [fetchError,    setFetchError]    = useState('');
  const [selectedCat,   setSelectedCat]   = useState(null); // null = category list
  const [panelDir,      setPanelDir]      = useState(1);

  // Fetch catalog once when drawer opens
  useEffect(() => {
    if (!open) {
      setSelectedCat(null);
      return;
    }
    setLoading(true);
    setFetchError('');
    fetchCatalogHabits()
      .then((data) => setCatalogHabits(data || []))
      .catch(() => setFetchError('Could not load catalog. Please try again.'))
      .finally(() => setLoading(false));
  }, [open]);

  const habitsForCat = selectedCat
    ? catalogHabits.filter((h) => h.categoryId === selectedCat)
    : [];

  const goToCategory = (catId) => { setPanelDir(1);  setSelectedCat(catId); };
  const goBack       = ()       => { setPanelDir(-1); setSelectedCat(null); };

  const catMeta = selectedCat
    ? (CATEGORY_META[selectedCat] || { name: 'Habits', emoji: '⭐', description: '' })
    : null;

  // Pass full habit object; HabitFormDrawer reads .id as habitId
  const handleSelectHabit = (habit) => onSelectHabit(habit);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="catalog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <motion.div
            key="catalog-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl bg-rice"
            style={{
              boxShadow: '0 -8px 48px -8px rgba(45,45,45,0.18)',
              maxHeight: '88vh',
              outline: '4px solid #A0826D',
              outlineOffset: '-4px',
            }}
          >
            {/* ── Sticky header ── */}
            <div className="shrink-0 rounded-t-3xl bg-rice px-5 pb-3 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/20" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedCat && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06] text-ink-mute transition-colors active:bg-ink/10"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6.5 2 3 5 6.5 8" />
                      </svg>
                    </button>
                  )}
                  <h2 className="font-serif text-[18px] font-[600] text-ink">
                    {selectedCat
                      ? `${catMeta.emoji} ${catMeta.name}`
                      : 'Habit Catalog'}
                  </h2>
                </div>
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

            {/* ── Scrollable pane ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {fetchError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-[13px] text-ink-mute">{fetchError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFetchError('');
                      setLoading(true);
                      fetchCatalogHabits()
                        .then((d) => setCatalogHabits(d || []))
                        .catch(() => setFetchError('Could not load catalog.'))
                        .finally(() => setLoading(false));
                    }}
                    className="rounded-xl bg-jade/15 px-4 py-2 text-[13px] font-[500] text-jade-deep"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait" custom={panelDir}>
                  {!selectedCat ? (
                    /* ── Category list ── */
                    <motion.div
                      key="categories"
                      custom={panelDir}
                      variants={panelVar}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="px-4 py-2"
                    >
                      {loading ? (
                        <SkeletonRows count={5} />
                      ) : (
                        CATEGORY_ORDER.map((catId) => {
                          const meta  = CATEGORY_META[catId];
                          if (!meta) return null;
                          const count = catalogHabits.filter((h) => h.categoryId === catId).length;
                          return (
                            <button
                              key={catId}
                              type="button"
                              onClick={() => goToCategory(catId)}
                              className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-ink/[0.07] bg-white/60 px-4 py-3.5 text-left transition-colors active:bg-ink/[0.04]"
                            >
                              <span className="text-2xl leading-none">{meta.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-[600] text-ink">{meta.name}</p>
                                <p className="text-[11px] text-ink-mute">{meta.description}</p>
                              </div>
                              {count > 0 && (
                                <span className="shrink-0 rounded-full bg-jade/15 px-2 py-0.5 text-[10px] font-[600] text-jade-deep">
                                  {count}
                                </span>
                              )}
                              <ChevronRight />
                            </button>
                          );
                        })
                      )}
                    </motion.div>
                  ) : (
                    /* ── Habit list for selected category ── */
                    <motion.div
                      key={`cat-${selectedCat}`}
                      custom={panelDir}
                      variants={panelVar}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="px-4 py-2"
                    >
                      {loading ? (
                        <SkeletonRows count={4} />
                      ) : habitsForCat.length === 0 ? (
                        <p className="py-8 text-center text-[13px] text-ink-mute">
                          No habits in this category yet.
                        </p>
                      ) : (
                        habitsForCat.map((habit) => (
                          <button
                            key={habit.id}
                            type="button"
                            onClick={() => handleSelectHabit(habit)}
                            className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-ink/[0.07] bg-white/60 px-4 py-3.5 text-left transition-colors active:bg-ink/[0.04]"
                          >
                            <span className="text-2xl leading-none">
                              {habit.iconEmoji || habit.emoji || catMeta.emoji}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[13px] font-[600] text-ink">
                                  {habit.title || habit.name || habit.customName}
                                </p>
                                {habit.isNegative && (
                                  <span className="shrink-0 rounded-full bg-garnet px-2 py-0.5 text-[9px] font-[700] uppercase tracking-[0.06em] text-white">
                                    AVOID
                                  </span>
                                )}
                              </div>
                              {habit.description && (
                                <p className="line-clamp-1 text-[11px] text-ink-mute">
                                  {habit.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight />
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* ── Sticky footer ── */}
            <div
              className="shrink-0 px-4 pb-8 pt-3"
              style={{ borderTop: '0.5px solid rgba(45,45,45,0.08)' }}
            >
              <button
                type="button"
                onClick={onCreateCustom}
                className="w-full rounded-2xl py-3.5 text-[14px] font-[600] text-white transition-opacity active:opacity-80"
                style={{
                  background: 'linear-gradient(135deg, #8FBC8F 0%, #6B9B6B 100%)',
                  boxShadow: '0 4px 20px -4px rgba(107,155,107,0.50)',
                }}
              >
                + Create Custom Habit
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
