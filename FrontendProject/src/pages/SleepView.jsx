import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client.js';
import { endpoints } from '../api/endpoints.js';

// Перетворює UTC дату з бекенду у локальний рядок для інпуту без зсуву
const formatToLocalInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // Використовуємо трюк із вирахуванням зміщення, щоб отримати "чистий" локальний час
  const offset = d.getTimezoneOffset() * 60000;
  const localIso = new Date(d.getTime() - offset).toISOString();
  return localIso.substring(0, 16); // повертає "YYYY-MM-DDTHH:mm"
};

// ── Math / time helpers ───────────────────────────────────────────────────────

const CHART_START_H = 18; // Y-axis top = 18:00

function minutesToChartY(mins) {
  return ((mins - CHART_START_H * 60 + 1440) % 1440) / 1440;
}

function isoToLocalMins(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function timeStrToMins(str) {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sx2 += xs[i] * xs[i]; }
  const d = n * sx2 - sx * sx;
  if (Math.abs(d) < 1e-10) return null;
  const m = (n * sxy - sx * sy) / d;
  const b = (sy - m * sx) / n;
  return (x) => m * x + b;
}

function fmtMins(mins) {
  const safe = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60), min = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Date / period helpers ─────────────────────────────────────────────────────

function localDateKey(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function localMonthKey(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function getWindowDates(period, anchor) {
  const a = new Date(anchor);
  if (period === 'Week') {
    const mon = new Date(a);
    mon.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  }
  if (period === 'Month') {
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const days = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => { const d = new Date(first); d.setDate(i + 1); return d; });
  }
  if (period === '6 Months') {
    const startMonth = a.getMonth() < 6 ? 0 : 6;
    return Array.from({ length: 6 }, (_, i) => new Date(a.getFullYear(), startMonth + i, 1));
  }
  return Array.from({ length: 12 }, (_, m) => new Date(a.getFullYear(), m, 1));
}

function navigatePeriod(period, anchor, dir) {
  const d = new Date(anchor);
  if (period === 'Week') d.setDate(d.getDate() + 7 * dir);
  else if (period === 'Month') d.setMonth(d.getMonth() + dir);
  else if (period === '6 Months') d.setMonth(d.getMonth() + 6 * dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

function dateRangeLabel(period, dates) {
  if (!dates.length) return '';
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (period === 'Week') return `${fmt(dates[0])} – ${fmt(dates[6])}`;
  if (period === 'Month') return dates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (period === '6 Months') return `${dates[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${dates[dates.length - 1].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  return String(dates[0].getFullYear());
}

function colLabel(period, date, idx) {
  if (period === 'Week') return date.toLocaleDateString('en-US', { weekday: 'short' });
  if (period === 'Month') {
    const n = date.getDate();
    return (n === 1 || n % 5 === 0) ? String(n) : '';
  }
  return date.toLocaleDateString('en-US', { month: 'short' });
}

// ── Default form times ────────────────────────────────────────────────────────

function getDefaultTimes() {
  const toLocal = (d) => { const c = new Date(d); c.setMinutes(c.getMinutes() - c.getTimezoneOffset()); return c.toISOString().slice(0, 16); };
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(22, 30, 0, 0);
  const morning = new Date(); morning.setHours(6, 30, 0, 0);
  return { sleepStart: toLocal(yesterday), sleepEnd: toLocal(morning) };
}

// ── Y-axis ticks ──────────────────────────────────────────────────────────────

const Y_TICKS = [
  { label: '20:00', mins: 20 * 60 },
  { label: '00:00', mins: 0 },
  { label: '04:00', mins: 4 * 60 },
  { label: '08:00', mins: 8 * 60 },
];

// ── QualityGrid ───────────────────────────────────────────────────────────────

const CORNER_STYLE = (pos) => ({
  position: 'absolute',
  width: 8, height: 8,
  ...(pos.t != null ? { top: pos.t } : { bottom: pos.b }),
  ...(pos.l != null ? { left: pos.l } : { right: pos.r }),
  borderTopLeftRadius:     (pos.t != null && pos.l != null) ? 6 : 0,
  borderTopRightRadius:    (pos.t != null && pos.r != null) ? 6 : 0,
  borderBottomLeftRadius:  (pos.b != null && pos.l != null) ? 6 : 0,
  borderBottomRightRadius: (pos.b != null && pos.r != null) ? 6 : 0,
  borderLeft:   (pos.l != null) ? '1.54px rgba(153,161,175,0.40) solid' : 'none',
  borderRight:  (pos.r != null) ? '1.54px rgba(153,161,175,0.40) solid' : 'none',
  borderTop:    (pos.t != null) ? '1.54px rgba(153,161,175,0.40) solid' : 'none',
  borderBottom: (pos.b != null) ? '1.54px rgba(153,161,175,0.40) solid' : 'none',
});

const CORNERS = [{ t: 3.5, l: 3.5 }, { t: 3.5, r: 3.5 }, { b: 3.5, l: 3.5 }, { b: 3.5, r: 3.5 }];

function QualityGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-[7px]">
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const sel = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(sel ? null : n)}
            className="relative aspect-square rounded-[10px] flex items-center justify-center transition-all active:scale-95"
            style={{
              background: sel ? 'rgba(91,127,166,0.10)' : 'rgba(255,255,255,0.70)',
              outline: sel ? '1.54px #5B7FA6 solid' : '1.54px rgba(209,213,220,0.60) solid',
              outlineOffset: '-1.54px',
              boxShadow: sel ? '0 2px 4px -2px rgba(0,0,0,0.10), 0 4px 6px -1px rgba(0,0,0,0.10)' : 'none',
            }}
          >
            {CORNERS.map((pos, ci) => <span key={ci} style={CORNER_STYLE(pos)} />)}
            <span
              className="text-[18px] leading-7"
              style={{ color: sel ? '#5B7FA6' : '#4A5565', fontWeight: sel ? 500 : 300 }}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── FloatingBarChart ──────────────────────────────────────────────────────────

const CHART_H = 248;

function getColData(period, date, grouped) {
  if (period === 'Year' || period === '6 Months') {
    const logs = grouped[localMonthKey(date)];
    if (!logs?.length) return null;
    const avg = (fn) => logs.reduce((s, l) => s + fn(l), 0) / logs.length;
    return {
      startY: avg(l => minutesToChartY(isoToLocalMins(l.sleepStart))),
      endY:   avg(l => minutesToChartY(isoToLocalMins(l.sleepEnd))),
      count: logs.length,
    };
  }
  const log = grouped[localDateKey(date)];
  if (!log) return null;
  return {
    startY: minutesToChartY(isoToLocalMins(log.sleepStart)),
    endY:   minutesToChartY(isoToLocalMins(log.sleepEnd)),
    count: 1,
  };
}

function FloatingBarChart({ dates, period, grouped, profile }) {
  const numCols = dates.length;

  const rec = useMemo(() => {
    if (!profile) return null;
    const wake = timeStrToMins(profile.targetWakeTime || profile.TargetWakeTime || '06:30');
    const base = (profile.baseSleepHours ?? profile.BaseSleepHours ?? 8) * 60;
    const bed = ((wake - base) + 1440) % 1440;
    return { top: minutesToChartY(bed), bot: minutesToChartY(wake) };
  }, [profile]);

  const { startReg, endReg } = useMemo(() => {
    const xs = [], ys = [], ye = [];
    dates.forEach((d, i) => {
      const col = getColData(period, d, grouped);
      if (!col) return;
      xs.push(i); ys.push(col.startY); ye.push(col.endY);
    });
    return { startReg: linearRegression(xs, ys), endReg: linearRegression(xs, ye) };
  }, [dates, period, grouped]);

  const insight = useMemo(() => {
    if (!startReg && !endReg) return null;
    const parts = [];
    if (startReg) {
      const s = startReg(1) - startReg(0);
      parts.push(s < -0.005 ? 'Your bedtime is trending earlier' : s > 0.005 ? 'Your bedtime is getting later' : 'Your bedtime is consistent');
    }
    if (endReg) {
      const s = endReg(1) - endReg(0);
      parts.push(s < -0.005 ? 'wake time is trending earlier' : s > 0.005 ? 'wake time is getting later' : 'wake time is consistent');
    }
    return parts.join('; ') + '.';
  }, [startReg, endReg]);

  const suggestedBed = profile ? fmtMins(((timeStrToMins(profile.targetWakeTime || profile.TargetWakeTime || '06:30') - (profile.baseSleepHours ?? profile.BaseSleepHours ?? 8) * 60) + 1440) % 1440) : null;

  return (
    <div>
      {/* Chart grid + bars */}
      <div className="flex" style={{ height: CHART_H + 20 }}>
        {/* Y-axis */}
        <div className="relative w-[38px] shrink-0" style={{ height: CHART_H }}>
          {Y_TICKS.map(tk => (
            <span
              key={tk.label}
              className="absolute right-1 translate-y-[-50%] text-right text-[8.5px] text-[#6B7280] leading-none"
              style={{ top: `${minutesToChartY(tk.mins) * 100}%` }}
            >
              {tk.label}
            </span>
          ))}
        </div>

        {/* Chart body */}
        <div className="relative flex-1 overflow-visible" style={{ height: CHART_H }}>
          {/* Horizontal grid lines */}
          {Y_TICKS.map(tk => (
            <div
              key={tk.label}
              className="absolute left-0 right-0"
              style={{ top: `${minutesToChartY(tk.mins) * 100}%`, borderTop: '1px dashed rgba(107,114,128,0.18)' }}
            />
          ))}

          {/* Columns */}
          <div className="absolute inset-0 flex">
            {dates.map((date, idx) => {
              const col = getColData(period, date, grouped);
              const lbl = colLabel(period, date, idx);
              return (
                <div key={idx} className="relative flex-1">
                  {/* Recommended bar */}
                  {rec && (
                    <div
                      className="absolute inset-x-[2px] rounded-[2px]"
                      style={{
                        top: `${rec.top * 100}%`,
                        height: `${(rec.bot - rec.top) * 100}%`,
                        background: 'rgba(91,127,166,0.08)',
                        outline: '1.5px #5B7FA6 solid',
                        outlineOffset: '-0.75px',
                      }}
                    />
                  )}
                  {/* Actual sleep bar */}
                  {col && (
                    <div
                      className="absolute inset-x-[2px] rounded-[2px]"
                      style={{
                        top: `${col.startY * 100}%`,
                        height: `${(col.endY - col.startY) * 100}%`,
                        background: '#475569',
                        outline: '0.75px #334155 solid',
                        outlineOffset: '-0.38px',
                      }}
                    />
                  )}
                  {/* Day label */}
                  {lbl && (
                    <span
                      className="absolute inset-x-0 text-center text-[9px] text-[#6B7280]"
                      style={{ bottom: -18 }}
                    >
                      {lbl}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* SVG trend line overlay */}
          {(startReg || endReg) && (
            <svg
              className="pointer-events-none absolute inset-0"
              width="100%" height="100%"
              viewBox={`0 0 ${numCols} 1`}
              preserveAspectRatio="none"
              overflow="visible"
            >
              {startReg && (
                <line
                  x1={0.5}         y1={Math.min(1, Math.max(0, startReg(0)))}
                  x2={numCols - 0.5} y2={Math.min(1, Math.max(0, startReg(numCols - 1)))}
                  stroke="#F59E0B" strokeWidth="2" vectorEffect="non-scaling-stroke"
                />
              )}
              {endReg && (
                <line
                  x1={0.5}         y1={Math.min(1, Math.max(0, endReg(0)))}
                  x2={numCols - 0.5} y2={Math.min(1, Math.max(0, endReg(numCols - 1)))}
                  stroke="#10B981" strokeWidth="2" vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-start justify-around">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-9 w-9 rounded-lg bg-[#475569]" style={{ outline: '0.5px #334155 solid' }} />
          <p className="text-center text-[9px] font-[500] leading-tight text-[#4A5565]">Solid Bar =<br />Actual Sleep</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-9 w-9 rounded-lg" style={{ background: 'rgba(91,127,166,0.08)', outline: '2px #5B7FA6 solid' }} />
          <p className="text-center text-[9px] font-[500] leading-tight text-[#4A5565]">Dashed Bar =<br />Recommended</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-col gap-1 py-1">
            <div className="h-1 w-9 rounded-full bg-[#F59E0B]" />
            <div className="h-1 w-9 rounded-full bg-[#10B981]" />
          </div>
          <p className="text-center text-[9px] font-[500] leading-tight text-[#4A5565]">Lines = Schedule<br />Approximation</p>
        </div>
      </div>

      {/* Insight */}
      {(insight || suggestedBed) && (
        <div
          className="mt-4 rounded-[10px] p-4"
          style={{ background: 'rgba(122,184,204,0.05)', outline: '0.5px rgba(122,184,204,0.20) solid', outlineOffset: '-0.5px' }}
        >
          <p className="text-[12px] leading-relaxed text-[#364153]">
            <span className="font-[600] text-[#5B7FA6]">💡 Insight: </span>
            {insight}
            {suggestedBed && (
              <> Try sleeping at <strong>{suggestedBed}</strong> for {profile?.baseSleepHours ?? profile?.BaseSleepHours ?? 8} hours.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Animation variants ────────────────────────────────────────────────────────

const sectionVar = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
};

// ── Main export ───────────────────────────────────────────────────────────────

const PERIODS = ['Week', 'Month', '6 Months', 'Year'];

export default function SleepView() {
  const defs = getDefaultTimes();
  const [sleepStart, setSleepStart] = useState(defs.sleepStart);
  const [sleepEnd,   setSleepEnd]   = useState(defs.sleepEnd);
  const [quality,    setQuality]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState('');

  const [period,  setPeriod]  = useState('Week');
  const [anchor,  setAnchor]  = useState(new Date());
  const [logs,    setLogs]    = useState([]);
  const [sleepPlan, setSleepPlan] = useState(null); // Новий стейт для JSON плану
  const [loadingChart, setLoadingChart] = useState(true);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [selectedLog,  setSelectedLog]  = useState(null);
  const [editingLog,   setEditingLog]   = useState(null); // Для режиму редагування
  const [profile,      setProfile]      = useState(null); // Дані алгоритму

  const [showSetup, setShowSetup] = useState(false); // Стейт для модалки налаштувань
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [setupData, setSetupData] = useState({
    targetWakeTime: '07:00',
    baseSleepHours: 8,
    absoluteMinSleepHours: 6,
    shiftStepMinutes: 15,
    weekendDeviationHours: 1.5
  });

  const handleEdit = (log) => {
    if (!log) return;
    setEditingLog(log); // Включаємо режим редагування
    // Форматуємо для datetime-local (YYYY-MM-DDThh:mm)
    setSleepStart(formatToLocalInput(log.sleepStart));
    setSleepEnd(formatToLocalInput(log.sleepEnd));
    setQuality(log.sleepQuality || 5);
    
    // Плавний скрол до форми зверху
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedLog(null); // Закриваємо тултіп
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this sleep log?")) return;
    try {
      await api.delete(`/api/sleep/${id}`);
      setRefreshKey(prev => prev + 1); // Оновлюємо дані
      setSelectedLog(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete log.");
    }
  };

  const dates = useMemo(() => getWindowDates(period, anchor), [period, anchor]);

  const fromStr = useMemo(() => localDateKey(dates[0]), [dates]);
  // For '6 Months' / 'Year' the dates[] array holds the 1st of each month.
  // We must request data through the LAST day of that month, otherwise the
  // API call cuts off at the 1st and the remaining days are never fetched.
  const toStr = useMemo(() => {
    const last = dates[dates.length - 1];
    if (period === '6 Months' || period === 'Year') {
      // last day of that month
      const lastDay = new Date(last.getFullYear(), last.getMonth() + 1, 0);
      return localDateKey(lastDay);
    }
    return localDateKey(last);
  }, [dates, period]);

  // ФІКС ПОНЕДІЛКА: Зміщуємо дату запиту на 1 день назад (на Неділю), 
  // щоб гарантовано отримати сон, який почався в неділю, а закінчився в понеділок
  const fetchFromStr = useMemo(() => {
    if (!dates || dates.length === 0) return fromStr;
    const d = new Date(dates[0]);
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
  }, [dates, fromStr]);

  // Group logs for chart lookup
  const grouped = useMemo(() => {
    if (period === 'Year' || period === '6 Months') {
      return logs.reduce((acc, l) => {
        const k = localMonthKey(new Date(l.sleepStart));
        (acc[k] = acc[k] || []).push(l);
        return acc;
      }, {});
    }
    return logs.reduce((acc, l) => {
      acc[localDateKey(new Date(l.sleepStart))] = l;
      return acc;
    }, {});
  }, [logs, period]);

  const avgQuality = useMemo(() => {
    if (!logs || logs.length === 0) return 0;
    const ratedLogs = logs.filter(l => l.sleepQuality > 0);
    if (ratedLogs.length === 0) return 0;
    const sum = ratedLogs.reduce((acc, log) => acc + log.sleepQuality, 0);
    return (sum / ratedLogs.length).toFixed(1);
  }, [logs]);

  const avgDuration = useMemo(() => {
    if (!logs || logs.length === 0) return 0;
    const sum = logs.reduce((acc, l) => {
      const dur = (new Date(l.sleepEnd) - new Date(l.sleepStart)) / 3600000;
      return acc + dur;
    }, 0);
    return (sum / logs.length).toFixed(1);
  }, [logs]);

  const efficiency = useMemo(() => {
    if (!logs || logs.length === 0) return 0;
    // Розрахунок ефективності: наскільки середня тривалість близька до ідеалу (8 год)
    const target = 8; 
    const score = (parseFloat(avgDuration) / target) * 100;
    return Math.min(100, Math.round(score));
  }, [logs, avgDuration]);

  const suggestedBedtime = useMemo(() => {
    if (!sleepPlan || !sleepPlan.days) return null;
    const todayStr = new Date().toDateString();
    const plan = sleepPlan.days.find(d => new Date(d.date).toDateString() === todayStr);
    if (!plan) return null;

    const [h, m] = plan.plannedWake.split(':').map(Number);
    const wakeMins = h * 60 + m;
    const bedMins = (wakeMins - plan.plannedSleepHours * 60 + 1440) % 1440;

    const bh = Math.floor(bedMins / 60);
    const bm = bedMins % 60;
    return `${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`;
  }, [sleepPlan]);

  // Fetch logs and sleep plan when window changes
  useEffect(() => {
    setLoadingChart(true);

    const fetchOrGeneratePlan = async () => {
      try {
        const res = await api.get('/api/sleep/recommendations/latest');
        return res.data;
      } catch (err) {
        if (err.response?.status === 404) {
          console.log("No sleep plan found. Generating a new one...");
          try {
            // Викликаємо POST генерацію
            const genRes = await api.post('/api/sleep/recommendations/generate');
            return genRes.data; // Повертаємо щойно згенерований JSON
          } catch (genErr) {
            console.error("Failed to generate sleep plan:", genErr);
            return null;
          }
        }
        return null;
      }
    };

    Promise.all([
      api.get(`${endpoints.sleep.list}?from=${fetchFromStr}&to=${toStr}`).then(r => r.data).catch(() => []),
      fetchOrGeneratePlan(),
      api.get('/api/sleep/profile').then(r => r.data).catch(() => null)
    ]).then(([fetchedLogs, fetchedPlan, fetchedProfile]) => {
      setLogs(fetchedLogs);
      setSleepPlan(fetchedPlan);
      
      if (!fetchedProfile || !fetchedProfile.id) {
        // Якщо профілю немає в БД — показуємо Onboarding
        setShowSetup(true);
      } else {
        setProfile(fetchedProfile);
        // Заповнюємо форму існуючими даними (якщо юзер захоче відредагувати)
        setSetupData({
          targetWakeTime: fetchedProfile.targetWakeTime.substring(0, 5), // Беремо "HH:mm" з "HH:mm:ss"
          baseSleepHours: fetchedProfile.baseSleepHours,
          absoluteMinSleepHours: fetchedProfile.absoluteMinSleepHours,
          shiftStepMinutes: fetchedProfile.shiftStepMinutes,
          weekendDeviationHours: fetchedProfile.weekendDeviationHours
        });
      }
    }).finally(() => setLoadingChart(false));
  }, [fetchFromStr, toStr, refreshKey]);

  const isCurrentPeriod = () => {
    const today = new Date();
    if (period === 'Week') return dates[0] <= today && today <= dates[6];
    if (period === 'Month') return anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
    if (period === '6 Months') {
      const h1 = anchor.getMonth() < 6 ? 0 : 1;
      const h2 = today.getMonth() < 6 ? 0 : 1;
      return anchor.getFullYear() === today.getFullYear() && h1 === h2;
    }
    return anchor.getFullYear() === today.getFullYear();
  };

  const handleSubmit = async () => {
    if (!sleepStart || !sleepEnd) {
      alert("Please select both Bedtime and Wake up times.");
      return;
    }
    try {
      setSaving(true);
      setSaveErr('');
      
      const startDate = new Date(sleepStart);
      const endDate = new Date(sleepEnd);

      // Валідація на фронтенді
      if (endDate <= startDate) {
        alert("Wake up time must be strictly after bedtime!");
        setSaving(false);
        return;
      }

      const payload = {
        sleepStart: startDate.toISOString(),
        sleepEnd: endDate.toISOString(),
        ...(quality != null && { sleepQuality: Number(quality) }),
        tags: []
      };

      if (editingLog && editingLog.id) {
        // ОНОВЛЕННЯ (PUT)
        await api.put(`/api/sleep/logs/${editingLog.id}`, payload);
        alert('Sleep log updated!');
      } else {
        // СТВОРЕННЯ (POST)
        await api.post('/api/sleep/logs', payload);
        alert('Sleep logged successfully!');
      }
      
      const d = getDefaultTimes();
      setSleepStart(d.sleepStart); setSleepEnd(d.sleepEnd); setQuality(null);
      setEditingLog(null); // Виходимо з режиму редагування
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Payload error:", err.response?.data);
      setSaveErr('Failed to log sleep. See console for details.');
      alert('Failed to log sleep. See console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      
      const payload = {
        // Переконуємось, що час має формат HH:mm:ss
        targetWakeTime: setupData.targetWakeTime.length === 5 
          ? `${setupData.targetWakeTime}:00` 
          : setupData.targetWakeTime,
        // Примусово перетворюємо на числа
        baseSleepHours: Number(setupData.baseSleepHours),
        absoluteMinSleepHours: Number(setupData.absoluteMinSleepHours),
        shiftStepMinutes: parseInt(setupData.shiftStepMinutes),
        weekendDeviationHours: Number(setupData.weekendDeviationHours)
      };

      // 1. Зберігаємо профіль
      await api.put('/api/sleep/profile', payload);
      
      // 2. ВІДРАЗУ генеруємо перші рекомендації
      await api.post('/api/sleep/recommendations/generate');
      
      alert('Sleep profile initialized!');
      setShowSetup(false);
      
      // 3. Оновлюємо ключ, щоб useEffect завантажив нові дані
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Setup error details:", err.response?.data);
      alert(`Failed to initialize: ${err.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Summary Widgets ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/60 p-3 rounded-2xl border border-ink/5 flex flex-col items-center">
          <span className="text-[10px] text-[#6A7282] uppercase font-bold tracking-wider mb-1">Efficiency</span>
          <span className="text-[18px] font-bold text-[#5B7FA6]">{efficiency}%</span>
        </div>
        <div className="bg-white/60 p-3 rounded-2xl border border-ink/5 flex flex-col items-center">
          <span className="text-[10px] text-[#6A7282] uppercase font-bold tracking-wider mb-1">Avg Duration</span>
          <span className="text-[18px] font-bold text-[#4A5565]">{avgDuration}h</span>
        </div>
        <div className="bg-white/60 p-3 rounded-2xl border border-ink/5 flex flex-col items-center">
          <span className="text-[10px] text-[#6A7282] uppercase font-bold tracking-wider mb-1">Avg Quality</span>
          <span className="text-[18px] font-bold text-[#E8B4B4]">{avgQuality}/10</span>
        </div>
      </div>

      {suggestedBedtime && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[#5B7FA6]/5 border border-[#5B7FA6]/20 rounded-2xl flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-[#5B7FA6]/10 rounded-full flex items-center justify-center text-[#5B7FA6]">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707-.707" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-[#6A7282] font-medium uppercase tracking-wider">Tonight's Goal</p>
            <p className="text-[14px] text-[#1E2939]">
              To hit your <span className="font-bold text-[#5B7FA6]">{sleepPlan.days[0].plannedSleepHours}h</span> goal, try to be in bed by <span className="font-bold text-[#5B7FA6]">{suggestedBedtime}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Log Sleep Card ── */}
      <motion.section
        variants={sectionVar}
        className="rounded-[14px] bg-white/60"
        style={{ padding: '21.53px', outline: '1.54px rgba(229,231,235,0.50) solid', outlineOffset: '-1.54px' }}
      >
        {/* Bedtime / Wake up */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-[500] text-[#4A5565]">Bedtime</label>
            <input 
              type="datetime-local" 
              value={sleepStart} 
              onChange={(e) => setSleepStart(e.target.value)}
              className="w-full rounded-[10px] bg-white/70 px-2 py-3 text-[11px] sm:text-[13px] text-[#1E2939] outline outline-[1.5px] outline-[#D1D5DC]/50 focus:outline-[#5B7FA6]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-[500] text-[#4A5565]">Wake up</label>
            <input 
              type="datetime-local" 
              value={sleepEnd} 
              onChange={(e) => setSleepEnd(e.target.value)}
              className="w-full rounded-[10px] bg-white/70 px-2 py-3 text-[11px] sm:text-[13px] text-[#1E2939] outline outline-[1.5px] outline-[#D1D5DC]/50 focus:outline-[#5B7FA6]"
            />
          </div>
        </div>

        {/* Quality */}
        <p className="mb-2 text-[10px] font-[600] uppercase tracking-[1.2px] text-[#4A5565]">
          Sleep Quality (optional)
        </p>
        <QualityGrid value={quality} onChange={setQuality} />

        {saveErr && <p className="mt-2 text-[12px] text-garnet">{saveErr}</p>}

        <div className="flex gap-3">
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            className="mt-4 flex-1 rounded-[10px] py-3 text-[14px] font-[500] text-white disabled:opacity-60"
            style={{ background: '#4A5565', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }}
          >
            {saving ? 'Saving…' : (editingLog ? 'Update Log' : 'Mark Sleep')}
          </motion.button>

          {editingLog && (
            <motion.button
              type="button"
              onClick={() => {
                setEditingLog(null);
                const d = getDefaultTimes();
                setSleepStart(d.sleepStart); setSleepEnd(d.sleepEnd); setQuality(null);
              }}
              whileTap={{ scale: 0.97 }}
              className="mt-4 flex-1 rounded-[10px] py-3 text-[14px] font-[500] text-[#4A5565] outline outline-[1.5px] outline-[#D1D5DC]"
            >
              Cancel
            </motion.button>
          )}
        </div>
      </motion.section>

      {/* ── Chart Card ── */}
      <motion.section
        variants={sectionVar}
        className="rounded-[14px] bg-white/60"
        style={{ padding: '21.53px', outline: '1.54px rgba(229,231,235,0.50) solid', outlineOffset: '-1.54px' }}
      >
        {/* Period filter & Settings */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setPeriod(p); setAnchor(new Date()); }}
                className="rounded-[10px] px-3 py-[7px] text-[12px] font-[500] transition-all"
                style={period === p
                  ? { background: '#5B7FA6', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.10)', outline: '0.5px #5B7FA6 solid', outlineOffset: '-0.5px' }
                  : { background: 'rgba(255,255,255,0.70)', color: '#4A5565', outline: '0.5px rgba(209,213,220,0.50) solid', outlineOffset: '-0.5px' }
                }
              >
                {p}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowSetup(true)} 
            className="p-2 text-[#6A7282] hover:text-[#364153] transition-colors rounded-full hover:bg-black/5"
            title="Algorithm Settings"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Date navigator */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAnchor(a => navigatePeriod(period, a, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4A5565] transition-colors active:bg-ink/[0.06]"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[12px] font-[500] text-[#4A5565]">{dateRangeLabel(period, dates)}</span>
          <button
            type="button"
            disabled={anchor > new Date(new Date().setDate(new Date().getDate() + 14))}
            onClick={() => setAnchor(a => navigatePeriod(period, a, 1))}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${anchor > new Date(new Date().setDate(new Date().getDate() + 14)) ? 'cursor-default opacity-30' : 'text-[#4A5565] active:bg-ink/[0.06]'}`}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Chart or spinner */}
        {loadingChart ? (
          <div className="flex items-center justify-center h-48 mt-4 border-b border-[#D1D5DC]/50">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#5B7FA6] border-t-transparent" />
          </div>
        ) : (
          <div className="relative h-48 w-full mt-6 border-b border-[#D1D5DC]/50 mb-8">
            {/* Горизонтальні лінії сітки (18:00, 00:00, 04:00, 08:00) */}
            {[0, 25, 41.6, 58.3].map((percent, i) => (
              <div key={i} className="absolute w-full flex items-center" style={{ top: `${percent}%` }}>
                <span className="w-10 text-right text-[9px] text-[#6B7280] pr-2 -translate-y-1/2">
                  {percent === 0 ? '18:00' : percent === 25 ? '00:00' : percent === 41.6 ? '04:00' : '08:00'}
                </span>
                <div className="flex-1 border-t border-dashed border-[#D1D5DC]/60" />
              </div>
            ))}

            {/* Напис "No data", якщо немає ні логів, ні плану (не накладається на рекомендації) */}
            {(!logs?.length && !sleepPlan?.days?.length) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[12px] text-[#99A1AF] bg-rice/80 px-3 py-1 rounded-full">
                  No sleep data for this period
                </span>
              </div>
            )}

            {/* Рендер днів (Стовпці) */}
            <div className="absolute top-0 bottom-0 left-10 right-0 flex justify-between">
              {dates.map((date, i) => {
                // 1. Визначаємо дату стовпця (беремо з нашого масиву dates)
                const targetDate = new Date(date);
                targetDate.setHours(0, 0, 0, 0);
                const targetTime = targetDate.getTime();

                // ФІКС ПІВНОЧІ: isFutureOrToday тепер враховує весь поточний день до останньої секунди
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const isFutureOrToday = targetTime >= startOfToday.getTime();

                // 2. Пошук реального логу (за датою пробудження)
                const log = (logs || []).find(l => {
                   if (!l || !l.sleepEnd) return false;
                   const d = new Date(l.sleepEnd);
                   d.setHours(0, 0, 0, 0);
                   return d.getTime() === targetTime;
                });

                // 3. Пошук плану (Рекомендації)
                const dayPlan = (sleepPlan?.days || []).find(d => {
                   const pDate = new Date(d.date);
                   pDate.setHours(0, 0, 0, 0);
                   return pDate.getTime() === targetTime;
                });

                // Математика реального сну
                let barTop = 0, barHeight = 0;
                if (log && log.sleepStart && log.sleepEnd) {
                  const start = new Date(log.sleepStart);
                  const end = new Date(log.sleepEnd);
                  let startH = start.getHours() + start.getMinutes() / 60;
                  startH = startH >= 18 ? startH - 18 : startH + 6;
                  barTop = (startH / 24) * 100;
                  barHeight = ((end - start) / 3600000 / 24) * 100;
                }

                // Математика плану
                let recTop = 0, recHeight = 0;
                if (dayPlan) {
                  const [wakeH, wakeM] = dayPlan.plannedWake.split(':').map(Number);
                  let wakeOffset = wakeH >= 18 ? wakeH - 18 : wakeH + 6;
                  let wakePercent = (wakeOffset + (wakeM || 0) / 60) / 24 * 100;
                  recHeight = (dayPlan.plannedSleepHours / 24) * 100;
                  recTop = wakePercent - recHeight;
                }

                const isSelected = selectedLog?.id === (log?.id || `plan-${i}`);
                const isDimmed = selectedLog && !isSelected;

                return (
                  <div key={i} className="relative flex-1 flex justify-center h-full">
                    {/* ПУНКТИР (План) - тепер показуємо і сьогодні, якщо немає логу */}
                    {dayPlan && isFutureOrToday && !log && (
                      <div 
                        onClick={() => {
                          console.log("DayPlan data:", dayPlan);
                          setSelectedLog({
                            id: `plan-${i}`,
                            isPlan: true,
                            // Пробуємо всі можливі варіанти імен полів з бекенду
                            plannedWake: dayPlan.plannedWake || dayPlan.plannedWakeTime || dayPlan.wakeTime,
                            plannedBedtime: dayPlan.plannedBedtime || dayPlan.idealBedtime || dayPlan.bedtime,
                            plannedHours: dayPlan.plannedSleepHours || dayPlan.duration || 8,
                            sleepStart: dayPlan.date + 'T' + (dayPlan.plannedBedtime || dayPlan.idealBedtime || dayPlan.bedtime), 
                            sleepEnd: dayPlan.date + 'T' + (dayPlan.plannedWake || dayPlan.plannedWakeTime || dayPlan.wakeTime)
                          });
                        }}
                        className="absolute w-[75%] rounded border-[1.5px] border-dashed border-[#5B7FA6] bg-[#5B7FA6]/5 cursor-pointer z-10"
                        style={{ top: `${recTop}%`, height: `${recHeight}%` }}
                      />
                    )}

                    {/* СТОВПЕЦЬ (Факт) */}
                    {log && log.sleepStart && (
                      <div 
                        onClick={() => setSelectedLog(isSelected ? null : log)}
                        className={`absolute w-[75%] rounded bg-[#475569] cursor-pointer transition-all z-20 ${isDimmed ? 'opacity-30' : 'hover:bg-[#334155]'}`}
                        style={{ top: `${barTop}%`, height: `${barHeight}%` }}
                      />
                    )}

                    {/* МОДАЛКА (TOOLTIP) */}
                    <AnimatePresence>
                      {isSelected && selectedLog && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                          animate={{ opacity: 1, y: 0, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`absolute bottom-full mb-4 z-[60] w-44 bg-white p-3 rounded-xl shadow-xl border border-[#E5E7EB] ${i > dates.length - 3 ? 'right-0' : 'left-0'}`}
                          style={{ bottom: `${100 - (selectedLog.isPlan ? recTop : barTop)}%` }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-bold text-[#364153]">
                              {selectedLog.isPlan ? 'Planned Schedule' : 'Sleep Details'}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedLog(null); }} className="text-[#99A1AF] hover:text-ink transition-colors">✕</button>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 text-[11px]">
                            <div className="flex justify-between border-b border-gray-50 pb-1">
                              <span className="text-[#6A7282]">{selectedLog.isPlan ? 'Bedtime' : 'Fell asleep'}</span>
                              <span className="font-medium text-[#1E2939]">
                                {selectedLog.isPlan 
                                  ? (selectedLog.plannedBedtime ? selectedLog.plannedBedtime.substring(0, 5) : '--:--') 
                                  : (selectedLog.sleepStart ? new Date(selectedLog.sleepStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--')}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-1">
                              <span className="text-[#6A7282]">{selectedLog.isPlan ? 'Wake up' : 'Woke up'}</span>
                              <span className="font-medium text-[#1E2939]">
                                {selectedLog.isPlan 
                                  ? (selectedLog.plannedWake?.substring(0, 5) || '--:--') 
                                  : (selectedLog.sleepEnd ? new Date(selectedLog.sleepEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--')}
                              </span>
                            </div>
                            <div className="flex justify-between pb-1 border-b border-gray-50">
                              <span className="text-[#6A7282]">Duration</span>
                              <span className="font-medium text-[#5B7FA6]">
                                {selectedLog.isPlan ? `${selectedLog.plannedHours} hrs` : `${((new Date(selectedLog.sleepEnd)-new Date(selectedLog.sleepStart))/3600000).toFixed(1)} hrs`}
                              </span>
                            </div>

                            {!selectedLog.isPlan && (
                              <>
                                <div className="flex justify-between border-t border-gray-50 pt-1 mt-1">
                                  <span className="text-[#6A7282]">Quality</span>
                                  <span className="font-medium text-[#E8B4B4]">{selectedLog.sleepQuality} / 10</span>
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEdit(selectedLog); }}
                                  className="mt-3 w-full py-1.5 bg-[#5B7FA6]/10 text-[#5B7FA6] rounded-lg font-semibold hover:bg-[#5B7FA6]/20 transition-colors"
                                >
                                  Edit Log
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(selectedLog.id); }}
                                  className="mt-2 w-full py-1.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors"
                                >
                                  Delete Log
                                </button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Підпис осі X (динамічний залежно від period) */}
                    <div className={`absolute -bottom-6 text-[9px] ${isSelected ? 'text-[#364153] font-bold' : 'text-[#6B7280]'}`}>
                      {colLabel(period, date, i)}
                    </div>
                  </div>
                );
              })}

              {/* ========================================================= */}
              {/* АПРОКСИМАЦІЯ (Trend Lines) - Розрахунок Лінійної Регресії */}
              {/* ========================================================= */}
              {(() => {
                // Фільтруємо дні, де є реальні записи, щоб побудувати лінію
                const validPoints = dates.map((targetDate, i) => {
                  const targetDateString = targetDate.toDateString();

                  const log = (logs || []).find(l => {
                    if (!l || !l.sleepEnd) return false;
                    return new Date(l.sleepEnd).toDateString() === targetDateString;
                  });

                  if (!log || !log.sleepStart || !log.sleepEnd) return null;

                  const start = new Date(log.sleepStart);
                  const end = new Date(log.sleepEnd);
                  
                  let startH = start.getHours() + start.getMinutes() / 60;
                  startH = startH >= 18 ? startH - 18 : startH + 6;
                  
                  let endH = end.getHours() + end.getMinutes() / 60;
                  endH = endH >= 18 ? endH - 18 : endH + 6;

                  return { x: i, top: (startH / 24) * 100, bottom: (endH / 24) * 100 };
                }).filter(Boolean);

                if (validPoints.length >= 2) {
                  // Математика лінійної регресії (Least Squares)
                  const n = validPoints.length;
                  const sumX = validPoints.reduce((acc, p) => acc + p.x, 0);
                  const sumX2 = validPoints.reduce((acc, p) => acc + p.x * p.x, 0);
                  
                  const denominator = (n * sumX2 - sumX * sumX);
                  if (denominator === 0) return null;

                  // Для лінії відбою (Amber)
                  const sumYTop = validPoints.reduce((acc, p) => acc + p.top, 0);
                  const sumXYTop = validPoints.reduce((acc, p) => acc + p.x * p.top, 0);
                  
                  const slopeTop = (n * sumXYTop - sumX * sumYTop) / denominator;
                  const interceptTop = (sumYTop - slopeTop * sumX) / n;
                  
                  const startYTop = interceptTop; // Y для x=0
                  const endYTop = interceptTop + slopeTop * (dates.length - 1); // Y для кінця

                  // Для лінії пробудження (Green)
                  const sumYBot = validPoints.reduce((acc, p) => acc + p.bottom, 0);
                  const sumXYBot = validPoints.reduce((acc, p) => acc + p.x * p.bottom, 0);
                  const slopeBot = (n * sumXYBot - sumX * sumYBot) / denominator;
                  const interceptBot = (sumYBot - slopeBot * sumX) / n;

                  const startYBot = interceptBot;
                  const endYBot = interceptBot + slopeBot * (dates.length - 1);

                  const paddingPercent = 100 / (2 * dates.length);

                  return (
                    <svg className="absolute inset-0 h-full w-full pointer-events-none z-30" preserveAspectRatio="none">
                      {/* Лінія початку сну (Відбій) */}
                      <line 
                        x1={`${paddingPercent}%`} y1={`${Math.max(0, Math.min(100, startYTop))}%`} 
                        x2={`${100 - paddingPercent}%`} y2={`${Math.max(0, Math.min(100, endYTop))}%`} 
                        stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" 
                      />
                      {/* Лінія пробудження */}
                      <line 
                        x1={`${paddingPercent}%`} y1={`${Math.max(0, Math.min(100, startYBot))}%`} 
                        x2={`${100 - paddingPercent}%`} y2={`${Math.max(0, Math.min(100, endYBot))}%`} 
                        stroke="#10B981" strokeWidth="2" strokeLinecap="round" 
                      />
                    </svg>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-col gap-2 px-2">
           <div className="flex items-center justify-between">
             <span className="text-[12px] font-[500] text-[#4A5565]">Average Sleep Quality:</span>
             <span className="text-[14px] font-bold text-[#5B7FA6]">{avgQuality} / 10</span>
           </div>
           <div className="flex items-center justify-between">
             <span className="text-[12px] font-[500] text-[#4A5565]">Average Duration:</span>
             <span className="text-[14px] font-bold text-[#5B7FA6]">{avgDuration} hrs</span>
           </div>
        </div>
      </motion.section>

      {/* ── History Section ── */}
      <motion.section
        variants={sectionVar}
        className="rounded-[14px] bg-white/60 p-5"
        style={{ outline: '1.54px rgba(229,231,235,0.50) solid', outlineOffset: '-1.54px' }}
      >
        <h3 className="text-[14px] font-semibold text-[#1E2939] mb-4">Sleep History</h3>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-[12px] text-[#6A7282] text-center py-4">No logs for this period.</p>
          ) : (
            logs
              .sort((a, b) => new Date(b.sleepEnd) - new Date(a.sleepEnd))
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-white/40 rounded-xl border border-ink/5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1E2939]">
                      {new Date(log.sleepStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(log.sleepEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </p>
                    <p className="text-[11px] text-[#6A7282]">
                      {new Date(log.sleepEnd).toLocaleDateString()} • {((new Date(log.sleepEnd) - new Date(log.sleepStart)) / 3600000).toFixed(1)} hrs • Quality: {log.sleepQuality}/10
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(log)}
                      className="p-2 text-[#5B7FA6] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Log"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(log.id)}
                      className="p-2 text-garnet hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Log"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </motion.section>

    {/* Onboarding / Settings Modal */}
    <AnimatePresence>
      {showSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F9F6EE]/80 backdrop-blur-sm px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-[0_20px_60px_rgb(0,0,0,0.1)] outline outline-[1.5px] outline-[#D1D5DC]/50 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="text-center mb-6">
              <span className="text-4xl mb-2 block">🧬</span>
              <h2 className="text-[18px] font-semibold text-[#364153]">Your Sleep Blueprint</h2>
              <p className="text-[12px] text-[#6A7282] mt-1">Let's configure the algorithm to your body's needs.</p>
            </div>

            <div className="flex flex-col gap-5">
              {/* Field 1 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[600] text-[#4A5565]">Target Wake Up Time</label>
                <p className="text-[10px] text-[#99A1AF] mb-1">When do you ideally want to start your day?</p>
                <input type="time" value={setupData.targetWakeTime} onChange={(e) => setSetupData({...setupData, targetWakeTime: e.target.value})} className="w-full rounded-[10px] bg-rice/50 px-3 py-2.5 text-sm outline outline-[1px] outline-[#D1D5DC] focus:outline-[#5B7FA6]" />
              </div>

              {/* Field 2 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[600] text-[#4A5565]">Base Sleep Need (hours)</label>
                <p className="text-[10px] text-[#99A1AF] mb-1">How much sleep makes you feel fully rested?</p>
                <input type="number" step="0.5" min="4" max="12" value={setupData.baseSleepHours} onChange={(e) => setSetupData({...setupData, baseSleepHours: e.target.value})} className="w-full rounded-[10px] bg-rice/50 px-3 py-2.5 text-sm outline outline-[1px] outline-[#D1D5DC] focus:outline-[#5B7FA6]" />
              </div>

              {/* Field 3 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[600] text-[#4A5565]">Absolute Minimum Sleep (hours)</label>
                <p className="text-[10px] text-[#99A1AF] mb-1">The critical line. Below this, we force a schedule shift.</p>
                <input type="number" step="0.5" min="3" max="8" value={setupData.absoluteMinSleepHours} onChange={(e) => setSetupData({...setupData, absoluteMinSleepHours: e.target.value})} className="w-full rounded-[10px] bg-rice/50 px-3 py-2.5 text-sm outline outline-[1px] outline-[#E8B4B4]/60 focus:outline-[#E8B4B4]" />
              </div>

              {/* Field 4 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[600] text-[#4A5565]">Recovery Shift Step (mins)</label>
                <p className="text-[10px] text-[#99A1AF] mb-1">How fast to push the alarm back after a late night?</p>
                <select value={setupData.shiftStepMinutes} onChange={(e) => setSetupData({...setupData, shiftStepMinutes: e.target.value})} className="w-full rounded-[10px] bg-rice/50 px-3 py-2.5 text-sm outline outline-[1px] outline-[#D1D5DC] focus:outline-[#5B7FA6]">
                  <option value="15">Gentle (15 mins/day)</option>
                  <option value="30">Moderate (30 mins/day)</option>
                  <option value="60">Aggressive (60 mins/day)</option>
                </select>
              </div>

              {/* Field 5 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[600] text-[#4A5565]">Weekend Deviation (hours)</label>
                <p className="text-[10px] text-[#99A1AF] mb-1">How much later are you allowed to sleep in on weekends?</p>
                <input type="number" step="0.5" min="0" max="5" value={setupData.weekendDeviationHours} onChange={(e) => setSetupData({...setupData, weekendDeviationHours: e.target.value})} className="w-full rounded-[10px] bg-rice/50 px-3 py-2.5 text-sm outline outline-[1px] outline-[#D1D5DC] focus:outline-[#5B7FA6]" />
              </div>
            </div>

            <button 
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="mt-8 w-full rounded-[12px] bg-[#475569] py-3.5 text-[14px] font-medium text-white shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSavingProfile ? 'Saving...' : 'Initialize Algorithm'}
            </button>
            
            {/* Кнопка закриття (доступна тільки якщо профіль вже є в БД) */}
            {profile && profile.id && (
               <button onClick={() => setShowSetup(false)} className="mt-4 w-full text-[13px] font-medium text-[#6A7282] hover:text-[#364153]">
                 Cancel
               </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
);
}
