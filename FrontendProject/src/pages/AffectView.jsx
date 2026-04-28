import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import api from '../api/client.js';
import { endpoints } from '../api/endpoints.js';
import { fetchDailyAffect, fetchAffectSummary } from '../api/affect.js';

// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function lerpHex(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const P_STOPS = [
  { v: -5, color: '#364153' },
  { v:  0, color: '#B8A888' },
  { v:  5, color: '#F4B869' },
];

function pleasureToFill(p) {
  const clamped = Math.max(-5, Math.min(5, p));
  for (let i = 0; i < P_STOPS.length - 1; i++) {
    const a = P_STOPS[i], b = P_STOPS[i + 1];
    if (clamped <= b.v) return lerpHex(a.color, b.color, (clamped - a.v) / (b.v - a.v));
  }
  return P_STOPS[P_STOPS.length - 1].color;
}

function buildBlobPath(cx, cy, outerR, arousal) {
  const n = 12;
  const t = (Math.max(-5, Math.min(5, arousal)) + 5) / 10;
  const innerR = outerR * (0.85 - 0.50 * t);
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

function dominanceStrokeWidth(d) {
  return ((Math.max(-5, Math.min(5, d)) + 5) / 10) * 9 + 1;
}
function dominanceStrokeColor(d) {
  return lerpHex('#C8BFB0', '#2D2D2D', (Math.max(-5, Math.min(5, d)) + 5) / 10);
}

// ── MorphBlob ─────────────────────────────────────────────────────────────────

function MorphBlob({ pleasure = 0, arousal = 0, dominance = 0, size = 120 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <path
        d={buildBlobPath(cx, cy, r, arousal)}
        fill={pleasureToFill(pleasure)}
        fillOpacity={0.88}
        stroke={dominanceStrokeColor(dominance)}
        strokeWidth={dominanceStrokeWidth(dominance)}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

// ── AffectSlider ──────────────────────────────────────────────────────────────

function AffectSlider({ label, value, onChange, leftLabel, rightLabel, accentColor }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[12px] font-[600] text-ink">{label}</span>
        <span className="min-w-[30px] rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-center text-[11px] font-[700] text-ink">
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range" min="-5" max="5" step="1" value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor }}
      />
      <div className="flex justify-between">
        <span className="text-[10px] text-ink-mute">{leftLabel}</span>
        <span className="text-[10px] text-ink-mute">{rightLabel}</span>
      </div>
    </div>
  );
}

// ── 3-D scene (R3F) ───────────────────────────────────────────────────────────

const AXIS_LEN = 5.5;

function Scene3D({ entries }) {
  const pts = entries.map((e) => [
    Number(e.pleasureScore),
    Number(e.arousalScore),
    Number(e.dominanceScore),
  ]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <OrbitControls enablePan={false} minDistance={6} maxDistance={24} />

      {/* Axis lines */}
      <Line points={[[-AXIS_LEN, 0, 0], [AXIS_LEN, 0, 0]]} color="#C85A54" lineWidth={1.5} />
      <Line points={[[0, -AXIS_LEN, 0], [0, AXIS_LEN, 0]]} color="#8FBC8F" lineWidth={1.5} />
      <Line points={[[0, 0, -AXIS_LEN], [0, 0, AXIS_LEN]]} color="#7DBFCC" lineWidth={1.5} />

      {/* Axis labels */}
      <Text position={[AXIS_LEN + 0.7, 0, 0]} fontSize={0.52} color="#C85A54" anchorX="center" anchorY="middle">Pleasure</Text>
      <Text position={[0, AXIS_LEN + 0.7, 0]} fontSize={0.52} color="#6B9B6B" anchorX="center" anchorY="middle">Arousal</Text>
      <Text position={[0, 0, AXIS_LEN + 0.7]} fontSize={0.52} color="#7DBFCC" anchorX="center" anchorY="middle">Dominance</Text>

      {/* Trajectory */}
      {pts.length > 1 && (
        <Line points={pts} color="#B8A888" lineWidth={1.2} />
      )}

      {/* Data spheres */}
      {entries.map((e, i) => (
        <mesh key={i} position={[Number(e.pleasureScore), Number(e.arousalScore), Number(e.dominanceScore)]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={pleasureToFill(e.pleasureScore)} roughness={0.35} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

// ── Animation variants ────────────────────────────────────────────────────────

const pageVar = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const sectionVar = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
};

// ── Default form state ────────────────────────────────────────────────────────

const getLocalNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const getEmptyForm = () => ({ pleasure: 0, arousal: 0, dominance: 0, recordedAt: getLocalNow(), note: '', tags: '' });

// ── Main export ───────────────────────────────────────────────────────────────

export default function AffectView() {
  const [form, setForm]                     = useState(getEmptyForm);
  const [saving, setSaving]                 = useState(false);
  const [saveErr, setSaveErr]               = useState('');
  const [refreshKey, setRefreshKey]         = useState(0);

  const [todayEntries, setTodayEntries]     = useState([]);
  const [summary, setSummary]               = useState(null);
  const [loadingToday, setLoadingToday]     = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Дата для перегляду історії (за замовчуванням - сьогодні)
  const [viewDate, setViewDate] = useState(new Date());

  // Функції для гортання днів
  const handlePrevDay = () => setViewDate(d => new Date(d.setDate(d.getDate() - 1)));
  const handleNextDay = () => setViewDate(d => new Date(d.setDate(d.getDate() + 1)));
  
  // Перевірка, чи це сьогодні (щоб не гортати в майбутнє)
  const isToday = viewDate.toDateString() === new Date().toDateString();

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    setLoadingToday(true);
    setLoadingSummary(true);

    // Форматуємо дату для бекенду у "YYYY-MM-DD"
    const dateStr = viewDate.toISOString().split('T')[0];

    Promise.all([
      fetchDailyAffect(dateStr),
      fetchAffectSummary(dateStr)
    ])
      .then(([logs, sum]) => {
        setTodayEntries(logs || []);
        setSummary(sum || null);
      })
      .catch(console.error)
      .finally(() => {
        setLoadingToday(false);
        setLoadingSummary(false);
      });
  }, [refreshKey, viewDate]); // Додали viewDate в залежності!

  const handleLog = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      await api.post(endpoints.affect.log, {
        pleasureScore:  form.pleasure,
        arousalScore:   form.arousal,
        dominanceScore: form.dominance,
        ...(form.recordedAt && { recordedAt: new Date(form.recordedAt).toISOString() }),
        ...(form.note.trim() && { note: form.note.trim() }),
        ...(form.tags.trim() && {
          contextTags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      setForm(getEmptyForm());
      setRefreshKey((k) => k + 1);
    } catch {
      setSaveErr('Could not log mood. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasSummary = summary && (summary.entryCount == null || summary.entryCount > 0);

  return (
    <div className="space-y-4">

        {/* ── Page header ── */}
        <motion.div variants={sectionVar} className="mb-1">
          <h1 className="font-serif text-[24px] font-[600] text-ink">Mood Journal</h1>
          <p className="text-[12px] text-ink-mute">Circumplex model · Pleasure · Arousal · Dominance</p>
        </motion.div>

        {/* ── Input card ── */}
        <motion.section
          variants={sectionVar}
          className="mb-4 rounded-3xl border border-ink/[0.07] bg-white/60 p-4"
          style={{ boxShadow: '0 2px 20px -4px rgba(45,45,45,0.06)' }}
        >
          <h2 className="mb-3 font-serif text-[15px] font-[600] text-ink">How do you feel right now?</h2>

          <div className="flex items-start gap-4">
            {/* Morphing blob */}
            <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
              <MorphBlob
                pleasure={form.pleasure}
                arousal={form.arousal}
                dominance={form.dominance}
                size={96}
              />
              <span className="text-[9px] font-[600] uppercase tracking-widest text-ink-mute/60">PAD</span>
            </div>

            {/* Sliders */}
            <div className="flex flex-1 flex-col gap-3">
              <AffectSlider
                label="Pleasure" value={form.pleasure} onChange={set('pleasure')}
                leftLabel="Unpleasant" rightLabel="Pleasant" accentColor="#C85A54"
              />
              <AffectSlider
                label="Arousal" value={form.arousal} onChange={set('arousal')}
                leftLabel="Calm" rightLabel="Excited" accentColor="#6B9B6B"
              />
              <AffectSlider
                label="Dominance" value={form.dominance} onChange={set('dominance')}
                leftLabel="Submissive" rightLabel="In control" accentColor="#7DBFCC"
              />
            </div>
          </div>

          {/* Extra fields */}
          <div className="mt-4 space-y-2.5">
            <div>
              <label className="mb-1 block text-[10px] font-[600] uppercase tracking-widest text-ink-mute">When</label>
              <input
                type="datetime-local"
                value={form.recordedAt}
                onChange={(e) => set('recordedAt')(e.target.value)}
                className="w-full rounded-xl border border-ink/[0.09] bg-white/70 px-3 py-2 text-[13px] text-ink outline-none focus:border-jade/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-[600] uppercase tracking-widest text-ink-mute">Note</label>
              <textarea
                rows={2}
                value={form.note}
                onChange={(e) => set('note')(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full resize-none rounded-xl border border-ink/[0.09] bg-white/70 px-3 py-2 text-[13px] text-ink outline-none focus:border-jade/60 placeholder:text-ink-mute/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-[600] uppercase tracking-widest text-ink-mute">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set('tags')(e.target.value)}
                placeholder="work, exercise, social…"
                className="w-full rounded-xl border border-ink/[0.09] bg-white/70 px-3 py-2 text-[13px] text-ink outline-none focus:border-jade/60 placeholder:text-ink-mute/40"
              />
            </div>
          </div>

          {saveErr && <p className="mt-2 text-[12px] text-garnet">{saveErr}</p>}

          <motion.button
            type="button"
            onClick={handleLog}
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            className="mt-4 w-full rounded-2xl py-3.5 text-[14px] font-[600] text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #8FBC8F 0%, #6B9B6B 100%)',
              boxShadow: '0 4px 20px -4px rgba(107,155,107,0.45)',
            }}
          >
            {saving ? 'Logging…' : 'Log Mood'}
          </motion.button>
        </motion.section>

        {/* ── 3D scatter plot ── */}
        <motion.section
          variants={sectionVar}
          className="mb-4 rounded-3xl border border-ink/[0.07] bg-white/60 p-4"
          style={{ boxShadow: '0 2px 20px -4px rgba(45,45,45,0.06)' }}
        >
          <div className="mb-4 flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
                Mood Timeline
              </span>
              <span className="text-[14px] font-medium text-[#364153]">
                {viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            
            {/* Кнопки перемикання днів */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevDay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-[#4A5565] shadow-sm outline outline-1 outline-[#E5E7EB] hover:bg-[#8FBC8F]/20 transition-all active:scale-90"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button 
                onClick={handleNextDay}
                disabled={isToday}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/60 shadow-sm outline outline-1 outline-[#E5E7EB] transition-all ${isToday ? 'opacity-30 cursor-not-allowed text-[#99A1AF]' : 'text-[#4A5565] hover:bg-[#8FBC8F]/20 active:scale-90'}`}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <p className="mb-3 px-2 text-[11px] text-ink-mute">
            <span className="font-[600]" style={{ color: '#F87171' }}>X</span> Pleasure ·{' '}
            <span className="font-[600] text-[#34D399]">Y</span> Arousal ·{' '}
            <span className="font-[600]" style={{ color: '#60A5FA' }}>Z</span> Dominance
            {' '}· drag to rotate
          </p>

          {loadingToday ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-jade border-t-transparent" />
            </div>
          ) : (
            <div className="h-[300px] w-full bg-white/60 rounded-[14px] outline outline-[1.5px] outline-[#E5E7EB] overflow-hidden">
              {todayEntries && todayEntries.length > 0 ? (
                <Canvas camera={{ position: [8, 6, 8], fov: 50 }}>
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[10, 10, 10]} intensity={1} />
                  <OrbitControls makeDefault />

                  {/* Осі координат з підписами */}
                  {/* Pleasure (Задоволення) - Червона вісь X */}
                  <Line points={[[-5, 0, 0], [5, 0, 0]]} color="#F87171" lineWidth={1} opacity={0.3} transparent />
                  <Text position={[6, 0, 0]} fontSize={0.4} color="#F87171" anchorX="center" anchorY="middle">Pleasure (+)</Text>
                  <Text position={[-6, 0, 0]} fontSize={0.4} color="#F87171" anchorX="center" anchorY="middle">Pleasure (-)</Text>

                  {/* Arousal (Збудження) - Зелена вісь Y */}
                  <Line points={[[0, -5, 0], [0, 5, 0]]} color="#34D399" lineWidth={1} opacity={0.3} transparent />
                  <Text position={[0, 6, 0]} fontSize={0.4} color="#34D399" anchorX="center" anchorY="middle">Arousal (+)</Text>
                  <Text position={[0, -6, 0]} fontSize={0.4} color="#34D399" anchorX="center" anchorY="middle">Arousal (-)</Text>

                  {/* Dominance (Домінування) - Синя вісь Z */}
                  <Line points={[[0, 0, -5], [0, 0, 5]]} color="#60A5FA" lineWidth={1} opacity={0.3} transparent />
                  <Text position={[0, 0, 6]} fontSize={0.4} color="#60A5FA" anchorX="center" anchorY="middle">Dominance (+)</Text>
                  <Text position={[0, 0, -6]} fontSize={0.4} color="#60A5FA" anchorX="center" anchorY="middle">Dominance (-)</Text>

                  {/* Допоміжна сітка на дні */}
                  <gridHelper args={[10, 10, '#E5E7EB', '#F3F4F6']} position={[0, -5, 0]} />

                  {/* Траєкторія (Лінія, що з'єднує точки) */}
                  <Line 
                    points={todayEntries.map(e => [e.pleasureScore, e.arousalScore, e.dominanceScore])} 
                    color="#8FBC8F" 
                    lineWidth={3} 
                  />

                  {/* Самі точки настрою */}
                  {todayEntries.map((entry, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === todayEntries.length - 1;
                    const pos = [entry.pleasureScore, entry.arousalScore, entry.dominanceScore];
                    
                    // Дістаємо час запису (наприклад, "14:30")
                    const timeStr = new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <group key={entry.id || idx} position={pos}>
                        <mesh>
                          <sphereGeometry args={[isLast ? 0.35 : 0.2, 16, 16]} />
                          <meshStandardMaterial color={isLast ? '#E8B4B4' : (isFirst ? '#7AB8CC' : '#4A5565')} />
                        </mesh>
                        {/* Підписуємо реальний час замість "Start" та "Now" */}
                        {isFirst && <Text position={[0, -0.6, 0]} fontSize={0.35} color="#7AB8CC">{timeStr}</Text>}
                        {isLast && !isFirst && <Text position={[0, 0.7, 0]} fontSize={0.4} color="#E8B4B4" outlineWidth={0.02} outlineColor="#fff">{timeStr}</Text>}
                      </group>
                    );
                  })}
                </Canvas>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="text-4xl opacity-50">🌫️</span>
                  <p className="text-[13px] text-ink-mute">No logs yet — add your first mood above.</p>
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* ── Summary card ── */}
        <motion.section
          variants={sectionVar}
        >
          {loadingSummary ? (
            <div className="flex h-[72px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-jade border-t-transparent" />
            </div>
          ) : (
            <div className="mt-8 mb-4 flex flex-col gap-4 bg-gradient-to-br from-[#E8B4B4]/10 to-[#8FBC8F]/10 p-5 rounded-[14px] outline outline-[1.5px] outline-[#E8B4B4]/30">
              <div className="flex items-center justify-between">
                
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-[600] uppercase tracking-[1.2px] text-[#6A7282]">
                    Today's Average Mood
                  </span>
                  
                  {/* Виведення оригінального значення Pleasure (від -5 до 5) */}
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[32px] font-bold leading-none text-[#E8B4B4]">
                      {summary && summary.p_centroid !== undefined 
                        ? (summary.p_centroid > 0 ? '+' : '') + Number(summary.p_centroid).toFixed(1) 
                        : '0.0'}
                    </span>
                    <span className="text-[14px] text-[#6A7282] mb-1">/ P-Score</span>
                  </div>

                  {/* Сирі дані PAD із захистом від NaN */}
                  <div className="text-[10px] text-[#99A1AF] mt-1 font-medium tracking-wide">
                    PAD: {Number(summary?.p_centroid || 0).toFixed(1)} | {Number(summary?.a_centroid || 0).toFixed(1)} | {Number(summary?.d_centroid || 0).toFixed(1)}
                  </div>
                </div>

                {/* Динамічна фігура середнього настрою */}
                <div className="flex h-16 w-16 items-center justify-center drop-shadow-md">
                  {summary ? (
                    <MorphBlob 
                      pleasure={Number(summary.p_centroid || 0)} 
                      arousal={Number(summary.a_centroid || 0)} 
                      dominance={Number(summary.d_centroid || 0)} 
                      size={70} 
                    />
                  ) : (
                    <span className="text-3xl opacity-50">😶</span>
                  )}
                </div>
                
              </div>

              <div className="border-t border-[#E8B4B4]/20 pt-4 mt-1">
                <p className="text-[12px] leading-relaxed text-[#364153]">
                  <span className="font-semibold text-[#E8B4B4]">Insight:</span> Your dominant emotion today is 
                  {Number(summary?.p_centroid || 0) > 1 ? " positive and uplifting. " : Number(summary?.p_centroid || 0) < -1 ? " leaning towards challenging. " : " calm and neutral. "}
                  Keep tracking to see how your habits affect your daily balance!
                </p>
              </div>
            </div>
          )}
        </motion.section>

    </div>
  );
}
