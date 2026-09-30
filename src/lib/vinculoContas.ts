/**
 * Qual cliente do painel é dono de cada Página/Instagram que o token enxerga.
 *
 * Só SUGERE — quem confirma é o sócio, na tela. Casar sozinho aqui seria
 * publicar o post de um cliente no perfil de outro. Por isso, na dúvida
 * (empate, nome curto demais), a sugestão fica vazia.
 */

export interface ContaMeta {
  pageId: string
  pageName: string
  igUserId: string | null
  igUsername: string | null
}

/** "Frango d'Água" → "frangodagua". */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function palavras(s: string): string[] {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(p => p.length >= 4)
}

/** 3 = mesmo nome · 2 = um contém o outro · 1 = divide uma palavra de 4+ letras · 0 = nada. */
export function pontuar(cliente: string, conta: ContaMeta): number {
  const c = normalizar(cliente)
  if (c.length < 3) return 0
  const alvos = [conta.pageName, conta.igUsername ?? ''].map(normalizar).filter(a => a.length >= 3)
  if (alvos.some(a => a === c)) return 3
  if (c.length >= 4 && alvos.some(a => a.includes(c) || (a.length >= 4 && c.includes(a)))) return 2
  const pc = new Set(palavras(cliente))
  const pa = [conta.pageName, (conta.igUsername ?? '').replace(/[._]/g, ' ')].flatMap(palavras)
  return pa.some(p => pc.has(p)) ? 1 : 0
}

/**
 * Uma sugestão por conta, sem repetir cliente: os pares mais fortes escolhem
 * primeiro. Empate no topo para a mesma conta = sem sugestão.
 */
export function sugerirVinculos(clientes: string[], contas: ContaMeta[]): Record<string, string> {
  const pares: { conta: string; cliente: string; nota: number }[] = []
  for (const conta of contas) {
    const notas = clientes.map(cliente => ({ cliente, nota: pontuar(cliente, conta) })).filter(x => x.nota > 0)
    if (!notas.length) continue
    const topo = Math.max(...notas.map(x => x.nota))
    const melhores = notas.filter(x => x.nota === topo)
    if (melhores.length === 1) pares.push({ conta: conta.pageId, cliente: melhores[0].cliente, nota: topo })
  }
  pares.sort((a, b) => b.nota - a.nota)
  const out: Record<string, string> = {}
  const usados = new Set<string>()
  for (const p of pares) {
    if (usados.has(p.cliente) || out[p.conta]) continue
    out[p.conta] = p.cliente
    usados.add(p.cliente)
  }
  return out
}
