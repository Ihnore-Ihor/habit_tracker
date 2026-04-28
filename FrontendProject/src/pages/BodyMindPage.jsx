import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SleepView from './SleepView.jsx';
import AffectView from './AffectView.jsx';
import BottomNav from '../components/common/BottomNav.jsx';

const TABS = [
  { id: 'sleep', label: '🌙 Sleep' },
  { id: 'mood',  label: '🌸 Mood'  },
];

const contentVar = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
};

export default function BodyMindPage() {
  const [active, setActive] = useState('sleep');

  return (
    <div className="min-h-screen bg-rice pb-28">

      {/* ── Sticky header + tab bar ── */}
      <div
        className="sticky top-0 z-30 px-4 pt-3"
        style={{ background: 'rgba(249,246,238,0.95)', borderBottom: '0.5px rgba(229,231,235,0.50) solid' }}
      >
        <h1 className="mb-3 text-center text-[18px] font-[400] text-[#364153]">Body &amp; Mind</h1>
        <div className="flex justify-center gap-3 pb-3">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className="rounded-[10px] px-6 py-3 text-[14px] font-[500] text-[#2D2D2D] transition-all active:opacity-80"
              style={active === id ? {
                background: 'rgba(122,184,204,0.10)',
                boxShadow: '0 1px 2px -1px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.10)',
                outline: '1.54px rgba(122,184,204,0.40) solid',
                outlineOffset: '-1.54px',
              } : {
                background: 'rgba(255,255,255,0.40)',
                outline: '1.54px rgba(229,231,235,0.50) solid',
                outlineOffset: '-1.54px',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="mx-auto max-w-md px-4 pt-6">
        <AnimatePresence mode="wait">
          {active === 'sleep' ? (
            <motion.div
              key="sleep"
              variants={contentVar}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <SleepView />
            </motion.div>
          ) : (
            <motion.div
              key="mood"
              variants={contentVar}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <AffectView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
