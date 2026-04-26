import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthShell from '../../components/common/AuthShell.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import LotusDivider from '../../components/common/LotusDivider.jsx';

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 220, damping: 24 },
  },
};
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});

  const update = (k) => (e) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch {
      /* error surfaced via context */
    }
  };

  return (
    <AuthShell
      title="Welcome back, traveler."
      subtitle="The gates of the pavilion remember you."
      sealText="登"
      frame={4}
      footer={
        <p className="rounded-full bg-rice px-5 py-2 text-[13px] text-ink shadow-ink ring-1 ring-ink/10">
          New to Harmony?{' '}
          <Link
            to="/auth/register"
            className="font-semibold text-jade-deep underline-offset-4 hover:underline"
          >
            Begin your journey
          </Link>
        </p>
      }
    >
      <motion.form
        variants={listVariants}
        initial="hidden"
        animate="show"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <motion.div variants={itemVariants}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@harmony.app"
            value={form.email}
            onChange={update('email')}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={
              touched.email && !form.email ? 'Email is required.' : undefined
            }
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            }
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={update('password')}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={
              touched.password && !form.password
                ? 'Password is required.'
                : undefined
            }
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            }
          />
        </motion.div>

        {error && (
          <motion.div
            variants={itemVariants}
            className="rounded-md border border-garnet/40 bg-garnet/5 px-3 py-2 text-[13px] font-medium text-garnet"
          >
            {error}
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="pt-1">
          <Button
            type="submit"
            variant="jade"
            loading={loading}
            className="w-full"
          >
            Enter the Pavilion
          </Button>
        </motion.div>

        <motion.div variants={itemVariants}>
          <LotusDivider className="my-2" />
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center text-[12px] italic text-ink-soft"
        >
          “A journey of a thousand miles begins with a single step.”
        </motion.p>
      </motion.form>
    </AuthShell>
  );
}
