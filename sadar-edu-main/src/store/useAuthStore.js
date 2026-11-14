import { create } from 'zustand';
import { api } from '../lib/api';

const KEY = 'sadaredu_auth';

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && raw.token && raw.user ? raw : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
};
const save = (state) => {
  try {
    if (state.token) localStorage.setItem(KEY, JSON.stringify({ token: state.token, user: state.user }));
    else localStorage.removeItem(KEY);
  } catch {
    /* penyimpanan tidak tersedia */
  }
};

const initial = load();

export const roleHome = (role) => (String(role).toLowerCase() === 'operator' ? '/operator/dataset' : '/stakeholder/dashboard');

export const useAuthStore = create((set) => ({
  token: initial.token,
  user: initial.user, // { id_user, nama, email, role: 'Stakeholder' | 'Operator' }
  isAuthenticated: Boolean(initial.token),

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const next = { token: res.token, user: res.user };
    save(next);
    set({ ...next, isAuthenticated: true });
    return res.user;
  },

  logout: () => {
    save({ token: null, user: null });
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
