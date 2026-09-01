/* googleAuth.ts — o login Google, fora de qualquer componente de tela.

   Isto morava dentro do `LoginGate`, que era um SEGUNDO portão na frente do
   painel: a pessoa entrava pelo Google e só então via a tela de perfis. Dois
   logins em fila para o mesmo acesso. O portão foi removido em 2026-09-01 e a
   escolha do método passou para dentro da própria tela de perfis — quem clica
   no seu card decide ali se entra pelo Google ou pela senha.

   Aqui fica só a mecânica: carregar o script do Google, desenhar o botão dele
   e trocar a credencial por uma sessão nossa. Quem decide o que fazer com a
   identidade é a tela.
*/
import { userFromEmail } from '../../lib/users'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void
          renderButton: (el: HTMLElement, cfg: object) => void
          prompt: () => void
          /** Faz o Google parar de reusar a última conta — o "trocar de conta". */
          disableAutoSelect: () => void
        }
      }
    }
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** O login Google está configurado neste ambiente? */
export const googleDisponivel = (): boolean => !!GOOGLE_CLIENT_ID

export interface ResultadoGoogle {
  ok: boolean
  /** E-mail da conta que entrou. */
  email?: string
  /** Membro do NAME_MAP correspondente, quando existe. */
  membro?: string | null
  erro?: string
}

/**
 * Já existe sessão válida neste navegador?
 *
 * Chamado ao abrir a tela. Quem tem sessão viva e conta mapeada entra sem
 * clicar em nada — era o que o `LoginGate` fazia, e perder isso obrigaria a
 * equipe a escolher o perfil toda vez que trocasse de aba.
 */
export async function sessaoExistente(): Promise<ResultadoGoogle> {
  try {
    const r = await fetch('/api/auth', { credentials: 'include' })
    const d = await r.json() as { ok: boolean; email?: string }
    if (!d.ok || !d.email) return { ok: false }
    return { ok: true, email: d.email, membro: userFromEmail(d.email) }
  } catch {
    // Sem rede: a tela segue no fluxo normal de escolher perfil.
    return { ok: false }
  }
}

/** Troca a credencial do Google por uma sessão nossa (cookie assinado). */
async function trocarPorSessao(credential: string): Promise<ResultadoGoogle> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const d = await res.json() as { ok: boolean; error?: string; email?: string }
    if (!d.ok) return { ok: false, erro: d.error ?? 'Acesso negado.' }
    return { ok: true, email: d.email, membro: d.email ? userFromEmail(d.email) : null }
  } catch {
    return { ok: false, erro: 'Erro de conexão. Tente novamente.' }
  }
}

let carregandoScript: Promise<void> | null = null

/** Carrega o script do Google uma vez só, mesmo com vários pedidos em paralelo. */
function carregarGIS(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (carregandoScript) return carregandoScript
  carregandoScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => { carregandoScript = null; reject(new Error('GIS não carregou')) }
    document.head.appendChild(script)
  })
  return carregandoScript
}

/**
 * Desenha o botão do Google dentro de `alvo` e chama `aoEntrar` com o
 * resultado. Devolve uma função de limpeza.
 *
 * O botão é renderizado pelo próprio Google — não dá para estilizá-lo por CSS
 * nosso, e tentar substituí-lo por um botão próprio quebra a política deles.
 * Por isso a tela o embrulha num contêiner com a moldura da capa.
 */
export function montarBotaoGoogle(
  alvo: HTMLElement,
  aoEntrar: (r: ResultadoGoogle) => void,
): () => void {
  let vivo = true

  carregarGIS()
    .then(() => {
      if (!vivo || !window.google?.accounts) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          const r = await trocarPorSessao(resp.credential)
          if (vivo) aoEntrar(r)
        },
        ux_mode: 'popup',
        locale: 'pt-BR',
      })
      window.google.accounts.id.renderButton(alvo, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        locale: 'pt-BR',
      })
    })
    .catch(() => {
      if (vivo) aoEntrar({ ok: false, erro: 'Não foi possível carregar o login do Google.' })
    })

  return () => { vivo = false }
}

/**
 * Faz o Google esquecer a conta que ele guardou.
 *
 * Sem isto, quem entrou com o Gmail errado fica preso: o Google reusa a última
 * conta e não pergunta de novo.
 */
export function esquecerConta(): void {
  try { window.google?.accounts.id.disableAutoSelect() } catch { /* sem GIS */ }
}
