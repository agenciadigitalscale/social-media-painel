import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { execSync } from 'child_process'

/**
 * O commit que originou este build, carimbado no HTML.
 *
 * Existe porque comparar o NOME dos arquivos não serve para responder "subiu
 * mesmo?": medido em 2026-09-02, o build do Cloudflare e o build local geram
 * hashes DIFERENTES para o mesmo código — então nome diferente não prova nada,
 * e a conferência dava alarme falso. O commit é igual nos dois, venha o build
 * de onde vier.
 *
 * No Cloudflare Pages vem pronto em `CF_PAGES_COMMIT_SHA`; fora dele, do git.
 * Falha vira 'desconhecido' em vez de derrubar o build — carimbo é diagnóstico,
 * não requisito para o app funcionar.
 */
function commitDoBuild(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 40)
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'desconhecido'
  }
}

/** Injeta <meta name="ds-build"> para o `verify-deploy` ler da URL pública. */
function carimboDeBuild() {
  const commit = commitDoBuild()
  return {
    name: 'ds-carimbo-de-build',
    transformIndexHtml(html: string) {
      return html.replace(
        '</head>',
        `  <meta name="ds-build" content="${commit}" />\n  </head>`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), carimboDeBuild()],
  resolve: {
    // Garante uma única cópia do React no dev (framer-motion pré-bundlava a sua própria)
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mui': ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
          'vendor-icons': ['@mui/icons-material'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
