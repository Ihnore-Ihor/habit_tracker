import api from './client.js';
import { endpoints } from './endpoints.js';

export const logAffect = (payload) => 
  api.post('/api/affect', payload).then((r) => r.data);

// Тепер приймаємо рядок дати, наприклад "2026-04-28"
export const fetchDailyAffect = (dateStr) => 
  api.get(`/api/affect/daily?date=${dateStr}`).then((r) => r.data);

export const fetchAffectSummary = (dateStr) => 
  api.get(`/api/affect/daily/summary?date=${dateStr}`).then((r) => r.data);
