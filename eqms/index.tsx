import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { UnsavedChangesPopGuard } from './src/components/navigation/UnsavedChangesPopGuard';
import App from './src/app/App';
import { AppProviders } from './src/contexts';
import { PwaBranding } from './src/components/branding/PwaBranding';
import { ReadonlyFocusIndicator } from './src/components/ui/form/ReadonlyFocusIndicator';

// Import Global Styles
import './src/styles/globals.css';
import './src/styles/utilities.css';

// After a new deployment the hashed chunk a lazy route points at may no longer exist, which would leave a
// blank screen. Reload once to pick up the new index.html; the flag stops a reload loop if the chunk is
// genuinely unreachable (then the error boundary shows its fallback).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'eqms.chunkReloadedAt';
  try {
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(key, String(Date.now()));
      event.preventDefault();
      window.location.reload();
    }
  } catch {
    // sessionStorage unavailable: let the error surface to the error boundary.
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// A data router (not <BrowserRouter>) so that the browser's Back button can be intercepted while a screen holds unsaved changes (useBlocker, UnsavedChangesPopGuard).
// One splat route holds the whole app; the route tree stays in AppRoutes (<Routes>), unchanged.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AppProviders>
        <PwaBranding />
        <ReadonlyFocusIndicator />
        <UnsavedChangesPopGuard />
        <App />
      </AppProviders>
    ),
  },
]);

root.render(<RouterProvider router={router} />);
