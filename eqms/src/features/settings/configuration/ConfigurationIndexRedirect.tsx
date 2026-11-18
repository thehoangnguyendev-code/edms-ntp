import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { CONFIGURATION_PAGES, configurationPathForLegacyTab } from './configurationPages';

/**
 * /settings/configuration is a menu group, not a page. Its old address (also kept in notifications that were sent earlier) leads to the page it meant:
 * ?tab=<old tab> goes to that tab's page, and no tab (or an unknown one) goes to the first page. A person who may not open that page goes to the first page they may open (V806:
 * each page has its own View permission).
 */
export const ConfigurationIndexRedirect: React.FC = () => {
  const { search } = useLocation();
  const { hasPermissionAlias } = usePermissions();
  const wanted = configurationPathForLegacyTab(new URLSearchParams(search).get('tab'));
  const mayOpen = (path: string) => CONFIGURATION_PAGES.some((page) => page.path === path && hasPermissionAlias(page.viewPermission));
  const target = mayOpen(wanted) ? wanted : (CONFIGURATION_PAGES.find((page) => hasPermissionAlias(page.viewPermission))?.path ?? wanted);
  return <Navigate to={target} replace />;
};
