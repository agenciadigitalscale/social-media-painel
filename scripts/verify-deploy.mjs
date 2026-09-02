/**
 * "Subiu mesmo?" — confere o que o servidor ENTREGA contra o commit que você tem.
 *
 * Em 02/09/2026 o Cloudflare Pages listou o commit como **Active** e continuou
 * servindo o pacote anterior. CI verde, push aceito, deploy "Active" — e o
 * recurso não existia no navegador de quem abria o painel. Quem descobriu foi o
 * dono do produto, clicando num botão que não estava lá.
 *
 * Nenhum sinal do processo pegou isso porque todos olham para o COMMIT NO GIT.
 * Este script olha para a RESPOSTA HTTP, que é a única coisa que o usuário
 * recebe — e lê dela qual commit gerou o que está servido.
 *
 * ── Por que o commit e não o nome dos arquivos ────────────────────────
 * A primeira versão comparava os nomes com hash de conteúdo do
 * `dist/index.html` com os do HTML servido. A premissa era "mesmo código, mesmo
 * hash". Ela é FALSA entre ambientes: medido no mesmo dia, o build do Cloudflare
 * e o build local geram nomes diferentes para código idêntico (o servido tinha
 * o recurso novo; o nome não batia). Isso dava alarme falso sempre que o deploy
 * automático do push vencia o deploy manual — e alarme falso ensina a ignorar o
 * alarme, que é o oposto do objetivo.
 *
 * O carimbo `<meta name="ds-build">` (posto pelo plugin em `vite.config.ts`) é
 * o mesmo venha o build de onde vier, porque descreve a ORIGEM, não o produto.
 *
 * Uso: node scripts/verify-deploy.mjs [url]
 * Sai com código 1 quando diverge.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { setTimeout as dormir } from 'node:timers/promises'

const URL_PADRAO = 'https://social-media-painel.pages.dev'
const alvo = (process.argv[2] ?? URL_PADRAO).replace(/\/$/, '')

const carimboDe = html => html.match(/<meta\s+name="ds-build"\s+content="([^"]+)"/)?.[1] ?? null

/** O commit que o build local diz ter usado — não o HEAD do git.
 *  São diferentes quando alguém constrói e depois commita, e o que importa é
 *  o que está EM DIST, que é o que foi (ou seria) enviado. */
function commitLocal() {
  try {
    const c = carimboDe(readFileSync('dist/index.html', 'utf8'))
    if (c && c !== 'desconhecido') return c
  } catch { /* sem dist */ }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

async function conferir(esperado) {
  let html
  try {
    // O parâmetro só força a borda a não devolver cópia guardada; o servidor
    // ignora o que não conhece.
    const res = await fetch(`${alvo}/?_verify=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) {
      console.error(`✖ ${alvo} respondeu ${res.status}.`)
      return 1
    }
    html = await res.text()
  } catch (e) {
    console.error(`✖ Não deu para buscar ${alvo}: ${e.message}`)
    return 1
  }

  const servido = carimboDe(html)

  if (!servido) {
    // Build anterior ao carimbo: não dá para afirmar nada, e afirmar "está
    // velho" seria tão errado quanto afirmar "está novo".
    console.error(`✖ ${alvo} não traz o carimbo <meta name="ds-build">.`)
    console.error('  É um build anterior a esta conferência, ou o deploy não subiu.')
    console.error('  Depois que uma versão COM carimbo estiver no ar, este caso vira certeza.')
    return 1
  }

  if (servido === esperado) {
    console.log(`✔ ${alvo} está servindo o commit ${esperado.slice(0, 7)}.`)
    return 0
  }

  console.error(`✖ ${alvo} está servindo OUTRO commit.`)
  console.error(`  esperado: ${esperado}`)
  console.error(`  no ar:    ${servido}`)
  console.error('')
  console.error('  O deploy pode constar como "Active" e ainda assim entregar o')
  console.error('  pacote anterior. Rode `npm run deploy` para subir este build direto.')
  return 1
}

const esperado = commitLocal()
if (!esperado) {
  console.error('✖ Sem commit de referência: nem dist/index.html carimbado, nem git.')
  process.exitCode = 1
} else {
  /* O deploy leva algumas dezenas de segundos para propagar, e o build do
     Cloudflare disparado pelo push demora minutos. Sem repetir, o script
     acusaria falha antes de a resposta certa existir. */
  const TENTATIVAS = 8
  const ESPERA_MS = 15_000

  let codigo = 1
  for (let i = 1; i <= TENTATIVAS; i++) {
    codigo = await conferir(esperado)
    if (codigo === 0) break
    if (i < TENTATIVAS) {
      console.error(`  … ainda propagando? nova tentativa em ${ESPERA_MS / 1000}s (${i}/${TENTATIVAS})`)
      await dormir(ESPERA_MS)
    }
  }
  /* `process.exit()` no meio de um fetch derruba o libuv no Windows
     (`UV_HANDLE_CLOSING`) e devolve 127 — o script acusaria falha SEMPRE.
     Marcar o código e deixar o Node terminar sozinho sai limpo. */
  process.exitCode = codigo
}
