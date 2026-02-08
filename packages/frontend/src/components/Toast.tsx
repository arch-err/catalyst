import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type?: Toast['type']) => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'error') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${
            toast.type === 'error'
              ? 'bg-destructive text-destructive-foreground'
              : toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
