import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export default function Register() {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [touched, setTouched] = useState({});

  const update = (k) => (e) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const errors = {
    name: !form.name ? 'Choose a name for your scroll.' : null,
    email: !form.email
      ? 'Email is required.'
      : !/^\S+@\S+\.\S+$/.test(form.email)
      ? 'Looks invalid.'
      : null,
    password: form.password.length < 8 ? 'At least 8 characters.' : null,
    confirm: form.confirm !== form.password ? 'Passwords do not match.' : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (hasErrors) return;
    try {
      await register({
        nickname: form.name,
        email: form.email,
        password: form.password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      navigate('/', { replace: true });
    } catch {
      /* error surfaced via context */
    }
  };

  return (
    <AuthShell
      title="Begin your scroll."
      subtitle="Three pavilions await — habits, sleep, affect."
      sealText="始"
      frame={9}
      footer={
        <p className="rounded-full bg-rice px-5 py-2 text-[13px] text-ink shadow-ink ring-1 ring-ink/10">
          Already keeping a scroll?{' '}
          <Link
            to="/auth/login"
            className="font-semibold text-jade-deep underline-offset-4 hover:underline"
          >
            Return to the gate
          </Link>
        </p>
      }
    >
      <motion.form
        variants={listVariants}
        initial="hidden"
        animate="show"
        onSubmit={onSubmit}
        className="flex flex-col gap-3.5"
        noValidate
      >
        <motion.div variants={itemVariants}>
          <Input
            label="Name"
            placeholder="Your given name"
            value={form.name}
            onChange={update('name')}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            error={touched.name ? errors.name : undefined}
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            }
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@harmony.app"
            value={form.email}
            onChange={update('email')}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={touched.email ? errors.email : undefined}
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={update('password')}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={touched.password ? errors.password : undefined}
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

        <motion.div variants={itemVariants}>
          <Input
            label="Confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the seal"
            value={form.confirm}
            onChange={update('confirm')}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            error={touched.confirm ? errors.confirm : undefined}
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M5 13l4 4L19 7" />
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
            variant="garnet"
            loading={loading}
            className="w-full"
          >
            Open my scroll
          </Button>
        </motion.div>

        <motion.div variants={itemVariants}>
          <LotusDivider className="my-1" />
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center text-[12px] italic text-ink-soft"
        >
          “The bamboo bends, but does not break.”
        </motion.p>
      </motion.form>
    </AuthShell>
  );
}
