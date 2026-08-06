import { describe, expect, it, vi } from 'vitest'
import {
  clientForToken, itemFields, jsonKeySegment, jsonPath,
  patchItemStatus, projectItems,
} from '../appdata'

/**
 * D1 de mentira que grava o SQL e os binds. Não interpreta JSON1 — o que
 * importa testar aqui é o contrato: que a consulta pede CAMPO e não LINHA, que
 * o caminho vai ligado como parâmetro, e que falha de banco não escapa.
 */
function fakeDB(reply: { first?: unknown; all?: unknown; run?: unknown } = {}) {
  const calls: { sql: string; binds: unknown[] }[] = []
  const db = {
    calls,
    prepare(sql: string) {
      const call = { sql, binds: [] as unknown[] }
      calls.push(call)
      return {
        bind(...binds: unknown[]) { call.binds = binds; return this },
        first: async () => reply.first ?? undefined,
        all:   async () => reply.all  ?? { results: [] },
        run:   async () => reply.run  ?? { meta: { changes: 1 } },
      }
    },
  }
  return db as unknown as D1Database & { calls: typeof calls }
}

function explodingDB() {
  return {
    prepare() {
      return {
        bind() { return this },
        first: async () => { throw new Error('JSON inválido na linha') },
        all:   async () => { throw new Error('JSON inválido na linha') },
        run:   async () => { throw new Error('JSON inválido na linha') },
      }
    },
  } as unknown as D1Database
}

describe('caminhos JSON', () => {
  it('põe a chave entre aspas — id numérico não é caminho válido cru', () => {
    expect(jsonKeySegment(2007)).toBe('"2007"')
    expect(jsonPath(2007, 'title')).toBe('$."2007"."title"')
  })

  it('recusa chave que o parser de caminho do SQLite não representa', () => {
    // Sem escape dentro de $."...", uma aspa aqui viraria erro de sintaxe e
    // derrubaria a query inteira — não só o campo.
    expect(jsonKeySegment('a"b')).toBeNull()
    expect(jsonKeySegment('a\\b')).toBeNull()
    expect(jsonPath('ok', 'a"b')).toBeNull()
  })

  it('aceita UUID de token', () => {
    const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
    expect(jsonPath(uuid, '2007')).toBe(`$."${uuid}"."2007"`)
  })
})

describe('itemFields', () => {
  it('pede os campos por json_extract, sem trazer a linha', async () => {
    const db = fakeDB({ first: { f0: 'Vídeo Chuveiro', f1: 'https://drive/x' } })
    const out = await itemFields(db, 'sm_states', 2007, ['title', 'link'])

    expect(out.ok).toBe(true)
    expect(out.fields).toEqual({ title: 'Vídeo Chuveiro', link: 'https://drive/x' })

    const { sql, binds } = (db as unknown as { calls: { sql: string; binds: unknown[] }[] }).calls[0]
    expect(sql).toContain('json_extract')
    // Regressão do Error 1102: um `SELECT value` aqui traria os ~600 KB de volta
    // para o Worker, que foi exatamente o que estourou o limite de recurso.
    expect(sql).not.toMatch(/SELECT\s+value/i)
    expect(binds).toEqual(['sm_states', '$."2007"."title"', '$."2007"."link"'])
  })

  it('devolve não-sei em vez de estourar quando o banco falha', async () => {
    const out = await itemFields(explodingDB(), 'sm_states', 2007, ['title'])
    expect(out).toEqual({ ok: false, fields: {} })
  })

  it('recusa campo que não vira segmento de caminho', async () => {
    const db = fakeDB()
    const out = await itemFields(db, 'sm_states', 2007, ['ti"tle'])
    expect(out.ok).toBe(false)
    expect((db as unknown as { calls: unknown[] }).calls).toHaveLength(0)
  })
})

