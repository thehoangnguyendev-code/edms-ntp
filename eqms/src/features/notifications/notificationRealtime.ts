import { useEffect } from 'react';
import { secureStorage } from '@/utils/security';
import { authTokenStore } from '@/services/authTokenStore';
import { emitNotificationsChanged } from './events';

const STREAM_ENDPOINT = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/notifications/stream`;

type RealtimeListener = (event: { type: string; data: string }) => void;

const listeners = new Set<RealtimeListener>();
let activeCount = 0;
let abortController: AbortController | null = null;
let reconnectTimer: number | null = null;
let reconnectDelay = 1000;

const getAccessToken = () => authTokenStore.get() ?? secureStorage.getItem('authToken');

const clearReconnectTimer = () => {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (activeCount === 0) {
    return;
  }
  clearReconnectTimer();
  reconnectTimer = window.setTimeout(() => {
    void connectStream();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 15000);
};

const parseSseBlock = (block: string) => {
  const lines = block.split(/\r?\n/);
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return { type: eventType, data: dataLines.join('\n') };
};

const notifyListeners = (event: { type: string; data: string }) => {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('Failed to process notification realtime event', error);
    }
  }
};

const connectStream = async () => {
  if (activeCount === 0) {
    return;
  }

  const token = getAccessToken();
  if (!token) {
    scheduleReconnect();
    return;
  }

  clearReconnectTimer();
  abortController?.abort();
  abortController = new AbortController();
  reconnectDelay = 1000;

  try {
    const response = await fetch(STREAM_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: abortController.signal,
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      if (response.status !== 401) {
        scheduleReconnect();
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let closedCleanly = false;
    while (activeCount > 0) {
      const { done, value } = await reader.read();
      if (done) {
        closedCleanly = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf('\n\n');
      while (delimiterIndex !== -1) {
        const block = buffer.slice(0, delimiterIndex).trim();
        buffer = buffer.slice(delimiterIndex + 2);
        if (block) {
          const event = parseSseBlock(block);
          if (event.type === 'notification-updated') {
            emitNotificationsChanged();
          }
          notifyListeners(event);
        }
        delimiterIndex = buffer.indexOf('\n\n');
      }
    }
    // The server bounds each SSE connection's lifetime (see NotificationRealtimeService) and
    // closes it cleanly (no error) once that's reached, so a clean close must still reconnect —
    // otherwise real-time notifications would silently stop after the server-side timeout elapses.
    if (closedCleanly && activeCount > 0 && !abortController?.signal.aborted) {
      scheduleReconnect();
    }
  } catch (error) {
    if (activeCount > 0 && !abortController?.signal.aborted) {
      scheduleReconnect();
    }
  }
};

export const subscribeNotificationRealtime = (listener: RealtimeListener) => {
  listeners.add(listener);
  activeCount += 1;

  if (activeCount === 1) {
    void connectStream();
  }

  return () => {
    listeners.delete(listener);
    activeCount = Math.max(activeCount - 1, 0);
    if (activeCount === 0) {
      abortController?.abort();
      abortController = null;
      clearReconnectTimer();
    }
  };
};

export const useNotificationRealtime = () => {
  // Hook intentionally subscribes to a no-op listener to keep one global stream alive.
  useEffect(() => {
    const unsubscribe = subscribeNotificationRealtime(() => undefined);
    return unsubscribe;
  }, []);
};
