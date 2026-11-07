import { useLayoutEffect } from 'react';
import { useBranding } from './BrandLogo';
import { isMenuColor } from '@/config/menu-colors';
import './menu-colors.css';

/** Puts the administrator's dropdown-menu colours on the page, for every user: see menu-colors.css. */
export function MenuColorStyles() {
  const { menuTextColor, menuIconColor } = useBranding();
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isMenuColor(menuTextColor)) { root.dataset.menuTextColor = 'custom'; root.style.setProperty('--menu-text-color', menuTextColor); }
    else { delete root.dataset.menuTextColor; root.style.removeProperty('--menu-text-color'); }
    if (isMenuColor(menuIconColor)) { root.dataset.menuIconColor = 'custom'; root.style.setProperty('--menu-icon-color', menuIconColor); }
    else { delete root.dataset.menuIconColor; root.style.removeProperty('--menu-icon-color'); }
    return () => { delete root.dataset.menuTextColor; delete root.dataset.menuIconColor; root.style.removeProperty('--menu-text-color'); root.style.removeProperty('--menu-icon-color'); };
  }, [menuTextColor, menuIconColor]);
  return null;
}
