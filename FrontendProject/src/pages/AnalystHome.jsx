import { useAuth } from '../context/AuthContext.jsx';

export default function AnalystHome() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-md px-5 pt-10">
      <p className="text-[12px] uppercase tracking-[0.2em] text-ink-mute">
        Observatory
      </p>
      <h1 className="font-serif text-3xl text-ink">
        Analyst — {user?.name}
      </h1>
      <p className="mt-6 text-ink-mute">Global platform analytics.</p>
      <button onClick={logout} className="mt-8 text-[13px] underline text-garnet">
        Sign out
      </button>
    </div>
  );
}
