/**
 * Reconciliação de três vias: o que eu tinha (`base`), o que eu fiz (`mine`) e
 * o que está no servidor agora (`theirs`).
 *
 * Existe porque o painel salva o valor inteiro de cada chave e o servidor
 * substituía — última gravação vence. Com 7 pessoas e um poll de 20s, isso
 * apagava trabalho alheio em silêncio. O pior caso medido é o `sm_custom`, uma
 * LISTA: dois cards criados no mesmo minuto, e o de quem salvou primeiro
 * desaparece — não volta ao estado antigo, some.
 *
 * A regra é sempre a mesma: parte-se do que está no servidor e aplica-se apenas
 * **a minha intenção** — o que eu mudei, criei ou apaguei em relação à base. O
 * que eu não toquei fica como o servidor tem, que é o trabalho do outro.
 *
 * Isto preserva exclusão e Ctrl+Z, coisa que simplesmente mesclar não faz:
 * mesclar ressuscita o que foi apagado.
 */

export type Json = unknown

function eq(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isPlainObject(v: Json): v is Record<string, Json> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Id estável de um item de lista. `null` quando a lista não é identificável. */
function idOf(item: Json): string | null {
  if (typeof item === 'number' || typeof item === 'string') return String(item)
  if (isPlainObject(item)) {
    for (const campo of ['i', 'id', 'key']) {
      const v = item[campo]
      if (typeof v === 'number' || typeof v === 'string') return String(v)
    }
  }
  return null
}

function mergeMaps(
  base: Record<string, Json>,
  mine: Record<string, Json>,
  theirs: Record<string, Json>,
): Record<string, Json> {
  const out: Record<string, Json> = { ...theirs }

  // O que eu criei ou alterei entra por cima do que está lá.
  for (const [k, v] of Object.entries(mine)) {
    if (!(k in base) || !eq(base[k], v)) out[k] = v
  }
  // O que eu apaguei sai — a menos que o outro tenha mexido nele nesse meio-tempo,
  // caso em que o trabalho dele vale mais que a minha remoção.
  for (const k of Object.keys(base)) {
    if (k in mine) continue
    if (k in theirs && !eq(theirs[k], base[k])) continue
    delete out[k]
  }
  return out
}

function mergeLists(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const idBase   = new Map(base.map(x => [idOf(x), x] as const))
  const idMine   = new Map(mine.map(x => [idOf(x), x] as const))
  const idTheirs = new Map(theirs.map(x => [idOf(x), x] as const))

  // Sem id em algum lado não há como saber o que é o quê: fica o meu, inteiro.
  // É o comportamento antigo, e só para listas que não sabemos identificar.
  if ([...idBase.keys(), ...idMine.keys(), ...idTheirs.keys()].some(k => k === null)) {
    return mine
  }

  const out: Json[] = []
  const jaSaiu = new Set<string>()

  // Ordem do servidor primeiro: quem chegou antes mantém a posição.
  for (const item of theirs) {
    const id = idOf(item)!
    jaSaiu.add(id)
    if (idMine.has(id)) {
      const meu = idMine.get(id)!
      const naBase = idBase.get(id)
      out.push(naBase !== undefined && !eq(naBase, meu) ? meu : item)
      continue
    }
    // Sumiu do meu lado: só é remoção se eu tinha na base (apaguei / desfiz).
    // Mas se o outro mexeu no item nesse meio-tempo, o trabalho dele vale mais
    // que a minha remoção — mesma regra dos mapas.
    if (idBase.has(id)) {
      const naBase = idBase.get(id)!
      if (eq(naBase, item)) continue
    }
    out.push(item)
  }

  // O que eu criei e o servidor ainda não conhece.
  for (const item of mine) {
    const id = idOf(item)!
    if (!jaSaiu.has(id)) out.push(item)
  }

  return out
}

/**
 * `base` é o que este navegador tinha quando começou a editar. Sem ela não dá
 * para distinguir "apaguei" de "nunca tive", e o seguro é ficar com o meu valor.
 */
export function reconcile(base: Json, mine: Json, theirs: Json): Json {
  if (base === undefined || base === null) return mine
  if (theirs === undefined || theirs === null) return mine
  if (eq(mine, theirs)) return mine

  if (Array.isArray(mine) && Array.isArray(theirs) && Array.isArray(base)) {
    return mergeLists(base, mine, theirs)
  }
  if (isPlainObject(mine) && isPlainObject(theirs) && isPlainObject(base)) {
    return mergeMaps(base, mine, theirs)
  }
  // Tipos diferentes ou valor escalar: não há o que reconciliar.
  return mine
}
