import { useEffect, useRef, useCallback, useState } from 'react';
import type { WsClientMessage, WsServerMessage } from '@catalyst/shared';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketOptions {
  onMessage: (msg: WsServerMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const retriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setStatus('connected');
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        // skip
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  const send = useCallback((msg: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { send, status };
}
