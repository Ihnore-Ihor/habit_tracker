import AwardsView from './AwardsView.jsx';
import BottomNav from '../components/common/BottomNav.jsx';

export default function AchievementsPage() {
  return (
    <div className="min-h-screen bg-rice pb-28">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-30 px-4 pt-3 pb-3 mb-6"
        style={{ background: 'rgba(249,246,238,0.95)', borderBottom: '0.5px rgba(229,231,235,0.50) solid' }}
      >
        <h1 className="text-center text-[18px] font-[400] text-[#364153]">Your Achievements</h1>
      </div>

      <div className="mx-auto max-w-md px-4">
        <AwardsView />
      </div>

      <BottomNav />
    </div>
  );
}
