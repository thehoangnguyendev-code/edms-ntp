import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
          // PDF viewer
          '@react-pdf-viewer/core',
          '@react-pdf-viewer/default-layout',
          '@react-pdf-viewer/page-navigation',
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
              // Charting library
              'vendor-recharts': ['recharts'],
              // Animation library
              'vendor-framer': ['framer-motion'],
              // PDF viewer
              'vendor-pdf': ['@react-pdf-viewer/core', '@react-pdf-viewer/default-layout', 'pdfjs-dist'],
              // Icons
              'vendor-icons': ['lucide-react', '@tabler/icons-react'],
            },
          },
        },
      },
    };
});
