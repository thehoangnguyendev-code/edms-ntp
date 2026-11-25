# Loading UI components

Source: https://github.com/turbostarter/loading-ui/tree/main/src/registry/components/loading-ui
Documentation: https://www.loading-ui.com/docs/usage
License: MIT, copyright Bartosz Zagrodzki, included in LICENSE.md.

The 22 compact components are copied using the documented manual installation
method. No additional runtime dependency is needed for these components.

Local adaptations: use the existing `cn` helper, import React types, collect the
original keyframes into one stylesheet, and use inline-compatible span markup.
The shared adapter supplies size, currentColor, accessibility and a static
reduced-motion fallback. No CDN request is made while loading application data.
