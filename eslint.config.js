import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Enxuto de propósito.
 *
 * O projeto tem 66 mil linhas escritas sem lint nenhum — ligar o preset inteiro
 * cospe milhares de avisos de estilo e ninguém olha o resultado, que é o mesmo
 * que não ter lint. Aqui ficam só as regras que apontam DEFEITO:
 *
 * - `rules-of-hooks`: hook chamado condicionalmente quebra o React de verdade.
 * - `exhaustive-deps`: dependência faltando = closure velha. Foi exatamente
 *   assim que a revarredura da esteira parou de rodar (o timer reiniciava a
 *   cada mudança de estado e nunca chegava aos 90s).
 * - `no-cond-assign` / `no-dupe-keys` e afins vêm do `js.configs.recommended`,
 *   que é barato e não opina sobre estilo.
 *
 * O que for estilo (aspas, ponto e vírgula, ordem de import) fica de fora: o
 * código já é consistente e reformatar 174 arquivos enterraria o histórico.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**', 'public/sw.js'],
  },
  js.configs.recommended,
  {
    // Scripts de linha de comando: rodam no Node, não no navegador nem no Worker.
    // Sem estes globais o lint acusava 70 `no-undef` em código que sempre
    // funcionou — ruído que fazia `npm run lint` falhar por nada e treinava a
    // equipe a ignorar a saída inteira.
    files: ['scripts/**/*.{js,mjs,cjs}', 'tools/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly', process: 'readonly', Buffer: 'readonly',
        __dirname: 'readonly', __filename: 'readonly', require: 'readonly',
        module: 'writable', exports: 'writable', crypto: 'readonly',
        URL: 'readonly', TextEncoder: 'readonly', fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'functions/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly',
        console: 'readonly', crypto: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        Response: 'readonly', Request: 'readonly', Headers: 'readonly', Blob: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly',
        atob: 'readonly', btoa: 'readonly', Image: 'readonly', Notification: 'readonly',
        AudioContext: 'readonly', performance: 'readonly', HTMLElement: 'readonly',
        HTMLVideoElement: 'readonly', HTMLInputElement: 'readonly', HTMLDivElement: 'readonly',
        HTMLIFrameElement: 'readonly', KeyboardEvent: 'readonly', MouseEvent: 'readonly',
        Event: 'readonly', AbortController: 'readonly', FileReader: 'readonly',
        File: 'readonly', FormData: 'readonly', DOMParser: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        D1Database: 'readonly', R2Bucket: 'readonly', PagesFunction: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // O TypeScript já cuida de nome não declarado, e sabe de tipos e globais
      // do Workers que o eslint sozinho não conhece.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // `</script>` escapado dentro de template literal que vira document.write
      // (MonthlyReportModal) é defesa proposital, não descuido.
      'no-useless-escape': 'warn',

      // ── React Compiler: aviso, não erro ──────────────────────────────────
      // O `recommended` do eslint-plugin-react-hooks v7 passou a incluir as
      // regras do React Compiler. O projeto NÃO usa o compiler — elas apontam
      // "isto impediria a otimização automática", não "isto está quebrado".
      // Como erro elas somavam 90 e faziam `npm run lint` sair 1 sempre, o que
      // esconde os defeitos de verdade no meio do ruído e é o mesmo que não ter
      // lint (a razão de este arquivo ser enxuto, escrita no topo).
      //
      // Ficam como aviso: são pista boa de onde o estado está sendo costurado
      // à mão, e é assim que aparecem quando alguém for adotar o compiler.
      // `rules-of-hooks` continua ERRO — essa quebra o React de verdade, e hoje
      // não há nenhuma violação.
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
)
