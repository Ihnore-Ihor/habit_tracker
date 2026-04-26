import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL || 'https://localhost:7152';

export const TOKEN_STORAGE_KEY = 'harmony.token';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      // Soft redirect; the AuthContext also reacts via storage events.
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/auth')
      ) {
        window.location.assign('/auth/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
