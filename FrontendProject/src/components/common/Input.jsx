import { forwardRef, useId, useState } from 'react';
import { motion } from 'framer-motion';

const Input = forwardRef(function Input(
  {
    label,
    type = 'text',
    error,
    helper,
    className = '',
    icon,
    ...rest
  },
  ref
) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  return (
    <label htmlFor={id} className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 inline-block text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">
          {label}
        </span>
      )}
      <div
        className={[
          'group relative flex items-center gap-2 rounded-xl bg-rice',
          'border transition-all duration-200',
          error
            ? 'border-garnet ring-1 ring-garnet/30'
            : focused
            ? 'border-jade-deep ring-1 ring-jade/40'
            : 'border-ink/25',
        ].join(' ')}
      >
        {icon && (
          <span className="pl-3 text-ink-soft transition-colors group-focus-within:text-jade-deep">
            {icon}
          </span>
        )}
        <input
          id={id}
          ref={ref}
          type={type}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={[
            'flex-1 bg-transparent outline-none',
            'h-12 px-3 text-[15px] text-ink placeholder:text-ink/40',
            icon ? 'pl-2' : '',
          ].join(' ')}
          {...rest}
        />
      </div>
      {(helper || error) && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mt-1.5 inline-block text-[12px]',
            error ? 'font-medium text-garnet' : 'text-ink-soft',
          ].join(' ')}
        >
          {error || helper}
        </motion.span>
      )}
    </label>
  );
});

export default Input;
