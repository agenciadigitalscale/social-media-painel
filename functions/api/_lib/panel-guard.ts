// Endpoints que só a equipe deveria alcançar.
//
// O trabalho de fechar o `/api/sync` (2026-07-23) mirou a porta mais larga: ela
// entregava o banco inteiro. Mas ela nunca foi a única aberta. Medido no código
// em 2026-08-14, SETE endpoints internos respondiam a qualquer um na internet,
// todos com `Access-Control-Allow-Origin: *` e nenhuma credencial:
//
//   /api/ai         → ANTHROPIC_API_KEY / GROQ_API_KEY   (conta da agência)
//   /api/creative   → OPENAI_API_KEY / TOGETHER / HF     (conta da agência)
//   /api/transcribe → OPENAI_API_KEY                     (conta da agência)
//   /api/places     → GOOGLE_PLACES_API_KEY              (conta da agência)
//   /api/apify      → APIFY_API_TOKEN                    (conta da agência)
//   /api/meta-ads   → token do Meta guardado no D1
//   /api/instagram  → token do IG guardado no D1, e PUBLICA
//
// Os cinco primeiros são relé aberto para API paga: quem descobrir a URL gasta
// o crédito da Digital Scale sem limite e sem rastro. Os dois últimos usam
// credencial de terceiros que a agência guardou — o do Instagram publica no
// perfil do cliente.
//
// A mecânica aqui é a MESMA já provada no `sync.ts`, e de propósito: fechar de
// uma vez tranca a equipe fora se algum caminho legítimo não carregar o cookie.
// Então primeiro observa-se — quem chega sem sessão é contado e PASSA — e a
// chave vira depois, por variável de ambiente, sem deploy e com volta atrás.
//
// Por padrão (`PANEL_REQUIRE_AUTH` ausente) o comportamento é idêntico ao de
// antes deste arquivo existir: ninguém é bloqueado. O que muda hoje é que
// passa a haver o número que permite decidir.

import { verifySession, type SessionEnv } from './session'
import { noteAccess } from './audit'

export interface PanelGuardEnv extends SessionEnv {
  /**
   * Opcional no tipo porque vários destes endpoints nunca declararam o binding
   * — no Pages, `env` traz todos de qualquer forma. Sem ele só não há auditoria.
   */
  DB?: D1Database
  /** '1' vira a chave: sem sessão, 401. Só depois da observação limpar. */
  PANEL_REQUIRE_AUTH?: string
}

interface GuardCtx {
  request: Request
  env: PanelGuardEnv
  waitUntil?: (p: Promise<unknown>) => void
}

/**
 * Registra o acesso e decide se a requisição segue.
 *
 * Devolve `null` quando pode passar, ou a `Response` de recusa quando não.
 * Quem chama trata como guarda de saída antecipada:
 *
 *   const blocked = await guardPanelRoute({ request, env, waitUntil }, CORS)
 *   if (blocked) return blocked
 */
export async function guardPanelRoute(
  ctx: GuardCtx,
  cors: Record<string, string>,
): Promise<Response | null> {
  const { request, env } = ctx

  const email = await verifySession(request.headers.get('Cookie'), env)

  // A auditoria NUNCA pode derrubar a requisição de ninguém — é o mesmo
  // princípio que o `audit.ts` aplica na gravação, estendido para cá.
  //
  // O caso concreto que isto pega: `waitUntil` passado sem `.bind(ctx)` perde o
  // `this` e estoura ao ser chamado. Acontece uma vez por minuto (o flush é
  // throttled), então vira 500 intermitente num endpoint que estava saudável —
  // o tipo de falha que custa uma tarde para reproduzir.
  try {
    if (env.DB) noteAccess(env.DB, request, !!email, ctx.waitUntil)
  } catch { /* medir o acesso não vale bloquear o acesso */ }

  const deny = (error: string, status: number) =>
    new Response(JSON.stringify({ ok: false, error }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
    })

  // Chave ligada sem segredo trancaria todo mundo fora em silêncio, e o dono do
  // painel ficaria procurando cookie que nenhuma porta consegue emitir. Dizer o
  // motivo é a diferença entre um susto de cinco minutos e uma tarde perdida.
  if (env.PANEL_REQUIRE_AUTH === '1' && !env.SESSION_SECRET) {
    return deny('PANEL_REQUIRE_AUTH está ativo, mas SESSION_SECRET não está configurado.', 500)
  }

  if (!email && env.PANEL_REQUIRE_AUTH === '1') {
    return deny('Sessão necessária', 401)
  }

  return null
}
