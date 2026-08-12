/**
 * App Providers
 * Combines all context providers for the app
 */

import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { BreadcrumbProvider } from './BreadcrumbContext';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BreadcrumbProvider>
          {children}
        </BreadcrumbProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
