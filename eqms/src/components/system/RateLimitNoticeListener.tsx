import { useEffect, useRef } from 'react';
import { RATE_LIMITED_EVENT } from '@/services/api/client';
import { useToast } from '@/components/ui/toast/Toast';

const NOTICE_DEBOUNCE_MS = 5_000;

/** Surfaces a clear, distinct notice when the API rate limiter (429) rejects a request,
 *  instead of letting each screen show its own generic "failed to load" message. */
export const RateLimitNoticeListener = () => {
  const { showToast } = useToast();
  const lastShownAt = useRef(0);

  useEffect(() => {
    const handleRateLimited = (event: Event) => {
      const now = Date.now();
      if (now - lastShownAt.current < NOTICE_DEBOUNCE_MS) return;
      lastShownAt.current = now;

      const retryAfterSeconds = (event as CustomEvent<{ retryAfterSeconds?: number }>).detail?.retryAfterSeconds;
      const waitMessage = retryAfterSeconds
        ? `Please wait about ${retryAfterSeconds} second(s) and try again.`
        : 'Please wait a moment and try again.';

      showToast({
        type: 'error',
        title: 'Too many requests',
        message: `You've made too many requests in a short time. ${waitMessage}`,
        duration: 5000,
      });
    };

    window.addEventListener(RATE_LIMITED_EVENT, handleRateLimited);
    return () => window.removeEventListener(RATE_LIMITED_EVENT, handleRateLimited);
  }, [showToast]);

  return null;
};
