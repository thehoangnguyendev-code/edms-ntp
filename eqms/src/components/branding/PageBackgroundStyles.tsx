import { useLayoutEffect } from 'react';
import { useBranding } from './BrandLogo';
import { pageBackgroundCss } from '@/config/page-background';
import './page-background.css';

export function PageBackgroundStyles() {
  const { mainBackground, authBackground } = useBranding();
  const main = pageBackgroundCss(mainBackground);
  const auth = pageBackgroundCss(authBackground);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (main) { root.dataset.mainBackground = 'custom'; root.style.setProperty('--main-page-background', main); }
    else { delete root.dataset.mainBackground; root.style.removeProperty('--main-page-background'); }
    if (auth) { root.dataset.authBackground = 'custom'; root.style.setProperty('--auth-page-background', auth); }
    else { delete root.dataset.authBackground; root.style.removeProperty('--auth-page-background'); }
    return () => { delete root.dataset.mainBackground; delete root.dataset.authBackground; root.style.removeProperty('--main-page-background'); root.style.removeProperty('--auth-page-background'); };
  }, [main, auth]);
  return null;
}
