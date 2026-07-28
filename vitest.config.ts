import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // `functions/` entra aqui porque a sessão do painel é decidida no servidor:
    // é ela que vai dizer quem entra quando o /api/sync fechar, e até agora não
    // tinha um único teste. Roda em node — o `session.ts` só usa Web Crypto.
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
  },
})
