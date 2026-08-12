import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_CONFIG, findNodeAndBreadcrumbs, findNodeByPath } from '@/app/constants';
import { BreadcrumbItem, NavItem } from '@/types';

/**
 * Helper function to find nav item by ID
 * Extracted outside hook for performance (no recreation on each render)
 */
const findItemById = (items: NavItem[], targetId: string): NavItem | null => {
  for (const item of items) {
    if (item.id === targetId) return item;
    if (item.children) {
      const found = findItemById(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Custom hook to manage navigation state and actions
 * Optimized with extracted helper for better performance
 */
export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Find nav item by path
  const activeItem = findNodeByPath(NAV_CONFIG, location.pathname);
  // If not found, fallback to empty string (forces sidebar to re-render)
  const activeId = activeItem?.id || '';

  // Derive breadcrumbs from activeId
  const breadcrumbs: BreadcrumbItem[] = findNodeAndBreadcrumbs(NAV_CONFIG, activeId) || [
    { label: 'Dashboard', id: 'dashboard' },
  ];

  const handleNavigate = (id: string) => {
    const item = findItemById(NAV_CONFIG, id);
    if (item?.path) {
      // Always navigate with absolute path
      const targetPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
      navigate(targetPath);
    }
  };

  return {
    activeId,
    breadcrumbs,
    handleNavigate,
  };
};
