import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Forbidden() {
  const { logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="ink-seal grid h-14 w-14 place-items-center font-seal text-xl">
        禁
      </div>
      <h1 className="mt-5 font-serif text-3xl text-ink">Forbidden</h1>
      <p className="mt-2 text-ink-mute">
        This pavilion is reserved for another role.
      </p>
      <div className="mt-6 flex gap-4 text-[13px]">
        <Link to="/" className="font-medium text-jade-deep underline underline-offset-4">
          Home
        </Link>
        <button onClick={logout} className="text-garnet underline underline-offset-4">
          Switch account
        </button>
      </div>
    </div>
  );
}
