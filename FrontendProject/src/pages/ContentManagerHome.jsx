import { useAuth } from '../context/AuthContext.jsx';

export default function ContentManagerHome() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-md px-5 pt-10">
      <p className="text-[12px] uppercase tracking-[0.2em] text-ink-mute">
        Catalog
      </p>
      <h1 className="font-serif text-3xl text-ink">
        Content Manager — {user?.name}
      </h1>
      <p className="mt-6 text-ink-mute">
        Manage the global catalog of habits, categories, and achievements.
      </p>
      <button onClick={logout} className="mt-8 text-[13px] underline text-garnet">
        Sign out
      </button>
    </div>
  );
}
