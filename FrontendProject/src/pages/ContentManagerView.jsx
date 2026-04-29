import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client.js'; // Використовуємо існуючий client.js
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

// Допоміжний мапінг статусів (як у дизайні)
const STATUS_CONFIG = {
  0: { label: 'Pending', bg: 'bg-[#F3F4F6]', text: 'text-[#9CA3AF]', border: 'border-gray-200' },
  1: { label: 'Approved', bg: 'bg-[#D1FAE5]', text: 'text-[#10B981]', border: 'border-[#10B981]/30' },
  2: { label: 'Rejected', bg: 'bg-[#FEE2E2]', text: 'text-[#EF4444]', border: 'border-[#EF4444]/30' }
};

// ─── КОМПОНЕНТ ВКЛАДКИ PROPOSALS ─────────────────────────────────────────────
const ProposalsTab = () => {
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/content/proposals');
      setProposals(res.data || []);
    } catch (error) {
      console.error("Failed to fetch proposals", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.put(`/api/content/proposals/${id}/status`, { status: newStatus });
      fetchProposals(); // Оновлюємо список після зміни статусу
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update proposal status.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search & Actions Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-[344px]">
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Search proposals..." 
            className="w-full pl-10 pr-4 py-2 bg-white/60 border border-gray-300/80 rounded-lg text-[14px] focus:outline-none focus:border-[#8FBC8F]"
          />
        </div>
        {/* Статистика статусів (як у макеті) */}
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50/50 rounded-lg border border-gray-200">
           <span className="text-[12px] text-[#4A5565]">Total: <span className="font-semibold">{proposals.length}</span></span>
           <div className="w-[1px] h-4 bg-gray-300"></div>
           <div className="flex items-center gap-3 text-[12px]">
              <span className="text-gray-500 font-medium">Pending: {proposals.filter(p => p.status === 0).length}</span>
              <span className="text-green-500 font-medium">Approved: {proposals.filter(p => p.status === 1).length}</span>
              <span className="text-red-500 font-medium">Rejected: {proposals.filter(p => p.status === 2).length}</span>
           </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white/60 border border-gray-200 rounded-[14px] overflow-hidden flex flex-col shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-200 text-[12px] font-semibold text-[#4A5565] uppercase tracking-wide">
          <div className="col-span-2">Habit Name</div>
          <div className="col-span-3">Proposed Change</div>
          <div className="col-span-4">Argumentation</div>
          <div className="col-span-1">Analyst</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-center">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500">Loading proposals...</div>
          ) : proposals.length > 0 ? (
            proposals.map((prop, idx) => {
              const status = STATUS_CONFIG[prop.status] || STATUS_CONFIG[0];
              return (
                <div key={prop.id} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-gray-100 hover:bg-white/80 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/30'}`}>
                  
                  {/* Habit Name & Date */}
                  <div className="col-span-2 flex flex-col">
                    <span className="text-[14px] font-medium text-[#364153] truncate">{prop.habitTitle}</span>
                    <span className="text-[10px] text-[#6A7282] mt-0.5">{new Date(prop.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Proposed Change */}
                  <div className="col-span-3 text-[13px] text-[#364153] pr-2">
                    {prop.proposedChange}
                  </div>

                  {/* Argumentation */}
                  <div className="col-span-4 text-[12px] text-[#6A7282] pr-4 leading-relaxed">
                    {prop.argumentation}
                  </div>

                  {/* Analyst */}
                  <div className="col-span-1 text-[13px] font-medium text-[#4A5565] truncate">
                    {prop.analystName || "Analyst"}
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-1 flex items-start">
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${status.bg} ${status.text} ${status.border} whitespace-nowrap`}>
                      {status.label}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-center gap-2">
                    {prop.status === 0 && (
                      <>
                        <button onClick={() => handleUpdateStatus(prop.id, 1)} className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors" title="Approve">
                          ✅
                        </button>
                        <button onClick={() => handleUpdateStatus(prop.id, 2)} className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors" title="Reject">
                          ❌
                        </button>
                      </>
                    )}
                    {(prop.status === 1 || prop.status === 2) && (
                      <span className="text-gray-300 text-[12px] italic">Resolved</span>
                    )}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="p-10 text-center text-gray-400">No proposals found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── КОМПОНЕНТ ВКЛАДКИ HABITS & CATEGORIES ───────────────────────────────────
const HabitsTab = () => {
  const [categories, setCategories] = useState([]);
  const [habits, setHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Стан для модальних вікон: { type: 'category' | 'habit', mode: 'add' | 'edit', data: {} }
  const [modal, setModal] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catsRes, habitsRes] = await Promise.all([
        api.get('/api/content/categories').catch(() => ({ data: [] })),
        api.get('/api/content/habits').catch(() => ({ data: [] }))
      ]);
      setCategories(catsRes.data || []);
      setHabits(habitsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Обробники CRUD (Categories) ──
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    try {
      if (modal.mode === 'add') {
        await api.post('/api/content/categories', modal.data);
      } else {
        await api.put(`/api/content/categories/${modal.data.id}`, modal.data);
      }
      setModal(null);
      fetchData();
    } catch (err) { alert("Failed to save category"); }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category? (It will be archived)")) return;
    try {
      await api.delete(`/api/content/categories/${id}`);
      fetchData();
    } catch (err) { alert("Failed to delete category"); }
  };

  // ── Обробники CRUD (Habits) ──
  const handleSaveHabit = async (e) => {
    e.preventDefault();
    // Очищаємо порожні рядки до null для БД
    const payload = {
      ...modal.data,
      categoryId: Number(modal.data.categoryId),
      description: modal.data.description || null,
      colorHex: modal.data.colorHex || null,
      iconEmoji: modal.data.iconEmoji || null
    };

    try {
      if (modal.mode === 'add') {
        await api.post('/api/content/habits', payload);
      } else {
        await api.put(`/api/content/habits/${modal.data.id}`, payload);
      }
      setModal(null);
      fetchData();
    } catch (err) { alert("Failed to save habit"); }
  };

  const handleDeleteHabit = async (id) => {
    if (!window.confirm("Are you sure you want to delete this habit?")) return;
    try {
      await api.delete(`/api/content/habits/${id}`);
      fetchData();
    } catch (err) { alert("Failed to delete habit"); }
  };

  // ── Логіка пошуку та групування ──
  const getFilteredData = () => {
    const term = searchTerm.toLowerCase();
    
    return categories
      .map(cat => {
        // Знаходимо всі звички для цієї категорії
        const catHabits = habits.filter(h => h.categoryId === cat.id && !h.isArchived);
        return { ...cat, habitsList: catHabits };
      })
      .filter(cat => {
        if (!cat) return false;
        const matchCat = cat.name?.toLowerCase().includes(term) || cat.description?.toLowerCase().includes(term);
        const matchingHabits = cat.habitsList.filter(h => h.title?.toLowerCase().includes(term) || h.description?.toLowerCase().includes(term));
        return matchCat || matchingHabits.length > 0;
      })
      .map(cat => ({
        ...cat,
        // Якщо пошук збігся з назвою категорії, показуємо всі її звички. Інакше - тільки ті, що знайшлися.
        habitsList: (cat.name?.toLowerCase().includes(term) || cat.description?.toLowerCase().includes(term))
          ? cat.habitsList 
          : cat.habitsList.filter(h => h.title?.toLowerCase().includes(term) || h.description?.toLowerCase().includes(term))
      }));
  };

  const filteredData = getFilteredData();

  if (isLoading) return <div className="flex justify-center p-10 text-gray-400">Loading Database...</div>;

  return (
    // Додано min-h-0, щоб flex-контейнер дозволяв скрол дочірнім елементам
    <div className="flex flex-col h-full overflow-hidden relative min-h-0">
      
      {/* ── HEADER: Search & Add Buttons ── */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="relative w-[344px]">
          <span className="absolute left-4 top-2.5 text-gray-400 text-[14px]">🔍</span>
          <input 
            type="text" 
            placeholder="Search habits or categories..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-200/80 rounded-[10px] text-[14px] focus:outline-none focus:border-gray-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setModal({ 
              type: 'habit', mode: 'add', 
              data: { title: '', description: '', categoryId: categories[0]?.id || '', iconEmoji: '', colorHex: '', isNegative: false } 
            })}
            className="px-6 py-2.5 bg-[#8FBC8F] text-white text-[14px] font-medium rounded-[10px] shadow-sm hover:bg-[#7ba97b] transition-colors"
          >
            Add New Habit
          </button>
          <button 
            onClick={() => setModal({ 
              type: 'category', mode: 'add', 
              data: { name: '', description: '', iconEmoji: '✨', colorHex: '#8FBC8F', isNegative: false } 
            })}
            className="px-6 py-2.5 bg-[#C85A54] text-white text-[14px] font-medium rounded-[10px] shadow-sm hover:bg-[#b34d47] transition-colors"
          >
            Add Category
          </button>
        </div>
      </div>

      {/* ── CATEGORIES & HABITS LIST ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-2 pb-10 custom-scrollbar">
        {filteredData.length > 0 ? filteredData.map(category => (
          <div 
            key={category.id} 
            // ОСЬ ГОЛОВНИЙ ФІКС: shrink-0 забороняє картці стискатися
            className="shrink-0 bg-[#FBFBF9] rounded-[14px] overflow-hidden flex flex-col shadow-sm"
            style={{ border: `2px solid ${category.colorHex || '#B8A888'}`, borderTopWidth: '4px' }}
          >
            {/* Category Header */}
            <div className="px-6 py-4 flex justify-between items-start bg-white/40">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-[24px]">{category.iconEmoji}</span>
                  <h3 className="text-[16px] font-semibold text-[#1E2939]">{category.name}</h3>
                  <span className="text-[14px] text-[#6A7282]">({category.habitsList.length} habits)</span>
                </div>
                <p className="text-[12px] text-[#6A7282] font-medium mt-1 leading-snug max-w-2xl">
                  {category.description || 'No description provided.'}
                </p>
              </div>
              <div className="flex gap-3 opacity-50 hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ type: 'category', mode: 'edit', data: category })} className="hover:text-gray-900" title="Edit Category">✏️</button>
                <button onClick={() => handleDeleteCategory(category.id)} className="hover:text-red-500" title="Delete Category">🗑️</button>
              </div>
            </div>

            {/* Habits Table inside Category */}
            {category.habitsList.length > 0 && (
              <div className="flex flex-col bg-white">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/50 border-y border-gray-200 text-[11px] font-semibold text-[#4A5565] uppercase tracking-wider">
                  <div className="col-span-1">Icon</div>
                  <div className="col-span-6">Habit Name</div>
                  <div className="col-span-3">Type</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {category.habitsList.map(habit => {
                  // Fallback: якщо у звички немає власного кольору/іконки, використовуємо категорію
                  const icon = habit.iconEmoji || category.iconEmoji;
                  const color = habit.colorHex || category.colorHex;
                  
                  return (
                    <div key={habit.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-gray-100 last:border-0 hover:bg-white/80 transition-colors">
                      <div className="col-span-1">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[20px]" style={{ backgroundColor: `${color}20`, border: `1.5px solid ${color}` }}>
                          {icon}
                        </div>
                      </div>
                      <div className="col-span-6 flex flex-col pr-4">
                        <span className="text-[14px] font-medium text-[#364153]">{habit.title}</span>
                        {habit.description && <span className="text-[11px] text-[#6A7282] mt-0.5 leading-tight">{habit.description}</span>}
                      </div>
                      <div className="col-span-3">
                        {habit.isNegative ? (
                          <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-[#FEE2E2] text-[#EF4444]">Avoid</span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-[#D1FAE5] text-[#10B981]">Build</span>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end gap-4 opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ type: 'habit', mode: 'edit', data: habit })} className="hover:text-gray-900">✏️</button>
                        <button onClick={() => handleDeleteHabit(habit.id)} className="hover:text-red-500">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-20 text-[#6A7282]">No categories or habits matched your search.</div>
        )}
      </div>

      {/* ── MODALS OVERLAY ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#F9F6EE] w-full max-w-md rounded-[16px] p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3">
              <h2 className="text-[18px] font-medium text-[#364153]">
                {modal.mode === 'add' ? 'Add New' : 'Edit'} {modal.type === 'category' ? 'Category' : 'Habit'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* CATEGORY FORM */}
            {modal.type === 'category' && (
              <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-[#4A5565]">Name *</label>
                  <input required type="text" className="px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white focus:outline-none focus:border-[#8FBC8F]" value={modal.data.name} onChange={e => setModal({...modal, data: {...modal.data, name: e.target.value}})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-[#4A5565]">Description</label>
                  <textarea rows="3" className="px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white resize-none focus:outline-none focus:border-[#8FBC8F]" value={modal.data.description || ''} onChange={e => setModal({...modal, data: {...modal.data, description: e.target.value}})} placeholder="e.g. Do the things that benefit your health..." />
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 w-1/3">
                    <label className="text-[12px] font-medium text-[#4A5565]">Emoji *</label>
                    <input required type="text" className="px-3 py-2 rounded-lg border border-gray-300 text-[16px] text-center bg-white focus:outline-none" value={modal.data.iconEmoji} onChange={e => setModal({...modal, data: {...modal.data, iconEmoji: e.target.value}})} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[12px] font-medium text-[#4A5565]">Color Hex *</label>
                    <div className="flex gap-2">
                      <input required type="color" className="w-12 h-[38px] rounded-lg border border-gray-300 cursor-pointer bg-white" value={modal.data.colorHex} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value}})} />
                      <input type="text" className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white uppercase focus:outline-none focus:border-[#8FBC8F]" value={modal.data.colorHex} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value}})} />
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-[13px] font-medium text-[#EF4444] mt-2 cursor-pointer bg-red-50/50 p-3 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                  <input type="checkbox" className="w-4 h-4 accent-red-500" checked={modal.data.isNegative} onChange={e => setModal({...modal, data: {...modal.data, isNegative: e.target.checked}})} />
                  Is this a Negative (Avoidance) Category?
                </label>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-[#C85A54] text-white text-[14px] font-medium rounded-lg shadow-sm hover:bg-[#b34d47]">Save Category</button>
                </div>
              </form>
            )}

            {/* HABIT FORM */}
            {modal.type === 'habit' && (
              <form onSubmit={handleSaveHabit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-[#4A5565]">Habit Title *</label>
                  <input required type="text" className="px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white focus:outline-none focus:border-[#8FBC8F]" value={modal.data.title} onChange={e => setModal({...modal, data: {...modal.data, title: e.target.value}})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-[#4A5565]">Category *</label>
                  <select required className="px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white focus:outline-none focus:border-[#8FBC8F]" value={modal.data.categoryId} onChange={e => setModal({...modal, data: {...modal.data, categoryId: Number(e.target.value)}})}>
                    <option value="" disabled>Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-[#4A5565]">Description <span className="font-normal text-gray-400">(Optional)</span></label>
                  <textarea rows="2" className="px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white resize-none focus:outline-none focus:border-[#8FBC8F]" value={modal.data.description || ''} onChange={e => setModal({...modal, data: {...modal.data, description: e.target.value}})} />
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 w-1/3">
                    <label className="text-[12px] font-medium text-[#4A5565]">Override Emoji</label>
                    <input type="text" className="px-3 py-2 rounded-lg border border-gray-300 text-[16px] text-center bg-white" placeholder="Default" value={modal.data.iconEmoji || ''} onChange={e => setModal({...modal, data: {...modal.data, iconEmoji: e.target.value}})} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[12px] font-medium text-[#4A5565]">Override Color Hex</label>
                    <div className="flex gap-2">
                      <input type="color" className="w-12 h-[38px] rounded-lg border border-gray-300 cursor-pointer bg-white" value={modal.data.colorHex || '#000000'} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value}})} />
                      <input type="text" className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-[14px] bg-white placeholder:text-gray-300 uppercase focus:outline-none focus:border-[#8FBC8F]" placeholder="e.g. #FF0000" value={modal.data.colorHex || ''} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value}})} />
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-[13px] font-medium text-[#EF4444] mt-2 cursor-pointer bg-red-50/50 p-3 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                  <input type="checkbox" className="w-4 h-4 accent-red-500" checked={modal.data.isNegative} onChange={e => setModal({...modal, data: {...modal.data, isNegative: e.target.checked}})} />
                  Is this a Negative (Avoidance) Habit?
                </label>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-[#8FBC8F] text-white text-[14px] font-medium rounded-lg shadow-sm hover:bg-[#7ba97b]">Save Habit</button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

    </div>
  );
};

// ─── КОМПОНЕНТ ВКЛАДКИ ACHIEVEMENTS (FIXED TO LIST) ──────────────────────────
const AchievementsTab = () => {
  const [achievements, setAchievements] = useState([]);
  const [habits, setHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState(null);

  const CONDITION_KEYS = [
    { value: 'TOTAL_METRIC_VOLUME', label: 'Total Volume', needsHabit: true },
    { value: 'POSITIVE_STREAK', label: 'Positive Streak', needsHabit: true },
    { value: 'NEGATIVE_STREAK', label: 'Negative Streak', needsHabit: true },
    { value: 'PERFECT_DAY_STREAK', label: 'Perfect Day', needsHabit: false },
    { value: 'FIRST_ACTION', label: 'First Action', needsHabit: true },
    { value: 'SYNERGY_COMBO', label: 'Synergy Combo', needsHabit: false },
    { value: 'CATEGORY_TOTAL_EXECUTIONS', label: 'Category Mastery', needsHabit: false },
    { value: 'TIME_SLOT_STREAK', label: 'Time Slot Streak', needsHabit: true },
    { value: 'ANY_X_HABITS_STREAK', label: 'Any X Habits Streak', needsHabit: false },
    { value: 'CONSISTENT_BEDTIME_STREAK', label: 'Bedtime Consistency', needsHabit: false },
    { value: 'SLEEP_DEBT_CLEARED', label: 'Sleep Debt Cleared', needsHabit: false },
    { value: 'AFFECT_STABILITY', label: 'Affect Stability', needsHabit: false },
    { value: 'AFFECT_HIGH_DOMINANCE', label: 'High Dominance (Mood)', needsHabit: false }
  ];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [achRes, habitsRes] = await Promise.all([
        api.get('/api/content/achievements').catch(() => ({ data: [] })),
        api.get('/api/content/habits').catch(() => ({ data: [] }))
      ]);
      setAchievements(achRes.data || []);
      setHabits(habitsRes.data || []);
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      title: modal.data.title,
      description: modal.data.description,
      conditionKey: modal.data.conditionKey,
      targetValue: parseInt(modal.data.targetValue),
      colorHex: modal.data.colorHex || '#8FBC8F',
      iconUrl: modal.data.iconUrl || null,
      habitId: modal.data.habitId ? parseInt(modal.data.habitId) : null
    };

    try {
      if (modal.mode === 'add') {
        await api.post('/api/content/achievements', payload);
      } else {
        await api.put(`/api/content/achievements/${modal.data.id}`, payload);
      }
      setModal(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to save achievement");
    }
  };

  const currentCondition = CONDITION_KEYS.find(k => k.value === modal?.data?.conditionKey);
  const filteredData = achievements.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) return <div className="flex justify-center p-10 text-gray-400">Loading Achievements...</div>;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      
      {/* ── HEADER ── */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="relative w-80">
          <input 
            type="text" placeholder="Search achievements..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7AB8CC]"
          />
          <span className="absolute left-3 top-2.5">🔍</span>
        </div>
        <button 
          onClick={() => setModal({ 
            mode: 'add', 
            data: { title: '', description: '', conditionKey: 'TOTAL_METRIC_VOLUME', targetValue: 1, habitId: '', colorHex: '#8FBC8F' } 
          })}
          className="bg-[#7AB8CC] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#68a3b8] shadow-sm transition-all"
        >
          Add Achievement
        </button>
      </div>

      {/* ── LIST VIEW (Вертикальний список) ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 pb-10">
        {filteredData.length > 0 ? filteredData.map(award => (
          <div 
            key={award.id} 
            className="shrink-0 bg-white/70 backdrop-blur-md p-5 rounded-xl border-2 flex gap-5 items-center shadow-sm hover:shadow-md transition-all group" 
            style={{ borderColor: `${award.colorHex}25` }}
          >
            {/* Картинка досягнення */}
            <div 
              className="w-20 h-20 rounded-xl overflow-hidden border-2 bg-gray-50 shrink-0 flex items-center justify-center shadow-inner" 
              style={{ borderColor: award.colorHex }}
            >
               {award.iconUrl ? (
                 <img src={award.iconUrl} className="w-full h-full object-cover" />
               ) : (
                 <span className="text-2xl opacity-20">🏆</span>
               )}
            </div>

            {/* Основна інформація */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-[16px] text-[#364153] truncate" style={{ color: award.colorHex }}>{award.title}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider" style={{ backgroundColor: `${award.colorHex}15`, color: award.colorHex }}>
                  Target: {award.targetValue}
                </span>
              </div>
              <p className="text-[13px] text-[#6A7282] mt-1 leading-relaxed">{award.description}</p>
              
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-[11px] bg-gray-100 px-3 py-1 rounded-full font-medium text-gray-600 border border-gray-200">
                  ⚙️ {CONDITION_KEYS.find(k => k.value === award.conditionKey)?.label || award.conditionKey}
                </span>
                {award.habitId && (
                  <span className="text-[11px] bg-[#7AB8CC]/10 px-3 py-1 rounded-full font-medium text-[#7AB8CC] border border-[#7AB8CC]/20">
                    🔗 Linked Habit ID: {award.habitId}
                  </span>
                )}
              </div>
            </div>

            {/* Кнопки дій */}
            <div className="flex gap-2">
               <button 
                onClick={() => setModal({ mode: 'edit', data: award })} 
                className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-lg"
               >✏️</button>
               <button 
                onClick={() => api.delete(`/api/content/achievements/${award.id}`).then(fetchData)} 
                className="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-lg"
               >🗑️</button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white/40 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
             No achievements matched your search criteria.
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#F9F6EE] w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-gray-200 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white/50">
              <h2 className="text-lg font-bold text-[#364153]">{modal.mode === 'add' ? '✨ Create New Achievement' : '✏️ Edit Achievement'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Achievement Title *</label>
                  <input required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#7AB8CC] outline-none bg-white" value={modal.data.title} onChange={e => setModal({...modal, data: {...modal.data, title: e.target.value}})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Display Color *</label>
                  <div className="flex gap-2">
                    <input type="color" className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer bg-white" value={modal.data.colorHex} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value}})} />
                    <input className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm uppercase" value={modal.data.colorHex} onChange={e => setModal({...modal, data: {...modal.data, colorHex: e.target.value.toUpperCase()}})} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Public Description *</label>
                <textarea required rows="2" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#7AB8CC] outline-none resize-none bg-white" value={modal.data.description} onChange={e => setModal({...modal, data: {...modal.data, description: e.target.value}})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Condition Logic *</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-[#7AB8CC] bg-white outline-none" value={modal.data.conditionKey} onChange={e => setModal({...modal, data: {...modal.data, conditionKey: e.target.value, habitId: ''}})}>
                    {CONDITION_KEYS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Target Value *</label>
                  <input required type="number" min="1" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 outline-none text-center font-bold bg-white" value={modal.data.targetValue} onChange={e => setModal({...modal, data: {...modal.data, targetValue: e.target.value}})} />
                </div>
              </div>

              {currentCondition?.needsHabit && (
                <div className="space-y-1 p-4 bg-[#7AB8CC]/5 rounded-xl border-2 border-dashed border-[#7AB8CC]/30">
                  <label className="text-xs font-bold text-[#7AB8CC] uppercase">Link to Specific Habit</label>
                  <select required className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white outline-none" value={modal.data.habitId || ''} onChange={e => setModal({...modal, data: {...modal.data, habitId: e.target.value}})}>
                    <option value="">-- Apply Globally (Any Habit) --</option>
                    {habits.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Icon Image URL</label>
                <div className="flex gap-3 items-center">
                   <input className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#7AB8CC] outline-none bg-white" placeholder="https://path-to-image.png" value={modal.data.iconUrl || ''} onChange={e => setModal({...modal, data: {...modal.data, iconUrl: e.target.value}})} />
                   {modal.data.iconUrl && <img src={modal.data.iconUrl} className="w-10 h-10 rounded-lg border object-cover" onError={(e) => e.target.style.display='none'} />}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 sticky bottom-0 bg-[#F9F6EE] py-2">
                <button type="button" onClick={() => setModal(null)} className="px-6 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-10 py-2.5 bg-[#7AB8CC] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#7AB8CC]/20 hover:bg-[#68a3b8]">
                  Save Achievement
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// ─── ГОЛОВНИЙ КОМПОНЕНТ (LAYOUT) ─────────────────────────────────────────────
const ContentManagerView = () => {
  const [activeTab, setActiveTab] = useState('proposals');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-[#F9F6EE] overflow-hidden w-full font-sans">
      
      {/* ── SIDEBAR ── */}
      <div className="w-[256px] bg-white/60 border-r border-gray-200/60 flex flex-col z-30 shrink-0 shadow-sm">
        
        {/* Back Button */}
        <div className="p-4 border-b border-gray-200/60">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-2 bg-[#8FBC8F] text-white py-2.5 rounded-[10px] shadow-sm hover:bg-[#7ba97b] transition-colors font-medium text-[14px]"
          >
            <span>←</span> Back to App (Habits)
          </button>
        </div>

        {/* Brand Info */}
        <div className="px-6 py-6 border-b border-gray-200/60">
          <h1 className="text-[24px] text-[#364153] mb-1">和 Harmony</h1>
          <p className="text-[12px] text-[#6A7282]">Content Manager</p>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 py-6 flex flex-col gap-2 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-3 px-4 py-3 rounded-[10px] w-full transition-colors ${activeTab === 'achievements' ? 'bg-[#8FBC8F]/10' : 'hover:bg-gray-100/50'}`}
          >
            <span className="text-[20px]">🏆</span>
            <span className={`text-[14px] font-medium ${activeTab === 'achievements' ? 'text-[#8FBC8F]' : 'text-[#4A5565]'}`}>Achievements Database</span>
          </button>

          <button 
            onClick={() => setActiveTab('habits')}
            className={`flex items-center gap-3 px-4 py-3 rounded-[10px] w-full transition-colors ${activeTab === 'habits' ? 'bg-[#8FBC8F]/10' : 'hover:bg-gray-100/50'}`}
          >
            <span className="text-[20px]">📜</span>
            <span className={`text-[14px] font-medium ${activeTab === 'habits' ? 'text-[#8FBC8F]' : 'text-[#4A5565]'}`}>Habits Database</span>
          </button>

          <button 
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-3 px-4 py-3 rounded-[10px] w-full transition-colors ${activeTab === 'proposals' ? 'bg-[#8FBC8F]/10' : 'hover:bg-gray-100/50'}`}
          >
            <span className="text-[20px]">📐</span>
            <span className={`text-[14px] font-medium ${activeTab === 'proposals' ? 'text-[#8FBC8F]' : 'text-[#4A5565]'}`}>Proposals</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200/60 flex flex-col items-center gap-3">
          <button onClick={logout} className="text-[11px] text-garnet underline hover:text-red-700 transition-colors">Sign Out</button>
          <span className="text-[10px] text-[#99A1AF] tracking-wider uppercase">v1.0.0 - Admin Panel</span>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="h-[101px] bg-white/60 border-b border-gray-200/60 px-8 py-6 flex justify-between items-center shrink-0 shadow-sm">
          <div>
            <h2 className="text-[24px] text-[#364153]">
              {activeTab === 'proposals' && 'Analyst Proposals'}
              {activeTab === 'habits' && 'Habits Database'}
              {activeTab === 'achievements' && 'Achievements Database'}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[12px]">
              <span className="text-[#6A7282]">Dashboard</span>
              <span className="text-[#6A7282]">/</span>
              <span className="text-[#364153] font-medium capitalize">{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[14px] font-medium text-[#364153]">{user?.name || 'Content Manager'}</span>
              <span className="text-[12px] text-[#6A7282]">Imperial Content Overseer</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#8FBC8F] to-[#7AB8CC] flex items-center justify-center text-white font-medium shadow-sm">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>

        {/* Dynamic Tab Content */}
        <div className="flex-1 overflow-hidden p-8">
          {activeTab === 'proposals' && <ProposalsTab />}
          {activeTab === 'habits' && <HabitsTab />}
          {activeTab === 'achievements' && <AchievementsTab />}
        </div>

      </div>
    </div>
  );
};

export default ContentManagerView;
