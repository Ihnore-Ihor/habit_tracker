import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  {
    id: 'habits', label: 'Habits', path: '/dashboard',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'sleep', label: 'Body&Mind', path: '/body-mind', state: { tab: 'affect' },
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18s-7-4.11-7-9.5A3.5 3.5 0 0 1 6.5 5c1.1 0 2.11.5 3.5 1.5 1.39-1 2.4-1.5 3.5-1.5A3.5 3.5 0 0 1 17 8.5c0 5.39-7 9.5-7 9.5z" />
      </svg>
    ),
  },
  {
    id: 'stats', label: 'Stats', path: '/stats',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3,15 7,9 11,12 17,4" />
      </svg>
    ),
  },
  {
    id: 'achievements', label: 'Achievements', path: '/achievements',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="7.5" r="4.5" />
        <path d="M7 11.5l-2 5 5-1.5 5 1.5-2-5" />
      </svg>
    ),
  },
  {
    id: 'profile', label: 'Profile', path: '/profile',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="10" cy="7" r="3" />
        <path d="M4 18a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
];

export { NAV_ITEMS };

export default function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const activeId = NAV_ITEMS.find((item) =>
    item.path && location.pathname.startsWith(item.path)
  )?.id || 'habits';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-2">
        <div
          className="flex items-center rounded-2xl bg-white/70 px-1 py-1.5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
          style={{ outline: '0.5px rgba(255,255,255,0.40) solid', outlineOffset: '-0.5px' }}
        >
          {NAV_ITEMS.map((item) => {
            const { id, label } = item;
            const NavIcon = item.Icon;
            const isActive = id === activeId;
            return (
              <button
                key={id}
                onClick={() => item.path && navigate(item.path, { state: item.state })}
                className={[
                  'flex flex-1 flex-col items-center gap-[5px] rounded-xl py-2 transition-colors',
                  isActive ? 'bg-jade/[0.15]' : '',
                  !item.path ? 'opacity-40 cursor-default' : '',
                ].join(' ')}
              >
                <span className={isActive ? 'text-jade-deep' : 'text-[#6A7282]'}>
                  <NavIcon />
                </span>
                <span
                  className={[
                    'text-[10px] leading-none tracking-[0.01em]',
                    isActive ? 'font-[600] text-jade-deep' : 'font-[500] text-[#6A7282]',
                  ].join(' ')}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
