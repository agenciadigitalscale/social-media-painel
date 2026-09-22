# Próximos passos — DS HUB

> Anotado em 2026-09-22 para continuar no VS Code. Tudo abaixo está commitado e no
> GitHub. No VS Code: abra a pasta, rode `git pull`, e chame o Claude (`claude` no
> terminal integrado, ou a extensão **Claude Code** da Anthropic).

---

## ✅ O que já ficou pronto nesta rodada (no ar)

- **Vídeo que trava no cliente** — a transcodificação adaptativa (Cloudflare Stream)
  já existia; agora a aba **Entregas** mostra o status da "Versão leve" e tem botão
  **Transcodificar**. Só falta ligar o token (abaixo).
- **Guardas onda 2** — 7 endpoints internos entraram em modo observação.
- **Ponte Studio** — a fila mostra os Reels em *Ajuste* com o motivo do cliente; a
  entrega do Studio notifica a equipe.
- **Painéis do editor** — viraram cards grandes e destacados.

---

## 🔑 2 ações suas (destravam valor real) — comandos exatos

### 1. Ligar a "Versão leve" (os vídeos param de travar no cliente)

O código está pronto e **desligado** — só falta o token.

1. No painel da Cloudflare: **My Profile → API Tokens → Create Token**, permissão
   **Account · Stream · Edit**. Copie o token.
2. No terminal, na pasta do projeto:
   ```bash
   npx wrangler pages secret put STREAM_API_TOKEN --project-name social-media-painel
   ```
   Cole o token quando pedir (sem espaço/quebra de linha no fim).
3. Pronto. Abra **Entregas** → a linha **"Versão leve"** mostra os vídeos virando
   *prontos*; clique **Transcodificar** para pegar os que já estão com clientes.

Custo: transcodificação é grátis; armazenamento/entrega ~US$ 2/mês na escala de vocês.

### 2. Alinhar o `CRON_SECRET` (a detecção de vídeo passa a rodar sozinha)

Hoje a esteira/Inbox só detecta vídeo novo quando **alguém está logado** no painel.
O worker `ds-hub-cron` já chama sozinho a cada 5 min, mas leva **401** porque o
`CRON_SECRET` não bate entre os dois lados. Ponha o **MESMO valor** nos dois:

```bash
# 1) no worker do cron
npx wrangler secret put CRON_SECRET --config cron/wrangler.toml

# 2) no Pages (o mesmo valor!)
npx wrangler pages secret put CRON_SECRET --project-name social-media-painel
```

Depois, confira em **Produções → Inbox → "Saúde da automação"**: o *último cron*
deve passar a avançar (hoje só o *manual* avança).

> Dica: gere um valor forte com `openssl rand -hex 24` e use o mesmo nos dois comandos.

---

## 🚧 O que falta do meu lado ("faça tudo")

- **Item 2 — Painéis no celular.** A barra de painéis (bonita no desktop) ainda não
  existe no board mobile (`src/mobile/`), que também não mostra quem edita.
- **Item 4 — "deixa comigo".** Um pacote de melhorias de maior impacto que eu escolho,
  faço e mostro pronto.
- **Virar a chave `PANEL_REQUIRE_AUTH=1`** — só depois da auditoria mostrar acesso
  anônimo zerado nessas rotas (ver **Gerenciar Senhas → auditoria** no painel).
  `/api/mirror` e `/api/thumb` ficaram de fora de propósito (cron e páginas públicas).

Para retomar comigo qualquer um desses, é só pedir: *"continua o item 2"* etc.

---

## 🎬 Kaique Studio (repo separado)

Está em `../Kaique-Studio` (branch `master`), também limpo e no GitHub. Pendências:
ligar a ponte ponta-a-ponta (colar a `STUDIO_KEY` na aba DS HUB do Studio) e o acervo
maior de sons (precisa de arquivos reais para o R2). Ver a memória do projeto.
