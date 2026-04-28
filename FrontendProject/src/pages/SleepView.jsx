import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client.js';
import { endpoints } from '../api/endpoints.js';

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
  const [profile, setProfile] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [selectedLog,  setSelectedLog]  = useState(null);

  const dates = useMemo(() => getWindowDates(period, anchor), [period, anchor]);

  const fromStr = useMemo(() => localDateKey(dates[0]), [dates]);
  const toStr   = useMemo(() => localDateKey(dates[dates.length - 1]), [dates]);

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

  // Fetch profile once
  useEffect(() => {
    api.get(endpoints.sleep.profile)
      .then(r => setProfile(r.data ?? null))
      .catch(() => setProfile(null));
  }, []);

  // Fetch logs when window changes
  useEffect(() => {
    setLoadingChart(true);
    api.get(`${endpoints.sleep.list}?from=${fromStr}&to=${toStr}`)
      .then(r => setLogs(r.data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingChart(false));
  }, [fromStr, toStr, refreshKey]);

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
      
      const payload = {
        sleepStart: new Date(sleepStart).toISOString(),
        sleepEnd: new Date(sleepEnd).toISOString(),
        ...(quality != null && { sleepQuality: quality }),
        tags: []
      };

      await api.post(endpoints.sleep.logs, payload);
      alert('Sleep logged successfully!');
      
      const d = getDefaultTimes();
      setSleepStart(d.sleepStart); setSleepEnd(d.sleepEnd); setQuality(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Payload error:", err.response?.data);
      setSaveErr('Failed to log sleep. See console for details.');
      alert('Failed to log sleep. See console for details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

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

        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="mt-4 w-full rounded-[10px] py-3 text-[14px] font-[500] text-white disabled:opacity-60"
          style={{ background: '#4A5565', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }}
        >
          {saving ? 'Saving…' : 'Mark Sleep'}
        </motion.button>
      </motion.section>

      {/* ── Chart Card ── */}
      <motion.section
        variants={sectionVar}
        className="rounded-[14px] bg-white/60"
        style={{ padding: '21.53px', outline: '1.54px rgba(229,231,235,0.50) solid', outlineOffset: '-1.54px' }}
      >
        {/* Period filter */}
        <div className="mb-3 flex items-center gap-2">
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
            disabled={isCurrentPeriod()}
            onClick={() => setAnchor(a => navigatePeriod(period, a, 1))}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isCurrentPeriod() ? 'cursor-default opacity-30' : 'text-[#4A5565] active:bg-ink/[0.06]'}`}
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

            {/* Рендер днів (Стовпці) */}
            <div className="absolute top-0 bottom-0 left-10 right-0 flex justify-between">
              {dates.map((targetDate, i) => {
                
                // 1. Логіка визначення дати стовпця (використовуємо dates[i])
                const targetDateString = targetDate.toDateString();

                // 2. Шукаємо лог. Віднімаємо 12 годин від sleepStart, 
                // щоб сон о 02:00 вівторка зарахувався до "ночі понеділка"
                const log = (logs || []).find(l => {
                   if (!l || !l.sleepStart) return false;
                   const logicalDate = new Date(new Date(l.sleepStart).getTime() - 12 * 3600 * 1000);
                   return logicalDate.toDateString() === targetDateString;
                });

                // 3. Математика для реального сну
                let barTop = 0, barHeight = 0;
                if (log && log.sleepStart && log.sleepEnd) {
                  const start = new Date(log.sleepStart);
                  const end = new Date(log.sleepEnd);
                  
                  // Зміщуємо так, щоб 18:00 було 0% (початок графіка)
                  let startH = start.getHours() + start.getMinutes() / 60;
                  startH = startH >= 18 ? startH - 18 : startH + 6;
                  barTop = (startH / 24) * 100;
                  
                  const durationHours = (end - start) / (1000 * 60 * 60);
                  barHeight = (durationHours / 24) * 100;
                }

                // 4. Математика для пунктирної рамки (Рекомендація)
                let recTop = 0, recHeight = 0;
                if (profile && (profile.targetWakeTime || profile.TargetWakeTime)) {
                  // Парсимо "07:00:00" або "07:00"
                  const pt = profile.targetWakeTime || profile.TargetWakeTime;
                  const [wakeH, wakeM] = pt.split(':').map(Number);
                  let wakeOffset = wakeH >= 18 ? wakeH - 18 : wakeH + 6;
                  let wakePercent = ((wakeOffset + (wakeM || 0) / 60) / 24) * 100;
                  
                  recHeight = ((profile.baseSleepHours || profile.BaseSleepHours || 8) / 24) * 100;
                  recTop = wakePercent - recHeight; 
                }

                // Підпис дня тижня внизу
                const lbl = colLabel(period, targetDate, i);

                return (
                  <div key={i} className="relative flex-1 flex justify-center h-full">
                    
                    {/* Пунктирна рамка (Рекомендація) */}
                    {recHeight > 0 && (
                      <div 
                        className="absolute w-[75%] rounded border-[1.5px] border-dashed border-[#5B7FA6] bg-[#5B7FA6]/5 pointer-events-none"
                        style={{ top: `${recTop}%`, height: `${recHeight}%` }}
                      />
                    )}

                    {/* Зафарбований стовпець (Реальний сон) */}
                    {log && log.sleepStart && (
                      <div 
                        onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                        className="absolute w-[75%] rounded bg-[#475569] cursor-pointer hover:bg-[#334155] transition-colors z-20"
                        style={{ top: `${barTop}%`, height: `${barHeight}%` }}
                      />
                    )}

                    {/* Попап (Модальне вікно) ПРИВ'ЯЗАНЕ до стовпця */}
                    {selectedLog?.id === log?.id && log && (
                      <div className={`absolute top-[105%] ${i > (dates.length / 2) ? 'right-0' : 'left-0'} z-50 w-48 bg-white p-3 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.15)] border border-[#E5E7EB]`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[12px] font-semibold text-[#364153]">Sleep Details</span>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLog(null); }} className="text-[#99A1AF] hover:text-black">✕</button>
                        </div>
                        <div className="flex flex-col gap-1.5 text-[11px]">
                          <div className="flex justify-between border-b border-ink/5 pb-1">
                            <span className="text-[#6A7282]">Fell asleep</span>
                            <span className="font-medium text-[#1E2939]">{new Date(log.sleepStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="flex justify-between border-b border-ink/5 pb-1">
                            <span className="text-[#6A7282]">Woke up</span>
                            <span className="font-medium text-[#1E2939]">{new Date(log.sleepEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6A7282]">Quality</span>
                            <span className="font-medium text-[#E8B4B4]">{log.sleepQuality} / 10</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Підпис дня тижня внизу */}
                    <div className="absolute -bottom-6 text-[9px] text-[#6B7280]">
                      {lbl}
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
                    if (!l || !l.sleepStart) return false;
                    const logicalDate = new Date(new Date(l.sleepStart).getTime() - 12 * 3600 * 1000);
                    return logicalDate.toDateString() === targetDateString;
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

        <div className="mt-12 flex items-center justify-between px-2">
           <span className="text-[12px] font-[500] text-[#4A5565]">Average Sleep Quality:</span>
           <span className="text-[14px] font-bold text-[#5B7FA6]">{avgQuality} / 10</span>
        </div>
      </motion.section>

    </div>
  );
}
