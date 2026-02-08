import { create } from 'zustand';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));
