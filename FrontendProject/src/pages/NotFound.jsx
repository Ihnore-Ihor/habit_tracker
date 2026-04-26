import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5">
      <div className="ink-seal grid h-14 w-14 place-items-center font-seal text-xl">
        無
      </div>
      <h1 className="mt-5 font-serif text-3xl text-ink">Path not found</h1>
      <p className="mt-2 text-ink-mute">This pavilion is empty.</p>
      <Link
        to="/"
        className="mt-6 text-[13px] font-medium text-jade-deep underline underline-offset-4"
      >
        Return home
      </Link>
    </div>
  );
}
