import { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, NavigateOptions } from 'react-router-dom';

export interface UseNavigateWithLoadingReturn {
  /** Whether a navigation is in progress (show FullPageLoading when true) */
  isNavigating: boolean;
  /**
   * Navigate to a route after a brief loading delay.
   * @param to      Route path or delta (same signature as react-router navigate)
   * @param options NavigateOptions (replace, state, etc.)
   * @param delay   Loading animation duration in ms (default: 600)
   */
  navigateTo: (to: string | number, options?: NavigateOptions, delay?: number) => void;
  navigateToPrepared: <TState = unknown>(
    to: string | number,
    prepare: () => Promise<TState>,
    options?: NavigateOptions,
  ) => Promise<TState>;
}

/**
 * Centralizes the "show loading overlay → navigate" pattern that was
 * copy-pasted in ~20 feature views.
 *
 * @example
 * ```tsx
 * const { navigateTo, isNavigating } = useNavigateWithLoading();
 *
 * // Trigger navigation
 * <Button onClick={() => navigateTo(ROUTES.SETTINGS.USERS)}>Back</Button>
 *
 * // Render overlay
 * {isNavigating && <FullPageLoading text="Loading..." />}
 * ```
 */
export function useNavigateWithLoading(): UseNavigateWithLoadingReturn {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const navigateTo = useCallback(
    (to: string | number, options?: NavigateOptions, delay = 600) => {
      setIsNavigating(true);

      timeoutRef.current = setTimeout(() => {
        if (typeof to === 'number') {
          navigate(to);
        } else {
          navigate(to, options);
        }
        setIsNavigating(false);
      }, delay);
    },
    [navigate]
  );

  const navigateToPrepared = useCallback(
    async <TState = unknown>(
      to: string | number,
      prepare: () => Promise<TState>,
      options?: NavigateOptions,
    ) => {
      setIsNavigating(true);

      try {
        const preparedState = await prepare();
        if (typeof to === "number") {
          navigate(to);
        } else {
          navigate(to, {
            ...options,
            state:
              preparedState === undefined
                ? options?.state
                : {
                    ...(options?.state as Record<string, unknown> | undefined),
                    ...((preparedState as Record<string, unknown>) || {}),
                  },
          });
        }
        setIsNavigating(false);
        return preparedState;
      } catch (error) {
        setIsNavigating(false);
        throw error;
      }
    },
    [navigate],
  );

  return { isNavigating, navigateTo, navigateToPrepared };
}
