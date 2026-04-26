import { motion } from 'framer-motion';

const variants = {
  jade:
    'bg-jade-deep text-rice hover:bg-jade-shadow active:bg-jade-shadow disabled:bg-jade/60',
  garnet:
    'bg-garnet text-rice hover:bg-garnet-deep active:bg-garnet-shadow disabled:bg-garnet/60',
  diamond:
    'bg-diamond text-ink hover:bg-diamond-bronze hover:text-rice active:bg-diamond-bronze disabled:bg-diamond/60',
  ghost:
    'bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10 border border-ink/20',
};

export default function Button({
  variant = 'jade',
  className = '',
  children,
  type = 'button',
  loading = false,
  disabled = false,
  ...rest
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      disabled={disabled || loading}
      className={[
        'relative inline-flex items-center justify-center gap-2',
        'h-12 px-6 rounded-full font-medium tracking-wide',
        'shadow-ink select-none',
        'transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:shadow-none',
        variants[variant] ?? variants.jade,
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-rice/40 border-t-rice animate-spin" />
      )}
      <span>{children}</span>
    </motion.button>
  );
}
