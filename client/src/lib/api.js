import axios from 'axios';

const TOKEN_KEY = 'shortlist.token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api`, timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (status === 401 && !isAuthCall) onUnauthorized();
    return Promise.reject(err);
  },
);

// Turns any axios error into { message, fields } for forms and toasts.
export function parseError(err) {
  if (!err.response) return { message: err.code === 'ECONNABORTED' ? 'The request timed out. Try again.' : 'Cannot reach the server. Check your connection.', fields: {} };
  const data = err.response.data?.error || {};
  const fields = {};
  (data.details || []).forEach((d) => { if (d.field && !fields[d.field]) fields[d.field] = d.message; });
  return { message: data.message || 'Something went wrong', fields, status: err.response.status };
}
