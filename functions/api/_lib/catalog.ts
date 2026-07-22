// De quem é cada conteúdo — do lado do servidor.
//
// O calendário mora no bundle do painel (`src/data.ts`), então até aqui só o
// navegador sabia que o item 2007 é do Frango d'Água. Consequência: um endpoint
// público não tinha como recusar "me dê o item 2007" vindo do token de outro
// cliente. Importar o catálogo resolve isso na origem — é a mesma lista, sem
// duplicação, e entra no bundle da Function como dado estático.

import { DATA, DATA_JULHO } from '../../../src/data'

export interface CatalogItem {
  i: number
  c: string
  n: string
  tp: string
  dt: string
}

export interface CustomRow {
  i: number
  c: string
  n?: string
  tp?: string
  dt?: string
}

const SEEDED = new Map<number, { c: string; n: string; tp: string; dt: Date }>(
  [...DATA, ...DATA_JULHO].map(i => [i.i, { c: i.c, n: i.n, tp: i.tp, dt: i.dt }]),
)

/** Dono do conteúdo, ou `null` quando ele não existe em lugar nenhum. */
export function ownerOfItem(itemId: number, custom: CustomRow[]): string | null {
  const seeded = SEEDED.get(itemId)
  if (seeded) return seeded.c
  return custom.find(c => c.i === itemId)?.c ?? null
}

export function seededItem(itemId: number): { c: string; n: string; tp: string; dt: string } | null {
  const found = SEEDED.get(itemId)
  return found ? { ...found, dt: found.dt.toISOString() } : null
}

/** Todo o conteúdo de um cliente — semeado e criado à mão. */
export function itemsOfClient(clientName: string, custom: CustomRow[]): CatalogItem[] {
  const fromSeed: CatalogItem[] = []
  for (const [i, v] of SEEDED) {
    if (v.c === clientName) fromSeed.push({ i, c: v.c, n: v.n, tp: v.tp, dt: v.dt.toISOString() })
  }
  const fromCustom: CatalogItem[] = custom
    .filter(c => c.c === clientName)
    .map(c => ({ i: c.i, c: c.c, n: c.n ?? '', tp: c.tp ?? 'Post', dt: c.dt ?? new Date().toISOString() }))

  return [...fromSeed, ...fromCustom]
}
