import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client.js'; // Використовуємо існуючий client.js
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

// Допоміжний мапінг статусів пропозицій
const STATUS_CONFIG = {
  0: { label: 'Pending', bg: 'bg-[#F3F4F6]', text: 'text-[#9CA3AF]' },
  1: { label: 'Approved', bg: 'bg-[#D1FAE5]', text: 'text-[#10B981]' },
  2: { label: 'Rejected', bg: 'bg-[#FEE2E2]', text: 'text-[#EF4444]' },
  3: { label: 'In Progress', bg: 'bg-[#DBEAFE]', text: 'text-[#3B82F6]' }
};

const AnalystDashboardView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // --- СТЕЙТИ ДЛЯ РЕАЛЬНИХ ДАНИХ З БЕКЕНДУ ---
  const [needsAttention, setNeedsAttention] = useState([]);
  const [sleepData, setSleepData] = useState(null);
  const [trends, setTrends] = useState([]);
  const [myProposals, setMyProposals] = useState([]);
  const [otherProposals, setOtherProposals] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Стейт для форми нової пропозиції
  const [form, setForm] = useState({ habitId: '', proposedChange: '', argumentation: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Завантаження даних
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [attRes, sleepRes, trendsRes, myPropRes, otherPropRes] = await Promise.all([
        api.get('/api/analyst/habits/needs-attention').catch(() => ({ data: [] })),
        api.get('/api/analyst/sleep/effectiveness').catch(() => ({ data: null })),
        api.get('/api/analyst/habits/trends').catch(() => ({ data: [] })),
        api.get('/api/analyst/proposals/me').catch(() => ({ data: [] })),
        api.get('/api/analyst/proposals/others').catch(() => ({ data: [] }))
      ]);

      setNeedsAttention(attRes.data || []);
      setSleepData(sleepRes.data);
      setTrends(trendsRes.data || []);
      setMyProposals(myPropRes.data || []);
      setOtherProposals(otherPropRes.data || []);
    } catch (error) {
      console.error("Failed to fetch analyst dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Відправка нової пропозиції
  const handleSubmitProposal = async () => {
    if (!form.habitId || !form.proposedChange || !form.argumentation) {
      alert("Please fill in all fields.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post('/api/analyst/proposals', {
        habitId: Number(form.habitId),
        proposedChange: form.proposedChange,
        argumentation: form.argumentation
      });
      
      setForm({ habitId: '', proposedChange: '', argumentation: '' });
      fetchDashboardData(); // Оновлюємо списки після відправки
      alert("Proposal submitted successfully!");
    } catch (error) {
      console.error("Submission failed", error);
      alert("Failed to submit proposal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Хелпер для кліку "💡 Suggest Proposal" з таблиці (презаповнює форму і скролить до неї)
  const handleSuggestClick = (habitId) => {
    setForm(prev => ({ ...prev, habitId: habitId }));
    document.getElementById('proposal-form').scrollIntoView({ behavior: 'smooth' });
  };
  
  const filteredHabits = needsAttention.filter(h => {
    const matchesSearch = h.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (showAll) return matchesSearch;
    return matchesSearch && h.dropoffRatePct > 15; // Show only high drop-off by default
  });

  if (isLoading) return <div className="flex justify-center items-center h-screen text-gray-400">Loading Analyst Data...</div>;

  return (
    <div className="min-h-screen bg-[#F9F6EE] px-4 md:px-8">
      <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 text-[#364153]">
        
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#F9F6EE] sticky top-0 z-30 py-4 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-[28px] md:text-[30px] font-normal leading-tight tracking-wide">Data Analyst Dashboard</h1>
            <p className="text-[14px] text-[#6A7282]">Analyze global habit performance, test proposals, and monitor algorithm effectiveness</p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <button 
              onClick={() => navigate('/dashboard')}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#8FBC8F] text-white text-[14px] font-medium rounded-lg shadow-sm hover:bg-[#7ba97b] transition-colors"
            >
              <span>←</span> Back to Personal Analytics
            </button>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[14px] font-medium">{user?.name || 'Analyst'}</span>
                <button onClick={logout} className="text-[11px] text-garnet underline">Sign out</button>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7AB8CC] to-[#8FBC8F] flex items-center justify-center text-white font-medium shadow-sm">
                {user?.name?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── COL 1 & 2: MAIN METRICS ── */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            
            {/* 1. Needs Attention Table */}
            <div className="bg-white/60 backdrop-blur-sm rounded-[14px] border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-white/40 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-medium">Global Habit Performance {showAll ? '' : '(Needs Attention)'}</h2>
                  <p className="text-[12px] text-[#6A7282]">
                    {showAll ? 'Complete list of all global habits and their performance' : 'Habits with high drop-off rates requiring analyst intervention'}
                  </p>
                </div>
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    placeholder="Search habit..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-[#7AB8CC]"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-gray-50/50 text-[12px] text-[#4A5565] uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Habit Name</th>
                      <th className="px-6 py-4">Active Users</th>
                      <th className="px-6 py-4">Avg Logs/User</th>
                      <th className="px-6 py-4">Drop-off Rate</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/60 bg-white/30">
                    {filteredHabits.length > 0 ? filteredHabits.map((habit, idx) => (
                      <tr key={idx} className={`hover:bg-red-50/20 transition-colors ${habit.dropoffRatePct > 30 ? 'bg-red-50/10' : ''}`}>
                        <td className="px-6 py-4 font-medium">{habit.title}</td>
                        <td className="px-6 py-4 text-[#4A5565]">{habit.subscribersActive?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium w-10">{Math.round(habit.avgExecutions || 0)}</span>
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              {/* Normalize to 30 logs as a reference point for visual fill */}
                              <div className="h-full bg-[#8FBC8F]" style={{ width: `${Math.min(100, (habit.avgExecutions || 0) * 3.3)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${habit.dropoffRatePct > 25 ? 'text-[#E7000B]' : 'text-[#4A5565]'}`}>
                              {Math.round(habit.dropoffRatePct || 0)}%
                            </span>
                            {habit.dropoffRatePct > 25 && <div className="w-3 h-1.5 border-[1.5px] border-[#FB2C36] rounded-[2px]" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleSuggestClick(habit.habitId)}
                            className="bg-[#7AB8CC] text-white text-[12px] font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#68a3b8] transition-colors whitespace-nowrap"
                          >
                            💡 Suggest Proposal
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-400 text-[13px]">
                          {searchTerm ? 'No habits found matching your search.' : 'Everything looks healthy. No habits currently flag for high drop-off.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="px-6 py-3 bg-gray-50/30 border-t border-gray-200 flex justify-between items-center">
                <span className="text-[12px] text-[#4A5565]">
                  Showing {filteredHabits.length} habits | <span className="font-semibold text-[#E7000B]">{needsAttention.filter(h => h.dropoffRatePct > 30).length}</span> high-priority
                </span>
                <button 
                  onClick={() => setShowAll(!showAll)}
                  className="text-[#7AB8CC] text-[14px] font-medium hover:underline"
                >
                  {showAll ? 'Show High Drop-off Only' : 'View All Habits Data ↗'}
                </button>
              </div>
            </div>

            {/* 3. Suggest Proposal Form */}
            <div id="proposal-form" className="bg-white/60 backdrop-blur-sm rounded-[14px] border border-gray-200 shadow-sm flex flex-col">
              <div className="px-6 py-4 bg-white/40 border-b border-gray-200">
                <h2 className="text-[18px] font-medium">Suggest a New Proposal</h2>
                <p className="text-[12px] text-[#6A7282]">Propose changes to improve habit performance</p>
              </div>
              
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-medium">Habit ID / Name</label>
                  <input 
                    type="text" 
                    value={form.habitId} 
                    onChange={e => setForm({...form, habitId: e.target.value})}
                    placeholder="Enter Habit ID"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-[14px] focus:outline-none focus:border-[#7AB8CC]"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-medium">Proposed Change</label>
                  <input 
                    type="text" 
                    value={form.proposedChange} 
                    onChange={e => setForm({...form, proposedChange: e.target.value})}
                    placeholder="e.g., Increase target from 10 min to 15 min"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-[14px] focus:outline-none focus:border-[#7AB8CC]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-medium">Argumentation</label>
                  <textarea 
                    rows="3"
                    value={form.argumentation} 
                    onChange={e => setForm({...form, argumentation: e.target.value})}
                    placeholder="Provide data-driven reasoning for this change..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-[14px] focus:outline-none focus:border-[#7AB8CC] resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={handleSubmitProposal}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#7AB8CC] text-white text-[14px] font-medium py-2 rounded-lg shadow-sm hover:bg-[#68a3b8] transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                  <button 
                    onClick={() => setForm({habitId:'', proposedChange:'', argumentation:''})}
                    className="px-6 bg-gray-200 text-[#364153] text-[14px] font-medium py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* ── COL 3: SIDEBAR (Sleep AI & Trends) ── */}
          <div className="col-span-1 flex flex-col gap-6">
            
            {/* 2. Sleep Algorithm AI Effectiveness */}
            <div className="bg-gradient-to-br from-[#7AB8CC]/10 to-[#8FBC8F]/10 rounded-[14px] border border-[#7AB8CC]/30 p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7AB8CC] to-[#8FBC8F] flex items-center justify-center shadow-sm text-white text-[20px]">
                  🤖
                </div>
                <div>
                  <h3 className="text-[16px] font-medium">Sleep Algorithm</h3>
                  <p className="text-[12px] text-[#6A7282]">AI Effectiveness</p>
                </div>
              </div>

              {sleepData ? (
                <>
                  <div className="mt-2">
                    <p className="text-[12px] text-[#4A5565]">User Adherence Rate</p>
                    <div className="flex justify-between items-end">
                      <span className="text-[28px] font-semibold text-[#7AB8CC] leading-none">{Math.round(sleepData.adherenceRatePct || 0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#7AB8CC] to-[#8FBC8F]" style={{ width: `${sleepData.adherenceRatePct || 0}%` }} />
                    </div>
                    <p className="text-[11px] text-[#6A7282] mt-1">of users follow recommended bedtime</p>
                  </div>

                  <div className="border-t border-gray-300/50 pt-4 mt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px]">📈</span>
                      <span className="text-[12px] font-medium text-[#4A5565]">Impact Metrics</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#4A5565]">Morning Mood</span>
                      <span className="text-[13px] font-semibold text-[#00A63E]">+{Math.round(sleepData.morningMoodDeltaPct || 0)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#4A5565]">Sleep Quality Score</span>
                      <span className="text-[13px] font-semibold text-[#00A63E]">+{Math.round(sleepData.sleepQualityDeltaPct || 0)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#4A5565]">Next-Day Completion</span>
                      <span className="text-[13px] font-semibold text-[#00A63E]">+{Math.round(sleepData.nextDayCompletionDeltaPct || 0)}%</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-300/50 pt-4 mt-2">
                    <p className="text-[12px] leading-relaxed">
                      <span className="font-medium">Key Insight:</span> {sleepData.keyInsight || "Users who follow the AI-recommended bedtime report better metrics."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-[13px] text-gray-500">Not enough data to calculate AI effectiveness yet.</div>
              )}
            </div>

            {/* 4. My Proposals (Mini List) */}
            <div className="bg-white/60 backdrop-blur-sm rounded-[14px] border border-gray-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-5 py-4 bg-white/40 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-[16px] font-medium">My Proposals</h2>
                  <p className="text-[11px] text-[#6A7282]">Track your submitted changes</p>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                {myProposals.length > 0 ? myProposals.map(prop => {
                  const status = STATUS_CONFIG[prop.status] || STATUS_CONFIG[0];
                  return (
                    <div key={prop.id} className="bg-white/80 p-3 rounded-lg border border-gray-200 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[13px] font-semibold">{prop.habitName || `Habit #${prop.habitId}`}</h4>
                          <p className="text-[10px] text-[#6A7282]">{new Date(prop.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-[#6A7282] uppercase tracking-wider mb-0.5">Proposed Change</p>
                        <p className="text-[12px]">{prop.proposedChange}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-6 text-gray-400 text-[12px]">You haven't submitted any proposals yet.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystDashboardView;
