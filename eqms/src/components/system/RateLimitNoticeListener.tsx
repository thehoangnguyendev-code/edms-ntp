import { useEffect, useRef } from 'react';
import { RATE_LIMITED_EVENT } from '@/services/api/client';
import { useToast } from '@/components/ui/toast/Toast';
import { useTranslation } from '@/i18n';

const NOTICE_DEBOUNCE_MS = 5_000;

/** Surfaces a clear, distinct notice when the API rate limiter (429) rejects a request,
 *  instead of letting each screen show its own generic "failed to load" message. */
export const RateLimitNoticeListener = () => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const lastShownAt = useRef(0);

  useEffect(() => {
    const handleRateLimited = (event: Event) => {
      const now = Date.now();
      if (now - lastShownAt.current < NOTICE_DEBOUNCE_MS) return;
      lastShownAt.current = now;

      const retryAfterSeconds = (event as CustomEvent<{ retryAfterSeconds?: number }>).detail?.retryAfterSeconds;
      const waitMessage = retryAfterSeconds
        ? t('rateLimit.waitSeconds', { seconds: retryAfterSeconds })
        : t('rateLimit.waitMoment');

      showToast({
        type: 'error',
        title: t('rateLimit.title'),
        message: `${t('rateLimit.description')} ${waitMessage}`,
        duration: 5000,
      });
    };

    window.addEventListener(RATE_LIMITED_EVENT, handleRateLimited);
    return () => window.removeEventListener(RATE_LIMITED_EVENT, handleRateLimited);
  }, [showToast, t]);

  return null;
};
