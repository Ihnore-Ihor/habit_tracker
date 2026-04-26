import { motion } from 'framer-motion';
import wave from '../../assets/wave-pattern.svg';
import bonsai from '../../assets/bonsai-tree.svg';
import circles from '../../assets/circles-sign.svg';
import ChineseFrame from './ChineseFrame.jsx';

/**
 * Shared visual shell for the Login/Register screens.
 *
 * Layout (mobile-first, no absolute positioning for header content):
 *   1. Fixed background tile of wave-pattern.svg (z:-1, multiply, opacity-10)
 *   2. Centered flex column:
 *        - circles-sign halo BEHIND the red ink-seal (登/始)
 *        - bonsai tree below
 *        - "Harmony" title + ink-stroke + subtitle
 *   3. Form wrapped in <ChineseFrame> with solid bg-rice inner card
 *   4. Footer link inside a soft pill so it stays legible over the pattern
 */
export default function AuthShell({
  title,
  subtitle,
  sealText = '和',
  frame = 4,
  children,
  footer,
}) {
  return (
    <div className="relative min-h-screen w-full bg-rice text-ink safe-top safe-bottom">
      {/* Seamless fixed wave-pattern — isolated child so mix-blend-multiply has
          the rice bg to blend against, not the element's own background */}
      <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-repeat opacity-[0.15] mix-blend-multiply"
          style={{ backgroundImage: `url(${wave})`, backgroundSize: '200px' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-[90%] max-w-md flex-col items-center px-0 pb-10 pt-10">
        {/* ─── Header stack ─────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col items-center text-center"
        >
          {/* Halo + Seal */}
          <div className="relative flex h-32 w-32 items-center justify-center">
            {/* static watermark — no rotation */}
            <img
              src={circles}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-contain opacity-10 tint-garnet"
            />
            <div className="ink-seal pavilion-glow-garnet relative grid h-16 w-16 place-items-center font-seal text-2xl font-bold">
              {sealText}
            </div>
          </div>

          {/* Bonsai */}
          <motion.img
            src={bonsai}
            alt=""
            aria-hidden
            className="mt-5 h-10 w-10 opacity-80 tint-jade blend-multiply"
            animate={{ rotate: [0, 1.5, 0, -1.5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Title */}
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-none tracking-wide text-ink">
            Harmony
          </h1>

          <span className="ink-stroke mt-3 inline-block h-[2px] w-16" />

          <p className="mt-3 text-[13px] leading-snug tracking-wide text-ink-soft">
            {subtitle}
          </p>
        </motion.header>

        {/* ─── Framed form card ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 180,
            damping: 22,
            delay: 0.15,
          }}
          className="mt-7 w-full"
        >
          <ChineseFrame
            frame={frame}
            size="lg"
            className="!bg-rice"
            style={{ backgroundColor: '#F9F6EE' }}
          >
            <div className="px-4 py-5 sm:px-5 sm:py-6">
              <h2 className="mb-1 font-serif text-[22px] font-semibold leading-tight text-ink">
                {title}
              </h2>
              <p className="mb-5 text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                — Step into the pavilion —
              </p>
              {children}
            </div>
          </ChineseFrame>
        </motion.div>

        {/* ─── Footer pill ──────────────────────────────── */}
        <div className="mt-8 flex w-full justify-center">{footer}</div>
      </div>
    </div>
  );
}
