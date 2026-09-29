import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // In Docker, browser requests stay on the frontend origin and Vite forwards
        // them across the internal compose network. This avoids coupling a user's
        // browser to the host-published backend port while retaining the same /api
        // routes, authentication headers, and server-side authorization checks.
        proxy: {
          '/api': {
            target: env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      optimizeDeps: {
        include: [
          'react',
          'react/jsx-runtime',
          'react-dom',
          'react-dom/client',
          'react-router',
          'react-router-dom',
          // Lexical — all packages use React hooks, must share the same instance
          'lexical',
          '@lexical/react/LexicalComposer',
          '@lexical/react/LexicalRichTextPlugin',
          '@lexical/react/LexicalContentEditable',
          '@lexical/react/LexicalHistoryPlugin',
          '@lexical/react/LexicalOnChangePlugin',
          '@lexical/react/LexicalComposerContext',
          '@lexical/react/LexicalLinkPlugin',
          '@lexical/react/LexicalListPlugin',
          '@lexical/react/LexicalMarkdownShortcutPlugin',
          '@lexical/html',
          '@lexical/link',
          '@lexical/list',
          '@lexical/code',
          '@lexical/markdown',
          '@lexical/rich-text',
          '@lexical/selection',
          '@lexical/table',
          // Animation — both packages must share React
          'framer-motion',
          'motion',
          // Stamp/watermark drag-resize-rotate editor (Controlled Copies Policy)
          'konva',
          'react-konva',
          // EmbedPDF local WASM viewer (served from this application's Docker image)
          '@embedpdf/react-pdf-viewer',
          // Icons
          'lucide-react',
          '@tabler/icons-react',
          // Other React-consuming packages
          'recharts',
          'respinner',
          'qrcode.react',
        ],
      },
      resolve: {
        alias: [
          { find: '@', replacement: path.resolve(__dirname, './src') },
          { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime.js') },
          { find: 'react-dom/client', replacement: path.resolve(__dirname, 'node_modules/react-dom/client.js') },
          { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom') },
          { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react') },
        ],
        dedupe: [
          'react',
          'react-dom',
          'react-router',
          'react-router-dom',
          'framer-motion',
          'motion',
          'lexical',
        ],
      },
      build: {
        chunkSizeWarningLimit: 600,
        rollupOptions: {
          output: {
            manualChunks: {
              // Core React runtime
              'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-router'],
              // recharts is intentionally NOT listed: forcing it into a named chunk made the entry chunk
              // import it (through shared helper modules), so every page paid for ~350 kB of charts that
              // only the lazy Dashboard uses.
              // Animation library
              'vendor-framer': ['framer-motion'],
              // PDF viewer. Its PDFium WASM worker is emitted as a local Vite asset.
              'vendor-pdf': ['@embedpdf/react-pdf-viewer'],
              // Icons
              'vendor-icons': ['lucide-react', '@tabler/icons-react'],
            },
          },
        },
      },
    };
});
