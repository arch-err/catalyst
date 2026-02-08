import { useConnectionStore } from '@/stores/connection';

export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status);

  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
  };

  const labels = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
  };

  return (
    <div className="flex items-center gap-2" title={labels[status]}>
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
    </div>
  );
}
