import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client.js'; // Використовуємо існуючий client.js

// ── COLOR & SHAPE HELPERS FOR MORPH BLOB ──────────────────────────────────────
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

// ── THE MORPH BLOB COMPONENT ──────────────────────────────────────────────────
function MorphBlob({ pleasure = 0, arousal = 0, dominance = 0, size = 38 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible drop-shadow-sm">
      <path
        d={buildBlobPath(cx, cy, r, arousal)}
        fill={pleasureToFill(pleasure)}
        fillOpacity={0.88}
        stroke={dominanceStrokeColor(dominance)}
        strokeWidth={dominanceStrokeWidth(dominance) * (size / 120)} // Адаптуємо товщину лінії під малий розмір
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

// ── MAIN ANALYTICS VIEW ───────────────────────────────────────────────────────
const AnalyticsView = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isYearView, setIsYearView] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [dashboardData, setDashboardData] = useState({
    categories: [],
    insights: [],
    pixels: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllAnalytics = async () => {
      setIsLoading(true);
      try {
        const firstDay = new Date(currentDate.getFullYear(), isYearView ? 0 : currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), isYearView ? 11 : currentDate.getMonth() + 1, 0);
        
        const startDateStr = firstDay.toISOString().split('T')[0];
        const endDateStr = lastDay.toISOString().split('T')[0];

        const [catsRes, habitsRes, corrsRes, dailyRes] = await Promise.all([
          api.get('/api/analytics/categories').catch(() => ({ data: [] })),
          api.get('/api/analytics/habits').catch(() => ({ data: [] })),
          api.get('/api/analytics/correlations').catch(() => ({ data: [] })),
          api.get(`/api/analytics/daily?startDate=${startDateStr}&endDate=${endDateStr}`).catch(() => ({ data: [] }))
        ]);

        // --- ГЕНЕРАЦІЯ ІНСАЙТІВ ---
        const generatedInsights = [];
        const habits = habitsRes.data || [];
        
        (corrsRes.data || []).forEach(corr => {
          // Знижено поріг до 2 днів для тестування (раніше було 3)
          if (corr.sampleDays < 2) return; 
          
          const habit = habits.find(h => h.userHabitId === corr.userHabitId);
          const habitName = habit ? habit.displayName.toLowerCase() : "this habit";

          // Знижено поріг Пірсона до 0.2 (раніше 0.4), щоб інсайти з'являлися частіше
          if (corr.pearsonPleasure > 0.2) {
            generatedInsights.push({ text: `Your mood is noticeably higher on days you do ${habitName}`, value: `+${(corr.pearsonPleasure * 100).toFixed(0)}%`, color: '#8FBC8F' });
          } else if (corr.pearsonPleasure < -0.2) {
            generatedInsights.push({ text: `Your mood tends to drop when doing ${habitName}`, value: `${(corr.pearsonPleasure * 100).toFixed(0)}%`, color: '#C85A54' });
          }

          if (corr.pearsonArousal > 0.2) {
            generatedInsights.push({ text: `You experience higher energy & focus with ${habitName}`, value: `+${(corr.pearsonArousal * 100).toFixed(0)}%`, color: '#7AB8CC' });
          } else if (corr.pearsonArousal < -0.2) {
            generatedInsights.push({ text: `${habitName} helps you stay relaxed and calm`, value: `Calm`, color: '#A3AD7C' });
          }
        });

        setDashboardData({
          categories: catsRes.data || [],
          insights: generatedInsights.slice(0, 4), // Показуємо топ 4 інсайти
          pixels: dailyRes.data || []
        });

      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllAnalytics();
  }, [currentDate, isYearView]);

  const handlePrev = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (isYearView) d.setFullYear(d.getFullYear() - 1);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (isYearView) d.setFullYear(d.getFullYear() + 1);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const periodLabel = isYearView 
    ? currentDate.getFullYear().toString() 
    : currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  if (isLoading) return <div className="flex justify-center p-10 text-gray-400">Analyzing your data...</div>;

  return (
    <div className="flex flex-col gap-8 pb-12">
      
      {/* 1. Category Performance */}
      <section className="bg-white/60 backdrop-blur-md rounded-[24px] p-6 outline outline-1 outline-black/5 shadow-sm">
        <h3 className="text-[12px] font-bold text-[#4A5565] uppercase tracking-widest mb-8">Category Performance</h3>
        
        {dashboardData.categories.length > 0 ? (
          <>
            <div className="relative h-64 w-full flex items-center justify-center mb-6">
              <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                {[0.25, 0.5, 0.75, 1].map((step, i) => (
                  <circle key={i} cx="100" cy="100" r={80 * step} fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 2" />
                ))}
                {dashboardData.categories.slice(0, 6).map((_, i) => {
                  const angle = (i * 60 * Math.PI) / 180;
                  return <line key={i} x1="100" y1="100" x2={100 + 80 * Math.cos(angle)} y2={100 + 80 * Math.sin(angle)} stroke="#E5E7EB" strokeWidth="1" />;
                })}
                <path
                  d={dashboardData.categories.slice(0, 6).map((cat, i) => {
                    const angle = (i * 60 * Math.PI) / 180;
                    const r = (cat.percentage / 100) * 80;
                    const x = 100 + r * Math.cos(angle);
                    const y = 100 + r * Math.sin(angle);
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ') + ' Z'}
                  fill="rgba(122, 184, 204, 0.3)" stroke="#7AB8CC" strokeWidth="2"
                />
              </svg>
              
              {dashboardData.categories.slice(0,6).map((cat, i) => {
                const positions = [
                  "top-0", "bottom-0", "right-0 top-1/3 translate-x-4", 
                  "right-0 bottom-1/3 translate-x-4", "left-0 top-1/3 -translate-x-4 text-right", 
                  "left-0 bottom-1/3 -translate-x-4 text-right"
                ];
                return (
                  <span key={i} className={`absolute ${positions[i]} text-[11px] text-[#6B7280] font-medium`}>
                    {cat.categoryName}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[11px] text-[#6A7282] underline decoration-[#6A7282]/30 underline-offset-4 hover:text-[#364153] transition-all mx-auto block"
              >
                {isExpanded ? 'Hide Details' : 'View Category Breakdown'}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-4 pt-4 border-t border-black/5"
                  >
                    <div className="grid grid-cols-1 gap-3">
                      {dashboardData.categories.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 w-24">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.colorHex || '#7AB8CC' }} />
                            <span className="text-[12px] text-[#4A5565] truncate">{cat.categoryName}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-1 max-w-[140px]">
                            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${cat.percentage}%` }}
                                className="h-full" style={{ backgroundColor: cat.colorHex || '#7AB8CC' }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[#364153] w-8 text-right">{Math.round(cat.percentage)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="text-center text-[13px] text-gray-400 py-10">Not enough data to calculate performance</div>
        )}
      </section>

      {/* 2. Correlation Insights */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[12px] font-bold text-[#4A5565] uppercase tracking-widest whitespace-nowrap">Correlation Insights</h3>
          <div className="h-[1px] w-full bg-[#D1D5DC]/50" />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {dashboardData.insights.length > 0 ? dashboardData.insights.map((insight, i) => (
            <div key={i} className="bg-white/60 rounded-[18px] p-4 outline outline-1 outline-black/5 flex items-center justify-between gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${insight.color}15` }}>
                <div className="w-4 h-4 border-2 rounded-sm" style={{ borderColor: insight.color }} />
              </div>
              <p className="flex-1 text-[13px] text-[#364153] leading-relaxed">
                {insight.text}
              </p>
              <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0" style={{ backgroundColor: `${insight.color}15`, color: insight.color }}>
                {insight.value}
              </div>
            </div>
          )) : (
            <div className="bg-white/60 rounded-[18px] p-6 text-center text-[12px] text-gray-400 outline outline-1 outline-black/5">
              Keep logging habits & mood on different days to calculate correlations.
            </div>
          )}
        </div>
      </section>

      {/* 3. Time in Pixels (Heatmap with Real MorphBlobs) */}
      <section className="bg-[#FCF9F2]/60 backdrop-blur-md rounded-[24px] p-6 outline outline-1 outline-black/5 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[12px] font-bold text-[#4A5565] uppercase tracking-widest">
            {isYearView ? 'Year in Pixels' : 'Month in Pixels'}
          </h3>
          <div className="text-[13px] font-medium text-[#6A7282] flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4A5565] transition-colors active:bg-ink/[0.06]"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span 
              className="w-40 text-center select-none cursor-pointer hover:text-black transition-colors" 
              onClick={() => setIsYearView(!isYearView)}
            >
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4A5565] transition-colors active:bg-ink/[0.06]"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Сітка */}
        <div className={`grid gap-2 ${isYearView ? 'grid-cols-4' : 'grid-cols-7'}`}>
          {Array.from({ length: isYearView ? 12 : daysInMonth }).map((_, i) => {
             let dayData = null;
             if (isYearView) {
               const monthStr = `${currentDate.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
               dayData = dashboardData.pixels.find(d => d.localDate.startsWith(monthStr));
             } else {
               const dayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`;
               dayData = dashboardData.pixels.find(d => d.localDate === dayStr);
             }

             const hasData = dayData && dayData.pCentroid != null;

             return (
              <div key={i} className="flex flex-col items-center gap-1">
                {hasData ? (
                  <MorphBlob 
                    pleasure={dayData.pCentroid} 
                    arousal={dayData.aCentroid || 0} 
                    dominance={dayData.dCentroid || 0}
                    size={38} 
                  />
                ) : (
                  <div className="w-[38px] h-[38px] bg-[#E8E8E8]/50 rounded-[8px]" />
                )}
                
                <span className="text-[9px] text-gray-400 font-medium mt-1">
                  {isYearView ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] : i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};

export default AnalyticsView;