describe('clientForToken', () => {
  it('resolve o dono dentro do banco, comparando o valor', async () => {
    const db = fakeDB({ first: { client: "Frango d'Água" } })
    await expect(clientForToken(db, 'tok-123')).resolves.toBe("Frango d'Água")

    const { sql } = (db as unknown as { calls: { sql: string }[] }).calls[0]
    expect(sql).toContain('json_each')
    expect(sql).toContain('sm_portal_tokens')
  })

  it('token vazio nem consulta', async () => {
    const db = fakeDB()
    await expect(clientForToken(db, '')).resolves.toBeNull()
    expect((db as unknown as { calls: unknown[] }).calls).toHaveLength(0)
  })

  it('falha de banco vira null, não exceção', async () => {
    await expect(clientForToken(explodingDB(), 'tok')).resolves.toBeNull()
  })
})

describe('projectItems', () => {
  it('filtra os ids no SQL — não traz o calendário inteiro', async () => {
    const db = fakeDB({ all: { results: [{ id: '2007', f0: 'Título', f1: 5 }] } })
    const out = await projectItems(db, 'sm_states', [2007], ['title', 'status'])

    expect(out.get('2007')).toEqual({ title: 'Título', status: 5 })

    const { sql, binds } = (db as unknown as { calls: { sql: string; binds: unknown[] }[] }).calls[0]
    expect(sql).toContain('json_each')
    expect(sql).toContain('je.key IN')
    expect(binds).toEqual(['sm_states', '$."title"', '$."status"', '2007'])
  })

  it('fatia em blocos para não estourar o teto de variáveis do SQLite', async () => {
    const db = fakeDB({ all: { results: [] } })
    const ids = Array.from({ length: 450 }, (_, n) => n + 1)
    await projectItems(db, 'sm_states', ids, ['title'])
    expect((db as unknown as { calls: unknown[] }).calls).toHaveLength(3) // 200 + 200 + 50
  })

  it('lista vazia não consulta', async () => {
    const db = fakeDB()
    await projectItems(db, 'sm_states', [], ['title'])
    expect((db as unknown as { calls: unknown[] }).calls).toHaveLength(0)
  })
})

describe('patchItemStatus', () => {
  it('escreve pelo SQLite e sobe o rev', async () => {
    const db = fakeDB({ run: { meta: { changes: 1 } } })
    await expect(patchItemStatus(db, 2007, 5, null)).resolves.toBe(true)

    const { sql, binds } = (db as unknown as { calls: { sql: string; binds: unknown[] }[] }).calls[0]
    expect(sql).toContain('json_set')
    // Sem o incremento, o painel de quem estava com a aba aberta regrava por
    // cima da decisão do cliente na sincronização seguinte.
    expect(sql).toContain('rev = rev + 1')
    expect(binds).toEqual(['sm_states', '$."2007"', '$."2007"."status"', 5, '$."2007"."rejectionText"'])
  })

  it('aprovação apaga o motivo de recusa anterior', async () => {
    const db = fakeDB({ run: { meta: { changes: 1 } } })
    await patchItemStatus(db, 2007, 5, null)
    expect((db as unknown as { calls: { sql: string }[] }).calls[0].sql).toContain('json_remove')
  })

  it('recusa grava o motivo', async () => {
    const db = fakeDB({ run: { meta: { changes: 1 } } })
    await patchItemStatus(db, 2007, 6, 'trocar a trilha')

    const { sql, binds } = (db as unknown as { calls: { sql: string; binds: unknown[] }[] }).calls[0]
    expect(sql).not.toContain('json_remove')
    expect(binds).toContain('trocar a trilha')
  })

  it('linha inexistente devolve false para o chamador cair no caminho antigo', async () => {
    const db = fakeDB({ run: { meta: { changes: 0 } } })
    await expect(patchItemStatus(db, 2007, 5, null)).resolves.toBe(false)
  })

  it('falha de banco devolve false — a aprovação do cliente não pode se perder', async () => {
    await expect(patchItemStatus(explodingDB(), 2007, 5, null)).resolves.toBe(false)
  })
})

describe('resiliência geral', () => {
  it('nenhum helper propaga exceção do D1', async () => {
    const db = explodingDB()
    const spy = vi.fn()
    await Promise.all([
      itemFields(db, 'sm_states', 1, ['title']),
      clientForToken(db, 'x'),
      projectItems(db, 'sm_states', [1], ['title']),
      patchItemStatus(db, 1, 5, null),
    ]).catch(spy)
    expect(spy).not.toHaveBeenCalled()
  })
})
