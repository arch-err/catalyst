import { create } from 'zustand';

interface AuthState {
  authenticated: boolean;
  checking: boolean;
  error: string | null;
  check: () => Promise<void>;
  login: (secret: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false,
  checking: true,
  error: null,

  check: async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      set({ authenticated: data.data?.authenticated ?? false, checking: false });
    } catch {
      set({ authenticated: false, checking: false });
    }
  },

  login: async (secret: string) => {
    set({ error: null });
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (data.ok) {
        set({ authenticated: true });
        return true;
      }
      set({ error: data.error || 'Login failed' });
      return false;
    } catch {
      set({ error: 'Network error' });
      return false;
    }
  },

  logout: async () => {
    await fetch('/api/logout', { method: 'POST' });
    set({ authenticated: false });
  },
}));
