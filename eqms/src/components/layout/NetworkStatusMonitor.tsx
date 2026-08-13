import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from '@/i18n';

export const NetworkStatusMonitor: React.FC = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineModal(false);
      setShowReconnectedToast(true);
      
      // Auto-hide reconnected toast after 3 seconds
      setTimeout(() => {
        setShowReconnectedToast(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineModal(true);
      setShowReconnectedToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOfflineModal(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Offline Modal */}
      {showOfflineModal && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-200" />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
              {/* Header */}
              <div className="flex items-center gap-4 p-6 border-b border-slate-200">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <WifiOff className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t('network.offlineTitle')}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t('network.connectionLost')}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">
                    {t('network.offlineMessage')}
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1.5 ml-4 list-disc">
                    <li>{t('network.checkWifi')}</li>
                    <li>{t('network.disableAirplaneMode')}</li>
                    <li>{t('network.checkRouter')}</li>
                  </ul>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    {t('network.waiting')}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 rounded-b-xl">
                <p className="text-xs text-slate-500 text-center">
                  {t('network.autoClose')}
                </p>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Reconnected Toast */}
      {showReconnectedToast && createPortal(
        <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-white rounded-lg border border-emerald-200 px-4 py-3 flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Wifi className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {t('network.restoredTitle')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('network.restoredMessage')}
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
