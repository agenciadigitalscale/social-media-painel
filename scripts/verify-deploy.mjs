/**
 * "Subiu mesmo?" — confere o que o servidor ENTREGA contra o que foi construído.
 *
 * Em 02/09/2026 o Cloudflare Pages listou o commit como **Active** e continuou
 * servindo o pacote anterior. CI verde, push aceito, deploy "Active" — e o
 * recurso simplesmente não existia no navegador de quem abria o painel. Quem
 * descobriu foi o dono do produto, clicando num botão que não estava lá.
 *
 * Nenhum sinal do processo pegou isso, porque todos olham para o COMMIT. Este
 * script olha para a RESPOSTA HTTP, que é a única coisa que o usuário recebe.
 *
 * Como funciona, sem precisar conhecer o conteúdo do app: o `dist/index.html`
 * aponta para os arquivos com hash de CONTEÚDO. Mesmo hash no ar significa
 * conteúdo idêntico bit a bit; hash diferente é build diferente, por definição.
 * Então comparar os nomes basta, e continua valendo quando o app mudar.
 *
 * Uso: node scripts/verify-deploy.mjs [url]
 * Sai com código 1 quando diverge, para poder virar passo de CI.
 */
import { readFileSync } from 'node:fs'
import { setTimeout as dormir } from 'node:timers/promises'

const URL_PADRAO = 'https://social-media-painel.pages.dev'
const alvo = (process.argv[2] ?? URL_PADRAO).replace(/\/$/, '')

/** Os assets com hash referenciados por um HTML. */
function assetsDe(html) {
  return [...html.matchAll(/assets\/([A-Za-z0-9._-]+?-[A-Za-z0-9_-]{8,})\.(js|css)/g)]
    .map(m => `assets/${m[1]}.${m[2]}`)
}

async function conferir() {
  let local
  try {
    local = readFileSync('dist/index.html', 'utf8')
  } catch {
    console.error('✖ Sem dist/index.html — rode `npm run build` antes.')
    return 1
  }

  const esperados = assetsDe(local)
  if (esperados.length === 0) {
    console.error('✖ Nenhum asset com hash em dist/index.html. O build mudou de formato?')
    return 1
  }

  let remoto
  try {
    // O parâmetro só força a borda a não devolver uma cópia guardada; o
    // servidor ignora o que não conhece.
    const res = await fetch(`${alvo}/?_verify=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) {
      console.error(`✖ ${alvo} respondeu ${res.status}.`)
      return 1
    }
    remoto = await res.text()
  } catch (e) {
    console.error(`✖ Não deu para buscar ${alvo}: ${e.message}`)
    return 1
  }

  const servidos = new Set(assetsDe(remoto))
  const faltando = esperados.filter(a => !servidos.has(a))

  if (faltando.length === 0) {
    console.log(`✔ ${alvo} está servindo este build (${esperados.length} assets conferem).`)
    return 0
  }

  console.error(`✖ ${alvo} NÃO está servindo este build.`)
  console.error(`  construído aqui: ${esperados.join(', ')}`)
  console.error(`  servido no ar:   ${[...servidos].join(', ') || '(nenhum)'}`)
  console.error('')
  console.error('  O deploy pode constar como "Active" e ainda assim entregar o')
  console.error('  pacote anterior. Rode `npm run deploy` para subir este build direto.')
  return 1
}

/* `process.exit()` no meio de um fetch derruba o libuv no Windows
   (`UV_HANDLE_CLOSING`) e devolve 127 — o script acusaria falha SEMPRE, e num
   passo de CI isso é pior que não ter verificação nenhuma. Marcar o código e
   deixar o Node terminar sozinho sai limpo nos dois sistemas. */
/* O deploy leva algumas dezenas de segundos para propagar. Sem repetir, o
   script viraria alarme falso logo depois de subir — e alarme falso ensina a
   ignorar o alarme, que é exatamente o problema que ele existe para resolver. */
const TENTATIVAS = 8
const ESPERA_MS = 12_000

let codigo = 1
for (let i = 1; i <= TENTATIVAS; i++) {
  codigo = await conferir()
  if (codigo === 0) break
  if (i < TENTATIVAS) {
    console.error(`  … ainda propagando? nova tentativa em ${ESPERA_MS / 1000}s (${i}/${TENTATIVAS})`)
    await dormir(ESPERA_MS)
  }
}
process.exitCode = codigo
