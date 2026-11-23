import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { systemHealthApi, type DependencyStatus } from '@/services/api/systemHealth';
import { tr } from "@/i18n";

const POLL_MS = 30000;
const DISMISSED_KEY = 'eqms.serviceStatus.dismissed';

/** The parts of the application itself (icons, charts, the PDF viewer, pages) are files of the build, loaded on demand: when the server cannot give one of them, say so. */
const APP_FILES: DependencyStatus = {
  code: 'APP_FILES',
  name: 'Application files',
  status: 'DOWN',
  impact: 'Some pages, icons, charts or the PDF viewer could not be loaded. Reload the page; if it comes again, the application is being updated or the server is not reachable.',
  checkedAt: '',
};
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

const readDismissed = () => {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) ?? '';
  } catch {
    return '';
  }
};
const writeDismissed = (value: string) => {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, value);
  } catch {
    // the choice is only remembered for this tab; without storage the dialog just asks again
  }
};

/**
 * Warns when a service behind the screens stops answering (virus scanner, document storage, Office document server, chart renderer) or when a part of the application cannot be
 * loaded, in the same dialog as the lost network connection. It is asked every 30 s and when the tab or the network comes back. Unlike a lost network it does not block the work
 * (one service down does not stop the rest): "Continue working" hides it, and it comes back only when a different set of services is down. It closes by itself when all answer.
 */
export const ServiceStatusMonitor: React.FC = () => {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [appFilesFailed, setAppFilesFailed] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [checking, setChecking] = useState(false);
  const [restored, setRestored] = useState(false);
  const hadProblem = useRef(false);

  const down = [...dependencies.filter((item) => item.status === 'DOWN'), ...(appFilesFailed ? [APP_FILES] : [])];
  const key = down.map((item) => item.code).sort().join(',');

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setDependencies(await systemHealthApi.getDependencies());
    } catch {
      // the question itself failed (the network, maintenance, a restart): that is not an answer about the services, so what is shown stays as it was
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      if (navigator.onLine && !document.hidden) void check();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden && navigator.onLine) void check();
    };
    const onOnline = () => void check();
    const onPreloadError = () => setAppFilesFailed(true);
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
      if (CHUNK_ERROR.test(message)) setAppFilesFailed(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('vite:preloadError', onPreloadError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('vite:preloadError', onPreloadError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [check]);

  // everything answers again: say so once
  useEffect(() => {
    if (down.length > 0) {
      hadProblem.current = true;
      return undefined;
    }
    if (!hadProblem.current) return undefined;
    hadProblem.current = false;
    setDismissed('');
    writeDismissed('');
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), 4000);
    return () => window.clearTimeout(timer);
  }, [down.length]);

  const open = down.length > 0 && dismissed !== key;
  const onlyAppFiles = down.length > 0 && down.every((item) => item.code === APP_FILES.code);

  return (
    <>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9996] animate-in fade-in duration-200" />
            <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4">
              <div role="alertdialog" aria-modal="true" aria-labelledby="service-status-title" className="bg-white rounded-xl border border-slate-200 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center gap-4 p-6 border-b border-slate-200">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <ServerCrash className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 id="service-status-title" className="text-lg font-semibold text-slate-900">
                      {down.length === 1 ? 'A service is not available' : 'Some services are not available'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">{tr("Part of the system may not work")}</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <ul className="space-y-3">
                    {down.map((item) => (
                      <li key={item.code} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-600">{item.impact}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-slate-700">{tr("Waiting for the service to come back...")}</span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 rounded-b-xl">
                  <div className="flex flex-wrap justify-end gap-2">
                    {onlyAppFiles ? (
                      <Button size="sm" variant="default" onClick={() => window.location.reload()}>
                        {tr("Reload Page")}
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" disabled={checking} onClick={() => void check()}>
                          {tr("Check Again")}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setDismissed(key);
                            writeDismissed(key);
                          }}
                        >
                          {tr("Continue Working")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}

      {restored &&
        createPortal(
          <div className="fixed top-4 right-4 z-[9997] animate-in slide-in-from-top-2 fade-in duration-300" role="status">
            <div className="bg-white rounded-lg border border-emerald-200 px-4 py-3 flex items-center gap-3 min-w-[300px]">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{tr("Services Restored")}</p>
                <p className="text-xs text-slate-500 mt-0.5">{tr("Everything is available again")}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
