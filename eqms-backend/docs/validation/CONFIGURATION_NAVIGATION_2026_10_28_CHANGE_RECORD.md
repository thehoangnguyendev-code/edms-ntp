# Configuration navigation loading — 2026-10-28

Request: reduce the delay after selecting Configuration in the sidebar.

Source-confirmed findings: the Configuration route imported the Settings barrel, whose static re-exports include unrelated settings and administration views. ConfigurationView also eagerly imported all of its tab components, including the storage chart and integration editors. While its initial API request was pending, it rendered only a full-page loading portal.

Change: the route imports ConfigurationView directly; tab components are loaded through React.lazy with a section-level Suspense fallback. The page header and tab navigation render while the configuration API is pending. API calls, permissions, configuration values and save handlers are unchanged.

GitNexus: ConfigurationView reports LOW with zero indexed upstream callers/flows. The route target was not found, so no risk inference is made for that missing result; its direct route declaration was inspected.

Evidence: frontend TypeScript check and production build passed. Three focused test files passed (7 tests), including a deferred API response that checks immediate page-shell rendering, loading the selected tab only, switching to Security and retaining a single configuration request. The frontend Docker image was rebuilt and only the frontend container recreated. HTTP localhost:3000 returned 200, and the running container contains the new direct import and lazy tab declarations.

Limitations: no authenticated browser timing or end-to-end performance improvement measurement was obtained. The browser chosen for verification had no open authenticated tab. This record does not claim a specific latency reduction or GMP compliance.
