import React from 'react';
import { AppRoutes } from './AppRoutes';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SystemLocalizationLoader } from '@/components/localization/SystemLocalizationLoader';
import { BrowserNotificationBridge } from '@/components/notifications/BrowserNotificationBridge';
import { RateLimitNoticeListener } from '@/components/system/RateLimitNoticeListener';

const App: React.FC = () => {

  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <SystemLocalizationLoader />
          <RateLimitNoticeListener />
          <BrowserNotificationBridge />
          <AppRoutes />
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

export default App;
